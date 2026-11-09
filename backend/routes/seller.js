import { sellerPrice } from "../product-rules.js";
import { normalizeImage } from "../images.js";
import { recordOrderEvent } from "../order-workflow.js";
import { Router } from "express";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import multer from "multer";
import {
  db,
  allocateId,
  mapProduct,
  mapStore,
  mapOrder,
  mapPromo,
} from "../db.js";
import {
  hashPassword,
  normalizePhone,
  verifyPassword,
  loginThrottle,
} from "../auth.js";
import { requireSellerAuth, createSellerSession } from "../seller-auth.js";
import { encryptSellerValue } from "../seller-security.js";

const router = Router();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadDir = path.join(__dirname, "..", "uploads");
fs.mkdirSync(uploadDir, { recursive: true });
const imageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const storage = multer.diskStorage({
  destination: (_req, _file, done) => done(null, uploadDir),
  filename: (_req, file, done) => {
    const ext =
      file.mimetype === "image/png"
        ? ".png"
        : file.mimetype === "image/webp"
          ? ".webp"
          : ".jpg";
    done(null, `${crypto.randomUUID()}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024, files: 2 },
  fileFilter: (_req, file, done) => done(null, imageTypes.has(file.mimetype)),
});
const registrationImages = upload.fields([{ name: "logo", maxCount: 1 }]);
const storeImages = upload.fields([{ name: "logo", maxCount: 1 }]);

const fail = (res, status, code, message) =>
  res.status(status).json({ error: { code, message } });
const text = (value, max = 255) =>
  String(value ?? "")
    .trim()
    .slice(0, max);
const digits = (value) =>
  String(value ?? "")
    .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
    .replace(/\D/g, "");
const publicFile = (file) => (file ? `/api/uploads/${file.filename}` : null);
const removeFiles = (files) =>
  Object.values(files ?? {})
    .flat()
    .forEach((f) => fs.promises.unlink(f.path).catch(() => {}));

const storeCategories = new Set([
  "supermarket",
  "hypermarket",
  "produce",
  "bakery",
  "other",
]);
const parseItems = (v) => {
  try {
    return typeof v === "string" ? JSON.parse(v) : v;
  } catch {
    return [];
  }
};

async function sellerStore(sellerId, tx = db) {
  return tx.get("SELECT * FROM stores WHERE seller_id = ? LIMIT 1", [sellerId]);
}
function sellerPayload(account, store) {
  return {
    id: Number(account.id),
    ownerName: account.owner_name,
    phone: account.phone,
    hasNationalId: Boolean(account.national_id_enc),
    hasIban: Boolean(account.iban_enc),
    store: store ? mapStore(store) : null,
  };
}
function responseFor(account, store) {
  return { seller: sellerPayload(account, store) };
}
function validateIban(input) {
  return /^IR\d{24}$/.test(String(input).replace(/\s/g, "").toUpperCase());
}
function validIranianNationalId(input) {
  if (!/^\d{10}$/.test(input) || /^(\d)\1{9}$/.test(input)) return false;
  const digitsArray = [...input].map(Number);
  const sum = digitsArray
    .slice(0, 9)
    .reduce((total, digit, index) => total + digit * (10 - index), 0);
  const remainder = sum % 11;
  return (remainder < 2 ? remainder : 11 - remainder) === digitsArray[9];
}

router.post("/auth/register", (req, res, next) =>
  registrationImages(req, res, (err) =>
    err ? next(err) : registerSeller(req, res, next),
  ),
);
async function registerSeller(req, res, next) {
  const files = req.files ?? {};
  try {
    const reject = (status, code, message) => {
      removeFiles(files);
      return fail(res, status, code, message);
    };
    const body = req.body ?? {};
    const phone = normalizePhone(body.phone),
      nationalId = digits(body.nationalId),
      iban = String(body.iban ?? "")
        .replace(/\s/g, "")
        .toUpperCase();
    const ownerName = text(body.ownerName, 120),
      shopName = text(body.shopName, 160),
      category = text(body.category, 40);
    const address = text(body.address, 500),
      password = String(body.password ?? "");
    if (!/^09\d{9}$/.test(phone))
      return reject(
        400,
        "invalid_phone",
        "شماره موبایل باید ۱۱ رقم و با ۰۹ شروع شود.",
      );
    if (password.length < 8)
      return reject(400, "weak_password", "رمز عبور باید حداقل ۸ نویسه باشد.");
    if (!ownerName || !shopName || !address)
      return reject(
        400,
        "required_fields",
        "نام صاحب فروشگاه، نام فروشگاه و نشانی دقیق الزامی است.",
      );
    if (!validIranianNationalId(nationalId))
      return reject(400, "invalid_national_id", "کد ملی واردشده معتبر نیست.");
    if (!validateIban(iban))
      return reject(
        400,
        "invalid_iban",
        "شماره شبا باید با IR و ۲۴ رقم وارد شود.",
      );
    if (!storeCategories.has(category))
      return reject(
        400,
        "invalid_category",
        "دسته‌بندی فروشگاه را انتخاب کنید.",
      );
    if (!files.logo?.[0])
      return reject(
        400,
        "store_logo_required",
        "بارگذاری لوگوی مربع فروشگاه الزامی است.",
      );
    if (await db.get("SELECT id FROM seller_accounts WHERE phone = ?", [phone]))
      return reject(
        409,
        "phone_taken",
        "با این شماره قبلاً حساب فروشنده ساخته شده است.",
      );

    try {
      await normalizeImage(files.logo[0], true);
    } catch {
      return reject(400, "invalid_image", "فایل لوگو باید تصویر معتبر باشد.");
    }
    const encNationalId = encryptSellerValue(nationalId),
      encIban = encryptSellerValue(iban);
    const logoUrl = publicFile(files.logo[0]);
    const lat = body.lat == null || body.lat === "" ? null : Number(body.lat);
    const lng = body.lng == null || body.lng === "" ? null : Number(body.lng);
    if (
      (lat !== null && (!Number.isFinite(lat) || Math.abs(lat) > 90)) ||
      (lng !== null && (!Number.isFinite(lng) || Math.abs(lng) > 180))
    )
      return reject(400, "invalid_location", "موقعیت جغرافیایی معتبر نیست.");
    const createdAt = new Date().toISOString();
    const sessionToken = crypto.randomBytes(32).toString("hex");
    const result = await db.transaction(async (tx) => {
      const sellerResult = await tx.run(
        "INSERT INTO seller_accounts (phone, password_hash, owner_name, national_id_enc, iban_enc, created_at) VALUES (?, ?, ?, ?, ?, ?)",
        [
          phone,
          hashPassword(password),
          ownerName,
          encNationalId,
          encIban,
          createdAt,
        ],
      );
      const sellerId = Number(sellerResult.insertId),
        storeId = await allocateId(tx, "store");
      const type = category === "hypermarket" ? "hypermarket" : "supermarket";
      await tx.run(
        `INSERT INTO stores (id, name, type, pro, is_new, rating, minutes, fee, area, tags, off_text, gradient, initial, min_basket,
          seller_id, category, address, lat, lng, photo_url, logo_url, hours, is_active)
         VALUES (?, ?, ?, 0, 1, NULL, 45, 35000, ?, '[]', NULL, 'from-[#16865b] to-[#26352e]', ?, 100000, ?, ?, ?, ?, ?, NULL, ?, ?, 0)`,
        [
          storeId,
          shopName,
          type,
          address.slice(0, 180),
          ownerName.slice(0, 1),
          sellerId,
          category,
          address,
          lat,
          lng,
          logoUrl,
          text(body.hours, 160),
        ],
      );
      await tx.run(
        "INSERT INTO seller_sessions (token, seller_id, created_at) VALUES (?, ?, ?)",
        [sessionToken, sellerId, createdAt],
      );
      const account = await tx.get(
        "SELECT * FROM seller_accounts WHERE id = ?",
        [sellerId],
      );
      const store = await tx.get("SELECT * FROM stores WHERE id = ?", [
        storeId,
      ]);
      return { account, store, sellerId };
    });
    res
      .status(201)
      .json({
        token: sessionToken,
        seller: sellerPayload(result.account, result.store),
      });
  } catch (error) {
    removeFiles(files);
    if (error?.code === "ER_DUP_ENTRY")
      return fail(
        res,
        409,
        "phone_taken",
        "این شماره یا فروشگاه قبلاً ثبت شده است.",
      );
    if (error?.code === "seller_encryption_not_configured")
      return fail(res, 503, error.code, error.message);
    next(error);
  }
}

router.post("/auth/login", loginThrottle, async (req, res) => {
  const phone = normalizePhone(req.body?.phone),
    password = String(req.body?.password ?? "");
  if (!/^09\d{9}$/.test(phone) || !password)
    return fail(
      res,
      400,
      "invalid_credentials",
      "شماره موبایل و رمز عبور را وارد کنید.",
    );
  const account = await db.get(
    "SELECT * FROM seller_accounts WHERE phone = ?",
    [phone],
  );
  if (
    !account ||
    !verifyPassword(password, account.password_hash) ||
    !account.active
  )
    return fail(
      res,
      401,
      "invalid_credentials",
      "شماره موبایل یا رمز عبور فروشنده نادرست است.",
    );
  const token = await createSellerSession(account.id),
    store = await sellerStore(account.id);
  res.json({ token, seller: sellerPayload(account, store) });
});
router.post("/auth/logout", requireSellerAuth, async (req, res) => {
  await db.run("DELETE FROM seller_sessions WHERE token = ?", [
    req.sellerToken,
  ]);
  res.json({ ok: true });
});
router.get("/auth/me", requireSellerAuth, async (req, res) => {
  const account = await db.get("SELECT * FROM seller_accounts WHERE id = ?", [
    req.seller.id,
  ]);
  res.json(responseFor(account, await sellerStore(req.seller.id)));
});

router.use(requireSellerAuth);
router.get("/dashboard", async (req, res) => {
  const store = await sellerStore(req.seller.id);
  if (!store)
    return fail(res, 404, "store_missing", "پروفایل فروشگاه ثبت نشده است.");
  const [productCount, activeProducts, pendingOrders, allOrders, sales] =
    await Promise.all([
      db.get("SELECT COUNT(*) AS n FROM products WHERE seller_id = ?", [
        req.seller.id,
      ]),
      db.get(
        "SELECT COUNT(*) AS n FROM products WHERE seller_id = ? AND active = 1",
        [req.seller.id],
      ),
      db.get(
        "SELECT COUNT(*) AS n FROM orders WHERE store_id = ? AND status IN (1,2)",
        [store.id],
      ),
      db.get("SELECT COUNT(*) AS n FROM orders WHERE store_id = ?", [store.id]),
      db.get(
        "SELECT COALESCE(SUM(total), 0) AS n FROM orders WHERE store_id = ? AND status = 5",
        [store.id],
      ),
    ]);
  res.json({
    store: mapStore(store),
    stats: {
      products: Number(productCount.n),
      activeProducts: Number(activeProducts.n),
      pendingOrders: Number(pendingOrders.n),
      orders: Number(allOrders.n),
      sales: Number(sales.n),
    },
  });
});
router.get("/store", async (req, res) => {
  const store = await sellerStore(req.seller.id);
  if (!store) return fail(res, 404, "store_missing", "فروشگاه پیدا نشد.");
  res.json({ store: mapStore(store) });
});
router.put("/store", (req, res, next) =>
  storeImages(req, res, (err) =>
    err ? next(err) : updateStore(req, res, next),
  ),
);
async function updateStore(req, res, next) {
  const files = req.files ?? {};
  try {
    const store = await sellerStore(req.seller.id);
    if (!store) return fail(res, 404, "store_missing", "فروشگاه پیدا نشد.");
    const b = req.body ?? {},
      name = text(b.name, 160),
      address = text(b.address, 500),
      category = text(b.category, 40);
    if (!name || !address || !storeCategories.has(category))
      return fail(
        res,
        400,
        "invalid_store",
        "نام، دسته‌بندی و نشانی فروشگاه را کامل کنید.",
      );
    const lat = b.lat === "" || b.lat == null ? null : Number(b.lat),
      lng = b.lng === "" || b.lng == null ? null : Number(b.lng);
    const fee = Math.floor(Number(b.fee ?? store.fee)),
      minBasket = Math.floor(Number(b.minBasket ?? store.min_basket));
    if (
      (lat !== null && (!Number.isFinite(lat) || Math.abs(lat) > 90)) ||
      (lng !== null && (!Number.isFinite(lng) || Math.abs(lng) > 180))
    )
      return fail(res, 400, "invalid_location", "موقعیت جغرافیایی معتبر نیست.");
    if (
      !Number.isSafeInteger(fee) ||
      fee < 0 ||
      !Number.isSafeInteger(minBasket) ||
      minBasket < 0
    )
      return fail(
        res,
        400,
        "invalid_store_pricing",
        "هزینه ارسال و حداقل سبد باید عدد معتبر و نامنفی باشند.",
      );
    if (files.logo?.[0]) {
      try {
        await normalizeImage(files.logo[0], true);
      } catch {
        removeFiles(files);
        return fail(res, 400, "invalid_image", "تصویر لوگو معتبر نیست.");
      }
    }
    await db.run(
      `UPDATE stores SET name=?, type=?, category=?, area=?, address=?, lat=?, lng=?, hours=?, fee=?, min_basket=?,
       logo_url=COALESCE(?, logo_url) WHERE id=? AND seller_id=?`,
      [
        name,
        category === "hypermarket" ? "hypermarket" : "supermarket",
        category,
        address.slice(0, 180),
        address,
        lat,
        lng,
        text(b.hours, 160),
        fee,
        minBasket,
        publicFile(files.logo?.[0]),
        store.id,
        req.seller.id,
      ],
    );
    const updated = await sellerStore(req.seller.id);
    res.json({ store: mapStore(updated) });
  } catch (error) {
    removeFiles(files);
    next(error);
  }
}

router.get("/products", async (req, res) => {
  const rows = await db.all(
    "SELECT * FROM products WHERE seller_id = ? ORDER BY id DESC",
    [req.seller.id],
  );
  res.json({ products: rows.map(mapProduct) });
});
router.get("/product-bank", async (_req, res) =>
  res.json({
    products: (
      await db.all(
        "SELECT id,name,category,unit,image_url,base_price,max_discount,stock FROM master_products WHERE active=1 ORDER BY name",
      )
    ).map((p) => ({ ...p, imageUrl: p.image_url })),
  }),
);
router.post("/products", async (req, res) => {
  const masterId = Number(req.body?.masterId),
    price = Number(req.body?.price);
  if (!Number.isSafeInteger(masterId) || masterId < 1)
    return fail(res, 400, "invalid_master", "محصول بانک را انتخاب کنید.");
  if (
    Object.keys(req.body || {}).some((k) => !["masterId", "price"].includes(k))
  )
    return fail(
      res,
      400,
      "forbidden_fields",
      "ثبت اطلاعات اصلی کالا مجاز نیست.",
    );
  if (!Number.isSafeInteger(price) || price < 1)
    return fail(res, 400, "invalid_price", "قیمت معتبر نیست.");
  const master = await db.get(
    "SELECT * FROM master_products WHERE id=? AND active=1",
    [masterId],
  );
  const store = await sellerStore(req.seller.id);
  if (!master || !store)
    return fail(res, 404, "missing", "کالا یا فروشگاه پیدا نشد.");
  try {
    const id = await db.transaction(async (tx) => {
      const current = await tx.get(
        "SELECT * FROM master_products WHERE id=? AND active=1 FOR UPDATE",
        [masterId],
      );
      if (!current)
        throw Object.assign(new Error("کالا غیرفعال شده است."), {
          status: 409,
        });
      const id = await allocateId(tx, "product");
      await tx.run(
        "INSERT INTO products (id,name,category,unit,image_url,price,stock,seller_id,store_id,master_product_id,active,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
        [
          id,
          current.name,
          current.category,
          current.unit,
          current.image_url,
          price,
          current.stock,
          req.seller.id,
          store.id,
          master.id,
          1,
          new Date().toISOString(),
        ],
      );
      return id;
    });
    res
      .status(201)
      .json({
        product: mapProduct(
          await db.get("SELECT * FROM products WHERE id=?", [id]),
        ),
      });
  } catch (e) {
    if (e.status) return fail(res, e.status, e.code || "conflict", e.message);
    if (e.code === "ER_DUP_ENTRY")
      return fail(res, 409, "exists", "این کالا قبلاً انتخاب شده است.");
    throw e;
  }
});
router.patch("/products/:id", async (req, res) => {
  const b = req.body ?? {};
  if (Object.keys(b).some((k) => !["price", "discountPercent"].includes(k)))
    return fail(
      res,
      400,
      "forbidden_fields",
      "فقط قیمت و تخفیف قابل تغییر است.",
    );
  const product = await db.get(
    "SELECT * FROM products WHERE id=? AND seller_id=?",
    [req.params.id, req.seller.id],
  );
  if (!product) return fail(res, 404, "product_missing", "کالا پیدا نشد.");
  try {
    const updated = await db.transaction(async (tx) => {
      const master = await tx.get(
        "SELECT max_discount FROM master_products WHERE id=? AND active=1 FOR UPDATE",
        [product.master_product_id],
      );
      if (!master)
        throw Object.assign(new Error("کالا توسط مدیریت غیرفعال شده است."), {
          status: 409,
          code: "inactive_product",
        });
      const live = await tx.get(
        "SELECT * FROM products WHERE id=? AND seller_id=? FOR UPDATE",
        [product.id, req.seller.id],
      );
      const { price, oldPrice } = sellerPrice(
        Number(b.price ?? live.old_price ?? live.price),
        Number(b.discountPercent ?? 0),
        Number(master.max_discount),
      );
      await tx.run(
        "UPDATE products SET price=?,old_price=? WHERE id=? AND seller_id=?",
        [price, oldPrice, product.id, req.seller.id],
      );
      return tx.get("SELECT * FROM products WHERE id=?", [product.id]);
    });
    res.json({ product: mapProduct(updated) });
  } catch (e) {
    if (e.status) return fail(res, e.status, e.code, e.message);
    throw e;
  }
});
router.delete("/products/:id", (_req, res) =>
  fail(
    res,
    403,
    "forbidden",
    "حذف و غیرفعال کردن کالا فقط توسط مدیریت انجام می‌شود.",
  ),
);

router.get("/promotions", async (req, res) => {
  const rows = await db.all(
    "SELECT * FROM seller_promos WHERE seller_id = ? ORDER BY created_at DESC",
    [req.seller.id],
  );
  res.json({ promotions: rows.map(mapPromo) });
});
router.post("/promotions", async (req, res) => {
  const store = await sellerStore(req.seller.id),
    b = req.body ?? {};
  if (!store) return fail(res, 404, "store_missing", "فروشگاه پیدا نشد.");
  const code = text(b.code, 40)
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, "");
  const title = text(b.title, 180),
    description = text(b.description, 255);
  const kind = b.kind === "percent" ? "percent" : "fixed";
  const amount = Math.floor(Number(b.amount)),
    minSubtotal = Math.floor(Number(b.minSubtotal ?? 0));
  const maxDiscount = Math.floor(Number(b.maxDiscount ?? 0));
  if (
    !/^[A-Z0-9_-]{3,40}$/.test(code) ||
    !title ||
    !Number.isSafeInteger(amount) ||
    amount < 1 ||
    (kind === "percent" && amount > 100) ||
    !Number.isSafeInteger(minSubtotal) ||
    minSubtotal < 0 ||
    !Number.isSafeInteger(maxDiscount) ||
    maxDiscount < 0
  )
    return fail(
      res,
      400,
      "invalid_promotion",
      "کد، عنوان و مبلغ تخفیف را بررسی کنید.",
    );
  const expiryDate = b.expiresAt ? new Date(b.expiresAt) : null;
  if (expiryDate && !Number.isFinite(expiryDate.getTime()))
    return fail(
      res,
      400,
      "invalid_expiration",
      "تاریخ پایان کد تخفیف معتبر نیست.",
    );
  const expiresAt = expiryDate?.toISOString() ?? null;
  try {
    const result = await db.run(
      `INSERT INTO seller_promos (seller_id, store_id, code, title, description, kind, amount, min_subtotal, max_discount, active, expires_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
      [
        req.seller.id,
        store.id,
        code,
        title,
        description,
        kind,
        amount,
        minSubtotal,
        maxDiscount,
        expiresAt,
        new Date().toISOString(),
      ],
    );
    res
      .status(201)
      .json({
        promotion: mapPromo(
          await db.get("SELECT * FROM seller_promos WHERE id = ?", [
            result.insertId,
          ]),
        ),
      });
  } catch (error) {
    if (error?.code === "ER_DUP_ENTRY")
      return fail(
        res,
        409,
        "promotion_exists",
        "این کد قبلاً برای فروشگاه شما ثبت شده است.",
      );
    throw error;
  }
});
router.delete("/promotions/:id", async (req, res) => {
  const result = await db.run(
    "DELETE FROM seller_promos WHERE id = ? AND seller_id = ?",
    [Number(req.params.id), req.seller.id],
  );
  if (!result.affectedRows)
    return fail(res, 404, "promotion_missing", "کد تخفیف پیدا نشد.");
  res.json({ ok: true });
});

router.get("/orders", async (req, res) => {
  const store = await sellerStore(req.seller.id);
  if (!store) return fail(res, 404, "store_missing", "فروشگاه پیدا نشد.");
  const rows = await db.all(
    `SELECT o.*, u.phone AS customer_phone, CONCAT_WS(' ', u.first_name, u.last_name) AS customer_name
     FROM orders o JOIN users u ON u.id=o.user_id WHERE o.store_id=? ORDER BY o.created_at DESC`,
    [store.id],
  );
  res.json({
    orders: rows.map((r) => ({
      ...mapOrder(r),
      items: parseItems(r.items),
      addressText: r.address_text,
      paymentStatus: r.payment_status ?? "unpaid",
      customer: { name: r.customer_name || "مشتری", phone: r.customer_phone },
    })),
  });
});
router.patch("/orders/:id/status", async (req, res) => {
  const store = await sellerStore(req.seller.id),
    next = Number(req.body?.status);
  if (![2, 3].includes(next))
    return fail(
      res,
      400,
      "invalid_status",
      "فروشنده فقط می‌تواند آماده‌سازی و آماده تحویل را ثبت کند.",
    );
  const changed = await db.transaction(async (tx) => {
    const result = await tx.run(
      "UPDATE orders SET status=? WHERE id=? AND store_id=? AND status=?",
      [next, req.params.id, store?.id ?? 0, next - 1],
    );
    if (result.affectedRows)
      await recordOrderEvent(tx, req.params.id, next, "seller", req.seller.id);
    return result.affectedRows;
  });
  if (!changed)
    return fail(
      res,
      409,
      "order_status_conflict",
      "وضعیت سفارش تغییر کرده است.",
    );
  const row = await db.get("SELECT * FROM orders WHERE id = ?", [
    req.params.id,
  ]);
  res.json({ order: mapOrder(row) });
});

export default router;

import { dispatchStatus } from "../dispatch-status.js";
import { promoDateBound, releasePromo } from "../promos.js";
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
  walletMovement,
} from "../db.js";
import {
  hashPassword,
  normalizePhone,
  verifyPassword,
  loginThrottle,
} from "../auth.js";
import { requireSellerAuth, createSellerSession } from "../seller-auth.js";
import {
  decryptSellerValue,
  encryptSellerValue,
} from "../seller-security.js";

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
    res.status(201).json({
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
/** اطلاعات حساب فروشنده: شبا/کارت برای مالک قابل مشاهده و تغییر است. */
router.get("/account", async (req, res) => {
  const account = await db.get("SELECT * FROM seller_accounts WHERE id = ?", [
    req.seller.id,
  ]);
  const [earnings, ledger] = await Promise.all([
    db.get(
      "SELECT COALESCE(SUM(amount),0) AS deliveryEarnings, COUNT(*) AS deliveryCount FROM seller_ledger WHERE seller_id=? AND kind='delivery_fee'",
      [req.seller.id],
    ),
    db.all(
      "SELECT order_id, amount, created_at FROM seller_ledger WHERE seller_id=? ORDER BY id DESC LIMIT 100",
      [req.seller.id],
    ),
  ]);
  res.json({
    ownerName: account.owner_name,
    phone: account.phone,
    iban: decryptSellerValue(account.iban_enc),
    card: decryptSellerValue(account.card_enc),
    // هزینهٔ ارسال سفارش‌های «خودم ارسال می‌کنم» به حساب فروشنده می‌نشیند.
    deliveryEarnings: Number(earnings?.deliveryEarnings ?? 0),
    deliveryCount: Number(earnings?.deliveryCount ?? 0),
    ledger,
  });
});
router.patch("/account", async (req, res) => {
  const sets = [];
  const args = [];
  if (req.body?.iban !== undefined) {
    const iban = String(req.body.iban ?? "")
      .replace(/\s/g, "")
      .toUpperCase();
    if (iban && !/^IR\d{24}$/.test(iban))
      return fail(res, 400, "invalid_iban", "شماره شبا باید با IR و ۲۴ رقم باشد.");
    sets.push("iban_enc=?");
    args.push(encryptSellerValue(iban));
  }
  if (req.body?.card !== undefined) {
    const card = String(req.body.card ?? "").replace(/\D/g, "");
    if (card && !/^\d{16}$/.test(card))
      return fail(res, 400, "invalid_card", "شماره کارت باید ۱۶ رقم باشد.");
    sets.push("card_enc=?");
    args.push(encryptSellerValue(card));
  }
  if (!sets.length)
    return fail(
      res,
      400,
      "empty_account_update",
      "مقداری برای به‌روزرسانی ارسال نشده است.",
    );
  args.push(req.seller.id);
  await db.run(
    `UPDATE seller_accounts SET ${sets.join(", ")} WHERE id=?`,
    args,
  );
  res.json({ ok: true });
});
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
/* ثبت فقط موقعیت فروشگاه — بدون نیاز به پر بودن بقیهٔ فرم؛
   برای دکمهٔ «ثبت موقعیت» و «انتخاب روی نقشه». */
router.patch("/store/location", async (req, res) => {
  const store = await sellerStore(req.seller.id);
  if (!store) return fail(res, 404, "store_missing", "فروشگاه پیدا نشد.");
  const lat = Number((req.body ?? {}).lat),
    lng = Number((req.body ?? {}).lng);
  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    Math.abs(lat) > 90 ||
    Math.abs(lng) > 180
  )
    return fail(res, 400, "invalid_location", "موقعیت جغرافیایی معتبر نیست.");
  await db.run("UPDATE stores SET lat=?, lng=? WHERE id=? AND seller_id=?", [
    lat,
    lng,
    store.id,
    req.seller.id,
  ]);
  res.json({ ok: true, lat, lng });
});
/* باز/بسته بودن فروشگاه: وقتی فروشنده «بسته‌ایم» را انتخاب می‌کند، سفارش
   جدیدی به فروشگاه نمی‌رسد و در واگذاری خودکار سفارش‌های بی‌پاسخ هم نادیده
   گرفته می‌شود. */
router.patch("/store/open", async (req, res) => {
  const store = await sellerStore(req.seller.id);
  if (!store) return fail(res, 404, "store_missing", "فروشگاه پیدا نشد.");
  const open = Boolean((req.body ?? {}).open);
  await db.run("UPDATE stores SET is_open=? WHERE id=? AND seller_id=?", [
    open ? 1 : 0,
    store.id,
    req.seller.id,
  ]);
  const updated = await sellerStore(req.seller.id);
  res.json({ store: mapStore(updated) });
});
/* پیکربندی «خرید اول» فروشگاه: چند کالا، درصد تخفیف (۲۵٪ به بالا) و حداقل
   مبلغ سبد. مشتری فقط یکی از این کالاها را با تخفیف انتخاب می‌کند. */
router.get("/first-offer", async (req, res) => {
  const store = await sellerStore(req.seller.id);
  if (!store) return fail(res, 404, "store_missing", "فروشگاه پیدا نشد.");
  const offer = await db.get(
    "SELECT * FROM store_first_offers WHERE store_id=?",
    [store.id],
  );
  const rows = offer
    ? await db.all(
        "SELECT product_id FROM store_first_offer_products WHERE offer_id=?",
        [offer.id],
      )
    : [];
  res.json({
    offer: offer
      ? {
          percent: Number(offer.percent),
          minBasket: Number(offer.min_basket),
          active: Boolean(offer.active),
          productIds: rows.map((r) => Number(r.product_id)),
        }
      : null,
  });
});
router.put("/first-offer", async (req, res) => {
  const store = await sellerStore(req.seller.id);
  if (!store) return fail(res, 404, "store_missing", "فروشگاه پیدا نشد.");
  const b = req.body ?? {};
  const percent = Math.floor(Number(b.percent));
  const minBasket = Math.floor(Number(b.minBasket));
  const active = Boolean(b.active);
  const productIds = [...new Set((Array.isArray(b.productIds) ? b.productIds : []).map(Number))].filter(
    (id) => Number.isInteger(id) && id > 0,
  );
  if (!Number.isInteger(percent) || percent < 25 || percent > 100)
    return fail(
      res,
      400,
      "invalid_percent",
      "درصد تخفیف خرید اول باید بین ۲۵ تا ۱۰۰ باشد.",
    );
  if (!Number.isInteger(minBasket) || minBasket < 0)
    return fail(res, 400, "invalid_min_basket", "حداقل خرید معتبر نیست.");
  if (active && !productIds.length)
    return fail(
      res,
      400,
      "products_required",
      "دست‌کم یک کالا برای پیشنهاد خرید اول انتخاب کنید.",
    );
  if (productIds.length > 30)
    return fail(
      res,
      400,
      "too_many_products",
      "حداکثر ۳۰ کالا برای خرید اول می‌توان انتخاب کرد.",
    );
  const placeholders = productIds.map(() => "?").join(",");
  const owned = await db.all(
    `SELECT id FROM products WHERE seller_id=? AND store_id=? AND id IN (${placeholders})`,
    [req.seller.id, store.id, ...productIds],
  );
  if (owned.length !== productIds.length)
    return fail(
      res,
      400,
      "products_not_mine",
      "همهٔ کالاهای انتخابی باید از عرضهٔ همین فروشگاه باشند.",
    );
  await db.transaction(async (tx) => {
    const result = await tx.run(
      `INSERT INTO store_first_offers (store_id, seller_id, percent, min_basket, active, created_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE percent=VALUES(percent), min_basket=VALUES(min_basket), active=VALUES(active)`,
      [
        store.id,
        req.seller.id,
        percent,
        minBasket,
        active ? 1 : 0,
        new Date().toISOString(),
      ],
    );
    const offer = await tx.get(
      "SELECT id FROM store_first_offers WHERE store_id=?",
      [store.id],
    );
    await tx.run("DELETE FROM store_first_offer_products WHERE offer_id=?", [
      offer.id,
    ]);
    for (const productId of productIds)
      await tx.run(
        "INSERT INTO store_first_offer_products (offer_id, product_id) VALUES (?, ?)",
        [offer.id, productId],
      );
    return result;
  });
  res.json({
    offer: { percent, minBasket, active, productIds },
  });
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
router.post("/products/bulk", async (req, res) => {
  const ids = [...new Set(req.body?.masterIds || [])].map(Number);
  if (
    !ids.length ||
    ids.length > 100 ||
    ids.some((id) => !Number.isSafeInteger(id) || id < 1)
  )
    return fail(
      res,
      400,
      "invalid_selection",
      "بین یک تا صد کالا انتخاب کنید.",
    );
  const store = await sellerStore(req.seller.id);
  if (!store) return fail(res, 404, "store_missing", "فروشگاه پیدا نشد.");
  const products = await db.transaction(async (tx) => {
    const added = [];
    for (const id of ids.sort((a, b) => a - b)) {
      const m = await tx.get(
        "SELECT * FROM master_products WHERE id=? AND active=1 FOR UPDATE",
        [id],
      );
      if (!m)
        throw Object.assign(new Error("کالای انتخاب‌شده غیرفعال است."), {
          status: 409,
        });
      if (
        await tx.get(
          "SELECT id FROM products WHERE store_id=? AND master_product_id=?",
          [store.id, id],
        )
      )
        continue;
      const productId = await allocateId(tx, "product");
      await tx.run(
        "INSERT INTO products (id,name,category,unit,image_url,price,stock,seller_id,store_id,master_product_id,active,created_at) VALUES (?,?,?,?,?,?,0,?,?,?,?,?)",
        [
          productId,
          m.name,
          m.category,
          m.unit,
          m.image_url,
          Math.max(1, Number(m.base_price)),
          req.seller.id,
          store.id,
          id,
          1,
          new Date().toISOString(),
        ],
      );
      added.push(
        mapProduct(
          await tx.get("SELECT * FROM products WHERE id=?", [productId]),
        ),
      );
    }
    return added;
  });
  res.status(201).json({ products });
});
router.post("/products", async (req, res) => {
  const masterId = Number(req.body?.masterId),
    price = Number(req.body?.price);
  if (!Number.isSafeInteger(masterId) || masterId < 1)
    return fail(res, 400, "invalid_master", "محصول بانک را انتخاب کنید.");
  if (
    Object.keys(req.body || {}).some(
      (k) => !["masterId", "price", "stock"].includes(k),
    )
  )
    return fail(
      res,
      400,
      "forbidden_fields",
      "ثبت اطلاعات اصلی کالا مجاز نیست.",
    );
  if (
    !Number.isSafeInteger(Number(req.body.stock ?? 0)) ||
    Number(req.body.stock ?? 0) < 0
  )
    return fail(res, 400, "invalid_stock", "موجودی معتبر نیست.");
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
          Number(req.body.stock ?? 0),
          req.seller.id,
          store.id,
          master.id,
          1,
          new Date().toISOString(),
        ],
      );
      return id;
    });
    res.status(201).json({
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
  if (
    Object.keys(b).some(
      (k) => !["price", "discountPercent", "stock"].includes(k),
    )
  )
    return fail(
      res,
      400,
      "forbidden_fields",
      "فقط قیمت، تخفیف و موجودی قابل تغییر است.",
    );
  if (
    b.stock !== undefined &&
    (!Number.isSafeInteger(Number(b.stock)) || Number(b.stock) < 0)
  )
    return fail(res, 400, "invalid_stock", "موجودی معتبر نیست.");
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
        "UPDATE products SET price=?,old_price=?,stock=? WHERE id=? AND seller_id=?",
        [
          price,
          oldPrice,
          Number(b.stock ?? live.stock),
          product.id,
          req.seller.id,
        ],
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
  // Every store code is single-use by default; `0` explicitly means unlimited.
  const maxUses =
    b.maxUses === undefined || b.maxUses === null || b.maxUses === ""
      ? 1
      : Math.floor(Number(b.maxUses));
  if (
    !/^[A-Z0-9_-]{3,40}$/.test(code) ||
    !title ||
    !Number.isSafeInteger(amount) ||
    amount < 1 ||
    (kind === "percent" && amount > 100) ||
    !Number.isSafeInteger(minSubtotal) ||
    minSubtotal < 0 ||
    !Number.isSafeInteger(maxDiscount) ||
    maxDiscount < 0 ||
    !Number.isSafeInteger(maxUses) ||
    maxUses < 0 ||
    maxUses > 1000000
  )
    return fail(
      res,
      400,
      "invalid_promotion",
      "کد، عنوان، مبلغ تخفیف و تعداد مجاز مصرف را بررسی کنید.",
    );
  const expiresAt = promoDateBound(b.expiresAt, "end");
  if (expiresAt === undefined)
    return fail(
      res,
      400,
      "invalid_expiration",
      "تاریخ پایان کد تخفیف معتبر نیست.",
    );
  if (expiresAt && expiresAt <= new Date().toISOString())
    return fail(
      res,
      400,
      "expired_promotion",
      "تاریخ پایان کد تخفیف گذشته است؛ امروز یا بعد از آن را انتخاب کنید.",
    );
  try {
    const result = await db.run(
      `INSERT INTO seller_promos (seller_id, store_id, code, title, description, kind, amount, min_subtotal, max_discount, active, expires_at, max_uses, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`,
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
        maxUses,
        new Date().toISOString(),
      ],
    );
    res.status(201).json({
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
    `SELECT o.*, s.lat AS store_lat,s.lng AS store_lng, (SELECT d.courier_id FROM order_deliveries d WHERE d.order_id=o.id) AS assigned_courier_id,
     COALESCE(o.dispatch_started_at,(SELECT MIN(e.created_at) FROM order_events e WHERE e.order_id COLLATE utf8mb4_unicode_ci=o.id COLLATE utf8mb4_unicode_ci AND e.status=3),o.created_at) AS search_started_at,
     u.phone AS customer_phone, CONCAT_WS(' ', u.first_name, u.last_name) AS customer_name
     FROM orders o JOIN stores s ON s.id=o.store_id JOIN users u ON u.id=o.user_id WHERE o.store_id=? ORDER BY o.created_at DESC`,
    [store.id],
  );
  const couriers = await db.all(
    `SELECT c.id,c.lat,c.lng FROM courier_accounts c WHERE c.active=1 AND c.verification_status='approved' AND c.online=1 AND NOT EXISTS(SELECT 1 FROM order_deliveries d WHERE d.courier_id=c.id AND d.completed_at IS NULL AND d.trip_status NOT IN ('cancelled','failed'))`,
    [],
  );
  const declines = await db.all(
    `SELECT d.* FROM courier_declined_orders d JOIN orders o ON o.id COLLATE utf8mb4_unicode_ci=d.order_id COLLATE utf8mb4_unicode_ci WHERE o.store_id=? AND o.status=3 AND d.created_at>?`,
    [store.id, new Date(Date.now() - 5 * 60000).toISOString()],
  );
  res.json({
    orders: rows.map((r) => ({
      dispatch: dispatchStatus(r, couriers, declines),
      ...mapOrder(r),
      courierAssigned: r.assigned_courier_id != null,
      dispatchStartedAt: r.search_started_at,
      dispatchTimedOut:
        r.status === 3 &&
        r.assigned_courier_id == null &&
        Date.now() - Date.parse(r.search_started_at) >= 15 * 60000,
      items: parseItems(r.items),
      addressText: r.address_text,
      // لوکیشن دقیق مشتری تا فروشنده هنگام ارسال به مشکل نخورد.
      addressLat: r.destination_lat == null ? null : Number(r.destination_lat),
      addressLng: r.destination_lng == null ? null : Number(r.destination_lng),
      addressCity: r.address_city ?? "",
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
      "UPDATE orders SET status=?,dispatch_paused=0,dispatch_started_at=CASE WHEN ?=3 THEN ? ELSE dispatch_started_at END WHERE id=? AND store_id=? AND status=?",
      [
        next,
        next,
        new Date().toISOString(),
        req.params.id,
        store?.id ?? 0,
        next - 1,
      ],
    );
    if (result.affectedRows) {
      // سفارش‌های خارج از نظرآباد به «پیک‌های پلتفرم» پیشنهاد نمی‌شوند؛
      // فروشنده خودش ارسال می‌کند یا سفارش را رد می‌کند.
      if (next === 3)
        await tx.run(
          "UPDATE orders SET dispatch_paused=1 WHERE id=? AND delivery_mode='courier' AND address_city NOT IN ('','نظرآباد')",
          [req.params.id],
        );
      await recordOrderEvent(tx, req.params.id, next, "seller", req.seller.id);
    }
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

const rejectReasons = {
  stock: "کالا در فروشگاه تمام شده است.",
  closed: "امروز باز نیستیم.",
  capacity: "ظرفیت آماده‌سازی امروز پر شده است.",
  area: "ارسال به این آدرس برای ما ممکن نیست.",
  other: "فروشگاه نتوانست این سفارش را انجام دهد.",
};

/**
 * A store that cannot fulfil an order says so here, while the basket is still
 * its own responsibility: status 1 (just placed) or 2 (being prepared). The row
 * goes to 0 with the reason attached, the stock returns to the shelf and a
 * single-use code comes back to the account — otherwise the customer would be
 * left with a code they can no longer spend for a basket nobody delivered.
 * The money of the order is credited to the customer's wallet in the same
 * transaction and stays there until the customer spends it.
 */
router.post("/orders/:id/reject", async (req, res) => {
  const store = await sellerStore(req.seller.id);
  const key = String(req.body?.reason ?? "").trim();
  const note = String(req.body?.note ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, 140);
  const reason = [rejectReasons[key] ?? rejectReasons.other, note]
    .filter(Boolean)
    .join(" ");
  const id = String(req.params.id);
  const row = await db.get("SELECT * FROM orders WHERE id=? AND store_id=?", [
    id,
    store?.id ?? 0,
  ]);
  if (!row)
    return fail(res, 404, "not_found", "این سفارش به این فروشگاه نیست.");
  // سفارش آماده (وضعیت ۳) هم تا وقتی سفیری نپذیرفته قابل رد است.
  const assigned = await db.get(
    "SELECT order_id FROM order_deliveries WHERE order_id=?",
    [id],
  );
  const rejectable =
    [1, 2].includes(Number(row.status)) ||
    (Number(row.status) === 3 && !assigned);
  if (!rejectable)
    return fail(
      res,
      409,
      "not_rejectable",
      "فقط سفارشی که هنوز به سفیر تحویل نشده قابل رد کردن است.",
    );
  const items = Array.isArray(row.items)
    ? row.items
    : JSON.parse(row.items || "[]");
  const done = await db.transaction(async (tx) => {
    const changed = await tx.run(
      `UPDATE orders SET status=0, rejected_by='seller', reject_reason=?,
        dispatch_paused=1 WHERE id=? AND store_id=? AND status IN (1,2,3)`,
      [reason, id, store?.id ?? 0],
    );
    if (!changed.affectedRows) return false;
    await tx.run("UPDATE courier_offers SET state='cancelled' WHERE order_id=?", [
      id,
    ]);
    await recordOrderEvent(tx, id, 0, "seller", req.seller.id);
    await releasePromo(tx, id);
    for (const item of items)
      await tx.run("UPDATE products SET stock=stock+? WHERE id=?", [
        Number(item.qty),
        Number(item.id),
      ]);
    // The order's money belongs to the customer: it is credited to the wallet
    // and remains there until the customer spends it on another order. The
    // ledger row is unique per (order, kind), so a retry can never credit twice.
    await walletMovement(tx, {
      userId: Number(row.user_id),
      orderId: row.id,
      kind: "cancel_refund",
      amount: Number(row.total),
      note: "بازگشت مبلغ سفارش لغوشده توسط فروشگاه به کیف پول",
    });
    if (row.payment_status === "paid")
      await tx.run("UPDATE orders SET payment_status='refunded' WHERE id=?", [
        row.id,
      ]);
    return true;
  });
  if (!done)
    return fail(
      res,
      409,
      "order_status_conflict",
      "وضعیت سفارش تغییر کرده است.",
    );
  res.json({
    order: mapOrder(await db.get("SELECT * FROM orders WHERE id=?", [id])),
  });
});

router.post("/orders/:id/dispatch", async (req, res) => {
  if (!["retry", "stop"].includes(req.body?.action))
    return fail(res, 400, "invalid_action", "عملیات نامعتبر است.");
  const store = await sellerStore(req.seller.id);
  const ok = await db.transaction(async (tx) => {
    const o = await tx.get(
      "SELECT * FROM orders WHERE id=? AND store_id=? FOR UPDATE",
      [req.params.id, store?.id ?? 0],
    );
    if (!o || Number(o.status) !== 3 || o.delivery_mode !== "courier")
      return false;
    if (
      await tx.get(
        "SELECT order_id FROM order_deliveries WHERE order_id=? FOR UPDATE",
        [o.id],
      )
    )
      return false;
    if (req.body.action === "retry") {
      await tx.run(
        "UPDATE orders SET dispatch_paused=0,dispatch_started_at=? WHERE id=?",
        [new Date().toISOString(), o.id],
      );
      await tx.run("DELETE FROM courier_declined_orders WHERE order_id=?", [
        o.id,
      ]);
      await tx.run(
        "UPDATE courier_offers SET state='pending' WHERE order_id=?",
        [o.id],
      );
    } else {
      await tx.run("UPDATE orders SET dispatch_paused=1 WHERE id=?", [o.id]);
      await tx.run(
        "UPDATE courier_offers SET state='cancelled' WHERE order_id=?",
        [o.id],
      );
    }
    return true;
  });
  if (!ok)
    return fail(
      res,
      409,
      "dispatch_conflict",
      "سفارش آماده نیست یا سفیر آن را پذیرفته است.",
    );
  res.json({
    order: mapOrder(
      await db.get("SELECT * FROM orders WHERE id=?", [req.params.id]),
    ),
  });
});

// Self delivery is an explicit store choice, never a courier trip or earnings event.
router.post("/orders/:id/self-delivery", async (req, res) => {
  const store = await sellerStore(req.seller.id);
  const ok = await db.transaction(async (tx) => {
    const o = await tx.get(
      "SELECT * FROM orders WHERE id=? AND store_id=? FOR UPDATE",
      [req.params.id, store?.id ?? 0],
    );
    if (!o) return false;
    if (o.delivery_mode === "seller" && [4, 5].includes(Number(o.status)))
      return true;
    if (Number(o.status) !== 3) return false;
    const d = await tx.get(
      "SELECT order_id FROM order_deliveries WHERE order_id=? FOR UPDATE",
      [o.id],
    );
    if (d) return false;
    await tx.run(
      "UPDATE orders SET delivery_mode='seller',status=4 WHERE id=?",
      [o.id],
    );
    await tx.run(
      "UPDATE courier_offers SET state='cancelled' WHERE order_id=?",
      [o.id],
    );
    await recordOrderEvent(tx, o.id, 4, "seller", req.seller.id);
    return true;
  });
  if (!ok)
    return fail(
      res,
      409,
      "self_delivery_conflict",
      "سفارش آماده نیست یا سفیر آن را پذیرفته است؛ فهرست را تازه‌سازی کنید.",
    );
  res.json({
    order: mapOrder(
      await db.get("SELECT * FROM orders WHERE id=?", [req.params.id]),
    ),
  });
});
router.post("/orders/:id/self-delivery/complete", async (req, res) => {
  const store = await sellerStore(req.seller.id);
  const ok = await db.transaction(async (tx) => {
    const o = await tx.get(
      "SELECT * FROM orders WHERE id=? AND store_id=? FOR UPDATE",
      [req.params.id, store?.id ?? 0],
    );
    // «دریافت حضوری» هم با همین دکمه تحویل داده می‌شود: مشتری در فروشگاه
    // بسته را می‌گیرد و فروشنده سفارش را تکمیل می‌کند.
    if (!o || !["seller", "pickup"].includes(o.delivery_mode)) return false;
    if (Number(o.status) === 5) return true;
    if (o.delivery_mode === "pickup") {
      if (![3, 4].includes(Number(o.status))) return false;
    } else if (Number(o.status) !== 4) return false;
    await tx.run("UPDATE orders SET status=5 WHERE id=?", [o.id]);
    // هزینهٔ پیکِ سفارش‌های «خودم ارسال می‌کنم» به حساب فروشنده می‌نشیند.
    const fee = Number(o.courier_fee ?? o.delivery ?? 0);
    if (o.delivery_mode === "seller" && Number.isSafeInteger(fee) && fee > 0)
      await tx.run(
        "INSERT IGNORE INTO seller_ledger (seller_id, order_id, kind, amount, created_at) VALUES (?, ?, 'delivery_fee', ?, ?)",
        [req.seller.id, o.id, fee, new Date().toISOString()],
      );
    await recordOrderEvent(tx, o.id, 5, "seller", req.seller.id);
    return true;
  });
  if (!ok)
    return fail(
      res,
      409,
      "self_delivery_conflict",
      "فقط سفارش در حال ارسال توسط همین فروشگاه قابل تأیید است.",
    );
  res.json({
    order: mapOrder(
      await db.get("SELECT * FROM orders WHERE id=?", [req.params.id]),
    ),
  });
});

router.use((_req, res) =>
  fail(
    res,
    404,
    "seller_route_not_found",
    "این مسیر فروشنده در نسخهٔ فعلی بک‌اند وجود ندارد؛ بک‌اند را به‌روزرسانی و دوباره راه‌اندازی کنید.",
  ),
);
export default router;

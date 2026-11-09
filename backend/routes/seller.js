import { Router } from "express";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import multer from "multer";
import { db, allocateId, mapProduct, mapStore, mapOrder, mapPromo } from "../db.js";
import { hashPassword, normalizePhone, verifyPassword, loginThrottle } from "../auth.js";
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
    const ext = file.mimetype === "image/png" ? ".png" : file.mimetype === "image/webp" ? ".webp" : ".jpg";
    done(null, `${crypto.randomUUID()}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024, files: 2 },
  fileFilter: (_req, file, done) => done(null, imageTypes.has(file.mimetype)),
});
const registrationImages = upload.fields([{ name: "storePhoto", maxCount: 1 }, { name: "logo", maxCount: 1 }]);
const storeImages = upload.fields([{ name: "storePhoto", maxCount: 1 }, { name: "logo", maxCount: 1 }]);
const oneProductImage = upload.single("image");
const fail = (res, status, code, message) => res.status(status).json({ error: { code, message } });
const text = (value, max = 255) => String(value ?? "").trim().slice(0, max);
const digits = (value) => String(value ?? "").replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d))).replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d))).replace(/\D/g, "");
const publicFile = (file) => file ? `/api/uploads/${file.filename}` : null;
const removeFiles = (files) => Object.values(files ?? {}).flat().forEach((f) => fs.promises.unlink(f.path).catch(() => {}));
const productCategories = new Set(["drinks", "dairy", "snacks", "grocery", "fresh", "protein", "bakery", "hygiene", "other"]);
const storeCategories = new Set(["supermarket", "hypermarket", "produce", "bakery", "other"]);
const parseItems = (v) => { try { return typeof v === "string" ? JSON.parse(v) : v; } catch { return []; } };

async function sellerStore(sellerId, tx = db) {
  return tx.get("SELECT * FROM stores WHERE seller_id = ? LIMIT 1", [sellerId]);
}
function sellerPayload(account, store) {
  return {
    id: Number(account.id), ownerName: account.owner_name, phone: account.phone,
    hasNationalId: Boolean(account.national_id_enc), hasIban: Boolean(account.iban_enc),
    store: store ? mapStore(store) : null,
  };
}
function responseFor(account, store) { return { seller: sellerPayload(account, store) }; }
function validateIban(input) { return /^IR\d{24}$/.test(String(input).replace(/\s/g, "").toUpperCase()); }
function validIranianNationalId(input) {
  if (!/^\d{10}$/.test(input) || /^(\d)\1{9}$/.test(input)) return false;
  const digitsArray = [...input].map(Number);
  const sum = digitsArray.slice(0, 9).reduce((total, digit, index) => total + digit * (10 - index), 0);
  const remainder = sum % 11;
  return (remainder < 2 ? remainder : 11 - remainder) === digitsArray[9];
}

router.post("/auth/register", (req, res, next) => registrationImages(req, res, (err) => err ? next(err) : registerSeller(req, res, next)));
async function registerSeller(req, res, next) {
  const files = req.files ?? {};
  try {
    const reject = (status, code, message) => { removeFiles(files); return fail(res, status, code, message); };
    const body = req.body ?? {};
    const phone = normalizePhone(body.phone), nationalId = digits(body.nationalId), iban = String(body.iban ?? "").replace(/\s/g, "").toUpperCase();
    const ownerName = text(body.ownerName, 120), shopName = text(body.shopName, 160), category = text(body.category, 40);
    const address = text(body.address, 500), password = String(body.password ?? "");
    if (!/^09\d{9}$/.test(phone)) return reject(res, 400, "invalid_phone", "شماره موبایل باید ۱۱ رقم و با ۰۹ شروع شود.");
    if (password.length < 8) return reject(res, 400, "weak_password", "رمز عبور باید حداقل ۸ نویسه باشد.");
    if (!ownerName || !shopName || !address) return reject(res, 400, "required_fields", "نام صاحب فروشگاه، نام فروشگاه و نشانی دقیق الزامی است.");
    if (!validIranianNationalId(nationalId)) return reject(res, 400, "invalid_national_id", "کد ملی واردشده معتبر نیست.");
    if (!validateIban(iban)) return reject(res, 400, "invalid_iban", "شماره شبا باید با IR و ۲۴ رقم وارد شود.");
    if (!storeCategories.has(category)) return reject(res, 400, "invalid_category", "دسته‌بندی فروشگاه را انتخاب کنید.");
    if (!files.storePhoto?.[0]) return reject(res, 400, "store_photo_required", "بارگذاری عکس واقعی فروشگاه الزامی است.");
    if (await db.get("SELECT id FROM seller_accounts WHERE phone = ?", [phone])) return reject(res, 409, "phone_taken", "با این شماره قبلاً حساب فروشنده ساخته شده است.");

    const encNationalId = encryptSellerValue(nationalId), encIban = encryptSellerValue(iban);
    const storePhoto = publicFile(files.storePhoto[0]), logoUrl = publicFile(files.logo?.[0]);
    const lat = body.lat == null || body.lat === "" ? null : Number(body.lat);
    const lng = body.lng == null || body.lng === "" ? null : Number(body.lng);
    if ((lat !== null && (!Number.isFinite(lat) || Math.abs(lat) > 90)) || (lng !== null && (!Number.isFinite(lng) || Math.abs(lng) > 180))) return reject(400, "invalid_location", "موقعیت جغرافیایی معتبر نیست.");
    const createdAt = new Date().toISOString();
    const sessionToken = crypto.randomBytes(32).toString("hex");
    const result = await db.transaction(async (tx) => {
      const sellerResult = await tx.run(
        "INSERT INTO seller_accounts (phone, password_hash, owner_name, national_id_enc, iban_enc, created_at) VALUES (?, ?, ?, ?, ?, ?)",
        [phone, hashPassword(password), ownerName, encNationalId, encIban, createdAt],
      );
      const sellerId = Number(sellerResult.insertId), storeId = await allocateId(tx, "store");
      const type = category === "hypermarket" ? "hypermarket" : "supermarket";
      await tx.run(
        `INSERT INTO stores (id, name, type, pro, is_new, rating, minutes, fee, area, tags, off_text, gradient, initial, min_basket,
          seller_id, category, address, lat, lng, photo_url, logo_url, hours, is_active)
         VALUES (?, ?, ?, 0, 1, NULL, 45, 35000, ?, '[]', NULL, 'from-[#16865b] to-[#26352e]', ?, 100000, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
        [storeId, shopName, type, address.slice(0, 180), ownerName.slice(0, 1), sellerId, category, address, lat, lng, storePhoto, logoUrl, text(body.hours, 160)],
      );
      await tx.run("INSERT INTO seller_sessions (token, seller_id, created_at) VALUES (?, ?, ?)", [sessionToken, sellerId, createdAt]);
      const account = await tx.get("SELECT * FROM seller_accounts WHERE id = ?", [sellerId]);
      const store = await tx.get("SELECT * FROM stores WHERE id = ?", [storeId]);
      return { account, store, sellerId };
    });
    res.status(201).json({ token: sessionToken, seller: sellerPayload(result.account, result.store) });
  } catch (error) {
    removeFiles(files);
    if (error?.code === "ER_DUP_ENTRY") return fail(res, 409, "phone_taken", "این شماره یا فروشگاه قبلاً ثبت شده است.");
    if (error?.code === "seller_encryption_not_configured") return fail(res, 503, error.code, error.message);
    next(error);
  }
}

router.post("/auth/login", loginThrottle, async (req, res) => {
  const phone = normalizePhone(req.body?.phone), password = String(req.body?.password ?? "");
  if (!/^09\d{9}$/.test(phone) || !password) return fail(res, 400, "invalid_credentials", "شماره موبایل و رمز عبور را وارد کنید.");
  const account = await db.get("SELECT * FROM seller_accounts WHERE phone = ?", [phone]);
  if (!account || !verifyPassword(password, account.password_hash) || !account.active) return fail(res, 401, "invalid_credentials", "شماره موبایل یا رمز عبور فروشنده نادرست است.");
  const token = await createSellerSession(account.id), store = await sellerStore(account.id);
  res.json({ token, seller: sellerPayload(account, store) });
});
router.post("/auth/logout", requireSellerAuth, async (req, res) => {
  await db.run("DELETE FROM seller_sessions WHERE token = ?", [req.sellerToken]);
  res.json({ ok: true });
});
router.get("/auth/me", requireSellerAuth, async (req, res) => {
  const account = await db.get("SELECT * FROM seller_accounts WHERE id = ?", [req.seller.id]);
  res.json(responseFor(account, await sellerStore(req.seller.id)));
});

router.use(requireSellerAuth);
router.get("/dashboard", async (req, res) => {
  const store = await sellerStore(req.seller.id);
  if (!store) return fail(res, 404, "store_missing", "پروفایل فروشگاه ثبت نشده است.");
  const [productCount, activeProducts, pendingOrders, allOrders, sales] = await Promise.all([
    db.get("SELECT COUNT(*) AS n FROM products WHERE seller_id = ?", [req.seller.id]),
    db.get("SELECT COUNT(*) AS n FROM products WHERE seller_id = ? AND active = 1", [req.seller.id]),
    db.get("SELECT COUNT(*) AS n FROM orders WHERE store_id = ? AND status = 1", [store.id]),
    db.get("SELECT COUNT(*) AS n FROM orders WHERE store_id = ?", [store.id]),
    db.get("SELECT COALESCE(SUM(total), 0) AS n FROM orders WHERE store_id = ? AND status = 3", [store.id]),
  ]);
  res.json({ store: mapStore(store), stats: { products: Number(productCount.n), activeProducts: Number(activeProducts.n), pendingOrders: Number(pendingOrders.n), orders: Number(allOrders.n), sales: Number(sales.n) } });
});
router.get("/store", async (req, res) => {
  const store = await sellerStore(req.seller.id);
  if (!store) return fail(res, 404, "store_missing", "فروشگاه پیدا نشد.");
  res.json({ store: mapStore(store) });
});
router.put("/store", (req, res, next) => storeImages(req, res, (err) => err ? next(err) : updateStore(req, res, next)));
async function updateStore(req, res, next) {
  const files = req.files ?? {};
  try {
    const store = await sellerStore(req.seller.id);
    if (!store) return fail(res, 404, "store_missing", "فروشگاه پیدا نشد.");
    const b = req.body ?? {}, name = text(b.name, 160), address = text(b.address, 500), category = text(b.category, 40);
    if (!name || !address || !storeCategories.has(category)) return fail(res, 400, "invalid_store", "نام، دسته‌بندی و نشانی فروشگاه را کامل کنید.");
    const lat = b.lat === "" || b.lat == null ? null : Number(b.lat), lng = b.lng === "" || b.lng == null ? null : Number(b.lng);
    const fee = Math.floor(Number(b.fee ?? store.fee)), minBasket = Math.floor(Number(b.minBasket ?? store.min_basket));
    if ((lat !== null && (!Number.isFinite(lat) || Math.abs(lat) > 90)) || (lng !== null && (!Number.isFinite(lng) || Math.abs(lng) > 180))) return fail(res, 400, "invalid_location", "موقعیت جغرافیایی معتبر نیست.");
    if (!Number.isSafeInteger(fee) || fee < 0 || !Number.isSafeInteger(minBasket) || minBasket < 0) return fail(res, 400, "invalid_store_pricing", "هزینه ارسال و حداقل سبد باید عدد معتبر و نامنفی باشند.");
    await db.run(
      `UPDATE stores SET name=?, type=?, category=?, area=?, address=?, lat=?, lng=?, hours=?, fee=?, min_basket=?,
       photo_url=COALESCE(?, photo_url), logo_url=COALESCE(?, logo_url) WHERE id=? AND seller_id=?`,
      [name, category === "hypermarket" ? "hypermarket" : "supermarket", category, address.slice(0, 180), address, lat, lng, text(b.hours, 160), fee, minBasket, publicFile(files.storePhoto?.[0]), publicFile(files.logo?.[0]), store.id, req.seller.id],
    );
    const updated = await sellerStore(req.seller.id);
    res.json({ store: mapStore(updated) });
  } catch (error) { removeFiles(files); next(error); }
}

router.get("/products", async (req, res) => {
  const rows = await db.all("SELECT * FROM products WHERE seller_id = ? ORDER BY id DESC", [req.seller.id]);
  res.json({ products: rows.map(mapProduct) });
});
router.post("/products", (req, res, next) => oneProductImage(req, res, (err) => err ? next(err) : createProduct(req, res, next)));
async function createProduct(req, res, next) {
  try {
    const store = await sellerStore(req.seller.id), b = req.body ?? {};
    const name = text(b.name, 180), category = text(b.category, 40), price = Math.floor(Number(b.price)), stock = Math.floor(Number(b.stock));
    if (!store) return fail(res, 404, "store_missing", "فروشگاه پیدا نشد.");
    if (!name || !productCategories.has(category) || !Number.isSafeInteger(price) || price < 1 || !Number.isSafeInteger(stock) || stock < 0) return fail(res, 400, "invalid_product", "نام، دسته‌بندی، قیمت و موجودی محصول را بررسی کنید.");
    if (!req.file) return fail(res, 400, "product_photo_required", "برای ثبت کالا عکس واقعی محصول الزامی است.");
    const id = await db.transaction(async (tx) => {
      const productId = await allocateId(tx, "product");
      await tx.run(
        `INSERT INTO products (id, name, category, price, old_price, unit, icon, bg, icon_color, tag, frequent, sort_order, seller_id, store_id, stock, image_url, active, created_at)
         VALUES (?, ?, ?, ?, NULL, ?, 'Package', '', '', NULL, 0, 0, ?, ?, ?, ?, 1, ?)`,
        [productId, name, category, price, text(b.unit, 120), req.seller.id, store.id, stock, publicFile(req.file), new Date().toISOString()],
      );
      return productId;
    });
    res.status(201).json({ product: mapProduct(await db.get("SELECT * FROM products WHERE id = ?", [id])) });
  } catch (error) { if (req.file) fs.promises.unlink(req.file.path).catch(() => {}); next(error); }
}
router.patch("/products/:id", async (req, res) => {
  const id = Number(req.params.id), product = await db.get("SELECT * FROM products WHERE id = ? AND seller_id = ?", [id, req.seller.id]);
  if (!product) return fail(res, 404, "product_missing", "محصول پیدا نشد.");
  const b = req.body ?? {}, sets = [], values = [];
  if (b.active !== undefined) {
    if (typeof b.active !== "boolean") return fail(res, 400, "invalid_active", "وضعیت محصول معتبر نیست.");
    sets.push("active=?"); values.push(b.active ? 1 : 0);
  }
  if (b.price !== undefined) { const v = Math.floor(Number(b.price)); if (!Number.isSafeInteger(v) || v < 1) return fail(res, 400, "invalid_price", "قیمت معتبر نیست."); sets.push("price=?"); values.push(v); }
  if (b.stock !== undefined) { const v = Math.floor(Number(b.stock)); if (!Number.isSafeInteger(v) || v < 0) return fail(res, 400, "invalid_stock", "موجودی معتبر نیست."); sets.push("stock=?"); values.push(v); }
  if (b.name !== undefined) {
    const name = text(b.name, 180);
    if (!name) return fail(res, 400, "invalid_name", "نام محصول را وارد کنید.");
    sets.push("name=?"); values.push(name);
  }
  if (!sets.length) return res.json({ product: mapProduct(product) });
  values.push(id, req.seller.id);
  await db.run(`UPDATE products SET ${sets.join(", ")} WHERE id = ? AND seller_id = ?`, values);
  res.json({ product: mapProduct(await db.get("SELECT * FROM products WHERE id = ?", [id])) });
});
router.delete("/products/:id", async (req, res) => {
  const result = await db.run("UPDATE products SET active = 0, stock = 0 WHERE id = ? AND seller_id = ?", [Number(req.params.id), req.seller.id]);
  if (!result.affectedRows) return fail(res, 404, "product_missing", "محصول پیدا نشد.");
  res.json({ ok: true });
});

router.get("/promotions", async (req, res) => {
  const rows = await db.all("SELECT * FROM seller_promos WHERE seller_id = ? ORDER BY created_at DESC", [req.seller.id]);
  res.json({ promotions: rows.map(mapPromo) });
});
router.post("/promotions", async (req, res) => {
  const store = await sellerStore(req.seller.id), b = req.body ?? {};
  if (!store) return fail(res, 404, "store_missing", "فروشگاه پیدا نشد.");
  const code = text(b.code, 40).toUpperCase().replace(/[^A-Z0-9_-]/g, "");
  const title = text(b.title, 180), description = text(b.description, 255);
  const kind = b.kind === "percent" ? "percent" : "fixed";
  const amount = Math.floor(Number(b.amount)), minSubtotal = Math.floor(Number(b.minSubtotal ?? 0));
  const maxDiscount = Math.floor(Number(b.maxDiscount ?? 0));
  if (!/^[A-Z0-9_-]{3,40}$/.test(code) || !title || !Number.isSafeInteger(amount) || amount < 1 || (kind === "percent" && amount > 100) || !Number.isSafeInteger(minSubtotal) || minSubtotal < 0 || !Number.isSafeInteger(maxDiscount) || maxDiscount < 0) return fail(res, 400, "invalid_promotion", "کد، عنوان و مبلغ تخفیف را بررسی کنید.");
  const expiryDate = b.expiresAt ? new Date(b.expiresAt) : null;
  if (expiryDate && !Number.isFinite(expiryDate.getTime())) return fail(res, 400, "invalid_expiration", "تاریخ پایان کد تخفیف معتبر نیست.");
  const expiresAt = expiryDate?.toISOString() ?? null;
  try {
    const result = await db.run(
      `INSERT INTO seller_promos (seller_id, store_id, code, title, description, kind, amount, min_subtotal, max_discount, active, expires_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
      [req.seller.id, store.id, code, title, description, kind, amount, minSubtotal, maxDiscount, expiresAt, new Date().toISOString()],
    );
    res.status(201).json({ promotion: mapPromo(await db.get("SELECT * FROM seller_promos WHERE id = ?", [result.insertId])) });
  } catch (error) { if (error?.code === "ER_DUP_ENTRY") return fail(res, 409, "promotion_exists", "این کد قبلاً برای فروشگاه شما ثبت شده است."); throw error; }
});
router.delete("/promotions/:id", async (req, res) => {
  const result = await db.run("DELETE FROM seller_promos WHERE id = ? AND seller_id = ?", [Number(req.params.id), req.seller.id]);
  if (!result.affectedRows) return fail(res, 404, "promotion_missing", "کد تخفیف پیدا نشد.");
  res.json({ ok: true });
});

router.get("/orders", async (req, res) => {
  const store = await sellerStore(req.seller.id);
  if (!store) return fail(res, 404, "store_missing", "فروشگاه پیدا نشد.");
  const rows = await db.all(
    `SELECT o.*, u.phone AS customer_phone, CONCAT_WS(' ', u.first_name, u.last_name) AS customer_name
     FROM orders o JOIN users u ON u.id=o.user_id WHERE o.store_id=? ORDER BY o.created_at DESC`, [store.id],
  );
  res.json({ orders: rows.map((r) => ({ ...mapOrder(r), items: parseItems(r.items), addressText: r.address_text, paymentStatus: r.payment_status ?? "unpaid", customer: { name: r.customer_name || "مشتری", phone: r.customer_phone } })) });
});
router.patch("/orders/:id/status", async (req, res) => {
  const store = await sellerStore(req.seller.id), next = Number(req.body?.status);
  if (![2, 3].includes(next)) return fail(res, 400, "invalid_status", "وضعیت درخواستی معتبر نیست.");
  const result = await db.run("UPDATE orders SET status = ? WHERE id = ? AND store_id = ? AND status = ?", [next, req.params.id, store?.id ?? 0, next - 1]);
  if (!result.affectedRows) return fail(res, 409, "order_status_conflict", "سفارش پیدا نشد یا وضعیت آن تغییر کرده است.");
  const row = await db.get("SELECT * FROM orders WHERE id = ?", [req.params.id]);
  res.json({ order: mapOrder(row) });
});

export default router;

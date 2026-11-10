import adminOperations from "./admin-operations.js";
import { Router } from "express";
import crypto from "node:crypto";
import fs from "node:fs";
import { createDeliveryCode } from "../trip-security.js";
import { notifyCourier } from "../courier-notifications.js";
import { readDocument, decryptPrivateJSON } from "../private-documents.js";
import multer from "multer";
import { uploadDir } from "../storage-paths.js";
import { db, mapOrder } from "../db.js";
import { bearerToken, loginThrottle, verifyPassword } from "../auth.js";
import { normalizeImage } from "../images.js";
export const requireAdmin = async (req, res, next) => {
  const row = await db.get(
    "SELECT token FROM admin_sessions WHERE token=? AND expires_at>?",
    [bearerToken(req) || "", new Date().toISOString()],
  );
  if (!row)
    return res
      .status(401)
      .json({ error: { message: "ورود مدیر الزامی است." } });
  next();
};
const router = Router();
const fail = (res, status, message) =>
  res.status(status).json({ error: { message } });
router.post("/login", loginThrottle, async (req, res) => {
  if (
    !process.env.ADMIN_PASSWORD_HASH ||
    !process.env.ADMIN_USERNAME ||
    req.body?.username !== process.env.ADMIN_USERNAME ||
    !verifyPassword(
      String(req.body?.password || ""),
      process.env.ADMIN_PASSWORD_HASH,
    )
  )
    return fail(res, 401, "اطلاعات ورود مدیر معتبر نیست.");
  const token = crypto.randomBytes(32).toString("hex");
  await db.run("INSERT INTO admin_sessions (token,expires_at) VALUES (?,?)", [
    token,
    new Date(Date.now() + 8 * 3600000).toISOString(),
  ]);
  res.json({ token });
});
router.use(requireAdmin);
router.use(adminOperations);
router.post("/logout", async (req, res) => {
  await db.run("DELETE FROM admin_sessions WHERE token=?", [bearerToken(req)]);
  res.json({ ok: true });
});
router.get("/orders", async (req, res) => {
  const page = Math.max(
      1,
      Math.min(1000000, parseInt(String(req.query.page), 10) || 1),
    ),
    size = 30,
    q = String(req.query.q || "")
      .trim()
      .slice(0, 100),
    status = String(req.query.status || "all");
  const where = [],
    values = [];
  if (q) {
    where.push("(id LIKE ? OR store_name LIKE ?)");
    values.push("%" + q + "%", "%" + q + "%");
  }
  if (/^[0-5]$/.test(status)) {
    where.push("status=?");
    values.push(Number(status));
  }
  const clause = where.length ? " WHERE " + where.join(" AND ") : "";
  const total = Number(
    (await db.get("SELECT COUNT(*) n FROM orders" + clause, values)).n,
  );
  res.json({
    rows: (
      await db.all(
        `SELECT * FROM orders${clause} ORDER BY created_at DESC,id DESC LIMIT ${size} OFFSET ${(page - 1) * size}`,
        values,
      )
    ).map(mapOrder),
    total,
    page,
    size,
  });
});
router.get("/users", async (req, res) => {
  const page = Math.max(
      1,
      Math.min(1000000, parseInt(String(req.query.page), 10) || 1),
    ),
    size = 30,
    q = String(req.query.q || "")
      .trim()
      .slice(0, 100),
    since = new Date(Date.now() - 30 * 86400000).toISOString();
  const clause = q
      ? " WHERE (phone LIKE ? OR first_name LIKE ? OR last_name LIKE ?)"
      : "",
    values = q ? Array(3).fill("%" + q + "%") : [];
  const total = Number(
    (await db.get("SELECT COUNT(*) n FROM users" + clause, values)).n,
  );
  res.json({
    rows: await db.all(
      `SELECT u.id,u.phone,u.first_name,u.last_name,u.created_at,EXISTS(SELECT 1 FROM sessions s WHERE s.user_id=u.id AND s.created_at>=?) AS active FROM users u${clause} ORDER BY id DESC LIMIT ${size} OFFSET ${(page - 1) * size}`,
      [since, ...values],
    ),
    total,
    page,
    size,
  });
});
router.get("/dashboard", async (_req, res) => {
  const since = new Date(Date.now() - 30 * 86400000).toISOString();
  const stats = {};
  const queries = {
    users: "SELECT COUNT(*) n FROM users",
    activeUsers:
      "SELECT COUNT(DISTINCT user_id) n FROM sessions WHERE created_at>=?",
    sellers: "SELECT COUNT(*) n FROM seller_accounts",
    activeSellers:
      "SELECT COUNT(*) n FROM seller_accounts a JOIN stores s ON s.seller_id=a.id WHERE a.active=1 AND s.is_active=1",
    stores: "SELECT COUNT(*) n FROM stores WHERE seller_id IS NOT NULL",
    products: "SELECT COUNT(*) n FROM master_products",
    orders: "SELECT COUNT(*) n FROM orders",
    sales: "SELECT COALESCE(SUM(total),0) n FROM orders WHERE status=5",
    dailySales:
      "SELECT COALESCE(SUM(total),0) n FROM orders WHERE status=5 AND LEFT(created_at,10)=?",
    monthlySales:
      "SELECT COALESCE(SUM(total),0) n FROM orders WHERE status=5 AND LEFT(created_at,7)=?",
    discounts: "SELECT COALESCE(SUM(discount),0) n FROM orders WHERE status<>0",
    couriers: "SELECT COUNT(*) n FROM courier_accounts",
    pendingCouriers:
      "SELECT COUNT(*) n FROM courier_accounts WHERE verification_status='pending'",
    approvedCouriers:
      "SELECT COUNT(*) n FROM courier_accounts WHERE verification_status='approved'",
    rejectedCouriers:
      "SELECT COUNT(*) n FROM courier_accounts WHERE verification_status='rejected'",
    correctionCouriers:
      "SELECT COUNT(*) n FROM courier_accounts WHERE verification_status='needs_correction'",
  };
  // Stored dates are UTC; date reports explicitly use UTC for reproducibility.
  for (const [key, sql] of Object.entries(queries))
    stats[key] = Number(
      (
        await db.get(
          sql,
          key === "activeUsers"
            ? [since]
            : key === "dailySales"
              ? [new Date().toISOString().slice(0, 10)]
              : key === "monthlySales"
                ? [new Date().toISOString().slice(0, 7)]
                : [],
        )
      ).n,
    );
  stats.inactiveUsers = stats.users - stats.activeUsers;
  stats.inactiveSellers = stats.sellers - stats.activeSellers;
  for (let status = 0; status <= 5; status++)
    stats["status" + status] = Number(
      (await db.get("SELECT COUNT(*) n FROM orders WHERE status=?", [status]))
        .n,
    );
  const [orders, users, stores, sellerReport, courierReport] =
    await Promise.all([
      db.all("SELECT * FROM orders ORDER BY created_at DESC LIMIT 200"),
      db.all(
        "SELECT u.id,u.phone,u.first_name,u.last_name,u.created_at,EXISTS(SELECT 1 FROM sessions s WHERE s.user_id=u.id AND s.created_at>=?) AS active FROM users u ORDER BY id DESC LIMIT 200",
        [since],
      ),
      db.all(
        "SELECT id,name,address,is_active FROM stores WHERE seller_id IS NOT NULL ORDER BY id DESC",
      ),
      db.all(
        "SELECT s.id,s.name,COUNT(o.id) AS orders,COALESCE(SUM(CASE WHEN o.status=5 THEN o.total ELSE 0 END),0) AS sales FROM stores s LEFT JOIN orders o ON o.store_id=s.id WHERE s.seller_id IS NOT NULL GROUP BY s.id,s.name",
      ),
      db.all(
        "SELECT c.id,c.full_name,COUNT(d.order_id) AS orders,SUM(CASE WHEN d.completed_at IS NOT NULL THEN 1 ELSE 0 END) AS completed FROM courier_accounts c LEFT JOIN order_deliveries d ON d.courier_id=c.id GROUP BY c.id,c.full_name",
      ),
    ]);
  const financial = await db.get(
    "SELECT COALESCE(SUM(platform_commission),0) commission,COALESCE(SUM(first_offer_discount),0) subsidy,COALESCE(SUM(delivery),0) delivery FROM orders WHERE status=5",
  );
  const payout = Number(
    (await db.get("SELECT COALESCE(SUM(amount),0) n FROM courier_ledger")).n,
  );
  const expenses = Number(
    (await db.get("SELECT COALESCE(SUM(amount),0) n FROM platform_expenses")).n,
  );
  stats.netProfit =
    Number(financial.commission) +
    Number(financial.delivery) -
    Number(financial.subsidy) -
    payout -
    expenses;
  stats.courierCosts = payout;
  stats.operatingExpenses = expenses;
  stats.commissionRevenue = Number(financial.commission);
  res.json({
    stats,
    activeDefinition:
      "کاربر فعال: ورود در ۳۰ روز گذشته؛ فروشنده فعال: حساب و فروشگاه فعال. مبنای گزارش روزانه و ماهانه: UTC؛ فروش مربوط به سفارش تکمیل‌شده است. سود عملیاتی فقط براساس مبالغ و هزینه‌های ثبت‌شده، پیش از مالیات و هزینه‌های ثبت‌نشده است؛ سفارش‌های قدیمی نیازمند تطبیق‌اند.",
    orders: orders.map(mapOrder),
    users,
    stores,
    sellerReport,
    courierReport,
  });
});
fs.mkdirSync(uploadDir, { recursive: true });
const upload = multer({
  storage: multer.diskStorage({
    destination: uploadDir,
    filename: (_r, _f, cb) => cb(null, crypto.randomUUID() + ".jpg"),
  }),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_r, f, cb) =>
    cb(null, ["image/png", "image/jpeg", "image/webp"].includes(f.mimetype)),
});
const categories = [
  "drinks",
  "dairy",
  "snacks",
  "grocery",
  "fresh",
  "protein",
  "bakery",
  "hygiene",
  "other",
];
function productInput(b) {
  const p = {
    name: String(b.name || "")
      .trim()
      .slice(0, 180),
    description: String(b.description || "")
      .trim()
      .slice(0, 5000),
    category: b.category,
    unit: String(b.unit || "")
      .trim()
      .slice(0, 120),
    base_price: Number(b.base_price),
    weight_kg: Number(b.weight_kg ?? 0.5),
    max_discount: Number(b.max_discount),
  };
  if (
    !p.name ||
    !categories.includes(p.category) ||
    !Number.isSafeInteger(p.base_price) ||
    p.base_price < 1 ||
    !Number.isFinite(p.weight_kg) ||
    p.weight_kg <= 0 ||
    p.weight_kg > 200 ||
    !Number.isInteger(p.max_discount) ||
    p.max_discount < 0 ||
    p.max_discount > 90
  )
    return null;
  return p;
}
router.get("/products", async (_req, res) =>
  res.json({
    products: await db.all("SELECT * FROM master_products ORDER BY id DESC"),
  }),
);
router.post("/products", upload.single("image"), async (req, res) => {
  const p = productInput(req.body || {});
  if (!p || !req.file) {
    if (req.file) fs.unlinkSync(req.file.path);
    return fail(
      res,
      400,
      "نام، دسته، قیمت پایه، وزن، سقف تخفیف و تصویر معتبر الزامی است.",
    );
  }
  try {
    await normalizeImage(req.file, true);
  } catch {
    fs.unlinkSync(req.file.path);
    return fail(res, 400, "فایل تصویر معتبر نیست.");
  }
  const result = await db.run(
    "INSERT INTO master_products (name,category,unit,image_url,active,description,base_price,weight_kg,max_discount,image_normalized) VALUES (?,?,?,?,1,?,?,?,?,1)",
    [
      p.name,
      p.category,
      p.unit,
      `/api/uploads/${req.file.filename}`,
      p.description,
      p.base_price,
      p.weight_kg,
      p.max_discount,
    ],
  );
  res.status(201).json({ id: result.insertId });
});
router.put("/products/:id", upload.single("image"), async (req, res) => {
  const p = productInput(req.body || {}),
    old = await db.get("SELECT * FROM master_products WHERE id=?", [
      req.params.id,
    ]);
  if (!p || !old) {
    if (req.file) fs.unlinkSync(req.file.path);
    return fail(res, 400, "اطلاعات محصول معتبر نیست.");
  }
  try {
    if (req.file) await normalizeImage(req.file, true);
  } catch {
    fs.unlinkSync(req.file.path);
    return fail(res, 400, "تصویر معتبر نیست.");
  }
  const image = req.file ? `/api/uploads/${req.file.filename}` : old.image_url;
  await db.transaction(async (tx) => {
    await tx.run(
      "UPDATE master_products SET name=?,category=?,unit=?,image_url=?,description=?,base_price=?,weight_kg=?,max_discount=?,image_normalized=1 WHERE id=?",
      [
        p.name,
        p.category,
        p.unit,
        image,
        p.description,
        p.base_price,
        p.weight_kg,
        p.max_discount,
        old.id,
      ],
    );
    await tx.run(
      "UPDATE products SET name=?,category=?,unit=?,image_url=?,price=CASE WHEN old_price IS NOT NULL AND price < CEIL(old_price*(100-?)/100) THEN CEIL(old_price*(100-?)/100) ELSE price END WHERE master_product_id=?",
      [
        p.name,
        p.category,
        p.unit,
        image,
        p.max_discount,
        p.max_discount,
        old.id,
      ],
    );
  });
  res.json({ ok: true });
});
router.patch("/products/:id", async (req, res) => {
  if (typeof req.body.active !== "boolean")
    return fail(res, 400, "وضعیت معتبر نیست.");
  await db.transaction(async (tx) => {
    await tx.run("UPDATE master_products SET active=? WHERE id=?", [
      req.body.active ? 1 : 0,
      req.params.id,
    ]);
    await tx.run("UPDATE products SET active=? WHERE master_product_id=?", [
      req.body.active ? 1 : 0,
      req.params.id,
    ]);
  });
  res.json({ ok: true });
});
router.get("/couriers", async (_req, res) =>
  res.json({
    couriers: await db.all(
      "SELECT id,phone,full_name,active,plate,vehicle_info,motor_photos,verification_status,rejection_reason FROM courier_accounts ORDER BY id DESC",
    ),
  }),
);
router.get("/couriers/:id/profile", async (req, res) => {
  res.set("Cache-Control", "no-store");
  const row = await db.get(
    "SELECT personal_details FROM courier_accounts WHERE id=?",
    [req.params.id],
  );
  if (!row) return fail(res, 404, "پیک پیدا نشد.");
  res.json({
    profile: row.personal_details
      ? decryptPrivateJSON(row.personal_details)
      : null,
  });
});
router.get("/couriers/:id/documents/:kind", async (req, res) => {
  res.set("Cache-Control", "no-store");
  const fields = {
    motor: "motor_photo",
    national: "national_photo",
    license: "license_photo",
    plate: "plate_photo",
    portrait: "portrait_photo",
    vehicleDocument: "vehicle_document_photo",
  };
  if (/^motor-[0-3]$/.test(req.params.kind)) {
    const row = await db.get(
      "SELECT motor_photos FROM courier_accounts WHERE id=?",
      [req.params.id],
    );
    let photos = [];
    try {
      photos = JSON.parse(row?.motor_photos || "[]");
    } catch {}
    const filename = photos[Number(req.params.kind.split("-")[1])];
    if (!filename) return res.sendStatus(404);
    const image = await readDocument(filename);
    res.set({
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Type": "image/jpeg",
    });
    return res.send(image);
  }
  const field = fields[req.params.kind];
  if (!field) return res.sendStatus(404);
  const row = await db.get(
    `SELECT ${field} AS file FROM courier_accounts WHERE id=?`,
    [req.params.id],
  );
  if (!row?.file) return res.sendStatus(404);
  const image = await readDocument(row.file);
  res.set({
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "Content-Type": "image/jpeg",
  });
  res.send(image);
});
router.patch("/couriers/:id/review", async (req, res) => {
  const state = req.body.status,
    reason = String(req.body.reason || "")
      .trim()
      .slice(0, 500);
  if (
    !["approved", "rejected", "needs_correction"].includes(state) ||
    (state !== "approved" && !reason)
  )
    return fail(res, 400, "وضعیت و دلیل بررسی را مشخص کنید.");
  const result = await db.run(
    "UPDATE courier_accounts SET active=?,verification_status=?,rejection_reason=? WHERE id=? AND verification_status='pending' AND motor_photo IS NOT NULL AND national_photo IS NOT NULL AND license_photo IS NOT NULL AND plate_photo IS NOT NULL AND (?<>'approved' OR (personal_details IS NOT NULL AND portrait_photo IS NOT NULL AND vehicle_document_photo IS NOT NULL))",
    [
      state === "approved" ? 1 : 0,
      state,
      state === "approved" ? "" : reason,
      req.params.id,
      state,
    ],
  );
  if (!result.affectedRows) return fail(res, 409, "درخواست قابل بررسی نیست.");
  await notifyCourier(db, req.params.id, {
    key: "kyc:" + Date.now(),
    kind: "kyc",
    title: "وضعیت مدارک تغییر کرد",
    body:
      state === "approved"
        ? "مدارک شما تأیید شد. می‌توانید آنلاین شوید."
        : reason,
    target: "verify",
  });
  res.json({ ok: true });
});
router.patch("/stores/:id", async (req, res) => {
  if (typeof req.body.active !== "boolean") return res.sendStatus(400);
  await db.run("UPDATE stores SET is_active=? WHERE id=?", [
    req.body.active ? 1 : 0,
    req.params.id,
  ]);
  res.json({ ok: true });
});
router.post("/orders/:id/reset-delivery-code", async (req, res) => {
  const code = createDeliveryCode();
  const changed = await db.run(
    "UPDATE order_deliveries d JOIN orders o ON o.id=d.order_id SET d.delivery_otp=?,d.otp_attempts=0,d.otp_expires_at=? WHERE o.id=? AND o.status=4 AND d.completed_at IS NULL",
    [
      code.encrypted,
      new Date(Date.now() + 86400000).toISOString(),
      req.params.id,
    ],
  );
  if (!changed.affectedRows) return fail(res, 409, "سفر در مرحلهٔ تحویل نیست.");
  res.json({ ok: true });
});
router.get("/orders/:id/events", async (req, res) =>
  res.json({
    events: await db.all(
      "SELECT * FROM order_events WHERE order_id=? ORDER BY id",
      [req.params.id],
    ),
  }),
);
export default router;

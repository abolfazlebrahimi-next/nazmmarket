import { Router } from "express";
import crypto from "node:crypto";
import { db, mapOrder } from "../db.js";
import { bearerToken, hashPassword, loginThrottle, normalizePhone, verifyPassword } from "../auth.js";

const router = Router();
const fail = (res, status, code, message) => res.status(status).json({ error: { code, message } });
const shapeCourier = (row) => ({ id: Number(row.id), fullName: row.full_name, phone: row.phone, vehicle: row.vehicle });

async function requireCourier(req, res, next) {
  try {
    const token = bearerToken(req);
    if (!token) return fail(res, 401, "courier_unauthorized", "برای ادامه وارد پنل پیک شوید.");
    const row = await db.get(`SELECT a.id, a.phone, a.full_name, a.vehicle, a.active
      FROM courier_sessions s JOIN courier_accounts a ON a.id=s.courier_id WHERE s.token=?`, [token]);
    if (!row || !row.active) return fail(res, 401, "courier_unauthorized", "نشست پیک معتبر یا فعال نیست.");
    req.courier = shapeCourier(row);
    req.courierToken = token;
    next();
  } catch (error) { next(error); }
}

router.post("/auth/register", async (req, res) => {
  const phone = normalizePhone(req.body?.phone), password = String(req.body?.password ?? "");
  const fullName = String(req.body?.fullName ?? "").trim().slice(0, 120);
  const vehicle = String(req.body?.vehicle ?? "motorcycle");
  if (!/^09\d{9}$/.test(phone) || password.length < 10 || !fullName || vehicle !== "motorcycle")
    return fail(res, 400, "invalid_registration", "نام، شماره موبایل معتبر، رمز حداقل ۱۰ نویسه و وسیلهٔ موتورسیکلت الزامی است.");
  try {
    const result = await db.run("INSERT INTO courier_accounts (phone, password_hash, full_name, vehicle, active, created_at) VALUES (?, ?, ?, 'motorcycle', 0, ?)", [phone, hashPassword(password), fullName, new Date().toISOString()]);
    return res.status(201).json({ pendingApproval: true, message: "درخواست ثبت شد و پس از بررسی مدارک توسط مدیریت فعال می‌شود.", courierId: Number(result.insertId) });
  } catch (error) {
    if (error?.code === "ER_DUP_ENTRY") return fail(res, 409, "phone_taken", "با این شماره قبلاً درخواست پیک ثبت شده است.");
    throw error;
  }
});

router.post("/auth/login", loginThrottle, async (req, res) => {
  const phone = normalizePhone(req.body?.phone), password = String(req.body?.password ?? "");
  if (!/^09\d{9}$/.test(phone) || !password) return fail(res, 400, "invalid_credentials", "شماره موبایل و رمز عبور را وارد کنید.");
  const account = await db.get("SELECT * FROM courier_accounts WHERE phone=?", [phone]);
  if (!account || !verifyPassword(password, account.password_hash)) return fail(res, 401, "invalid_credentials", "شماره موبایل یا رمز عبور پیک نادرست است.");
  if (!account.active) return fail(res, 403, "courier_pending_approval", "حساب پیک هنوز توسط مدیریت تأیید نشده است.");
  const token = crypto.randomBytes(32).toString("hex");
  await db.run("INSERT INTO courier_sessions (token, courier_id, created_at) VALUES (?, ?, ?)", [token, account.id, new Date().toISOString()]);
  res.json({ token, courier: shapeCourier(account) });
});

router.use(requireCourier);
router.post("/auth/logout", async (req, res) => {
  await db.run("DELETE FROM courier_sessions WHERE token=?", [req.courierToken]);
  res.json({ ok: true });
});
router.get("/auth/me", (req, res) => res.json({ courier: req.courier }));

router.get("/orders", async (req, res) => {
  const rows = await db.all(`SELECT o.*, s.address AS store_address, s.area AS store_area,
      d.courier_id, d.claimed_at, d.completed_at, u.phone AS customer_phone
    FROM orders o JOIN stores s ON s.id=o.store_id JOIN users u ON u.id=o.user_id
    LEFT JOIN order_deliveries d ON d.order_id=o.id
    WHERE (o.status=3 AND d.order_id IS NULL) OR (d.courier_id=? AND o.status IN (3,4))
    ORDER BY CASE WHEN d.courier_id=? THEN 0 ELSE 1 END, o.created_at ASC`, [req.courier.id, req.courier.id]);
  res.json({ orders: rows.map((row) => ({
    ...mapOrder(row), items: typeof row.items === "string" ? JSON.parse(row.items || "[]") : row.items,
    addressText: row.address_text, customerPhone: row.customer_phone,
    storeAddress: row.store_address, storeArea: row.store_area,
    claimedByMe: Number(row.courier_id) === req.courier.id,
    claimedAt: row.claimed_at, completedAt: row.completed_at,
  })) });
});

router.post("/orders/:id/claim", async (req, res) => {
  try {
    const order = await db.get("SELECT id FROM orders WHERE id=? AND status=3", [req.params.id]);
    if (!order) return fail(res, 409, "order_unavailable", "این سفارش دیگر آمادهٔ دریافت نیست.");
    await db.run("INSERT INTO order_deliveries (order_id, courier_id, claimed_at, completed_at) VALUES (?, ?, ?, NULL)", [order.id, req.courier.id, new Date().toISOString()]);
    res.json({ ok: true });
  } catch (error) {
    if (error?.code === "ER_DUP_ENTRY") return fail(res, 409, "order_claimed", "این سفارش را پیک دیگری دریافت کرده است.");
    throw error;
  }
});

router.post("/orders/:id/complete", async (req, res) => {
  const now = new Date().toISOString();
  const result = await db.transaction(async (tx) => {
    const delivery = await tx.get("SELECT order_id FROM order_deliveries WHERE order_id=? AND courier_id=? AND completed_at IS NULL FOR UPDATE", [req.params.id, req.courier.id]);
    if (!delivery) return null;
    const changed = await tx.run("UPDATE orders SET status=4 WHERE id=? AND status=3", [req.params.id]);
    if (!changed.affectedRows) return null;
    await tx.run("UPDATE order_deliveries SET completed_at=? WHERE order_id=? AND courier_id=? AND completed_at IS NULL", [now, req.params.id, req.courier.id]);
    return tx.get("SELECT * FROM orders WHERE id=?", [req.params.id]);
  });
  if (!result) return fail(res, 409, "order_not_completable", "برای تکمیل، ابتدا همین سفارش را دریافت کنید و مطمئن شوید هنوز آمادهٔ تحویل است.");
  res.json({ order: mapOrder(result) });
});

export default router;

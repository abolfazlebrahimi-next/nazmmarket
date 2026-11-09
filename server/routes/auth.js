import { Router } from "express";
import { db, mapAddress, mapUser } from "../db.js";
import { bearerToken, createSession, destroySession, hashPassword, isValidPhone, loginThrottle, normalizePhone, requireAuth, verifyPassword } from "../auth.js";
const router = Router();
const bad = (res, status, code, message) => res.status(status).json({ error: { code, message } });
const sanitizeName = (v) => String(v ?? "").trim().slice(0, 40);

router.post("/register", async (req, res) => {
  const phone = normalizePhone(req.body?.phone), password = String(req.body?.password ?? "");
  const firstName = sanitizeName(req.body?.firstName), lastName = sanitizeName(req.body?.lastName);
  if (!isValidPhone(phone)) return bad(res, 400, "invalid_phone", "شماره موبایل باید ۱۱ رقم و با ۰۹ شروع شود.");
  if (password.length < 6) return bad(res, 400, "weak_password", "رمز عبور باید حداقل ۶ کاراکتر باشد.");
  if (await db.get("SELECT id FROM users WHERE phone = ?", [phone])) return bad(res, 409, "phone_taken", "این شماره قبلاً ثبت‌نام کرده است. وارد شوید.");
  const info = await db.run("INSERT INTO users (phone, password_hash, first_name, last_name, created_at) VALUES (?, ?, ?, ?, ?)", [phone, hashPassword(password), firstName, lastName, new Date().toISOString()]);
  const userId = Number(info.insertId), token = await createSession(userId);
  res.status(201).json({ token, user: mapUser(await db.get("SELECT * FROM users WHERE id = ?", [userId])), addresses: [] });
});

router.post("/login", loginThrottle, async (req, res) => {
  const phone = normalizePhone(req.body?.phone), password = String(req.body?.password ?? "");
  if (!isValidPhone(phone) || !password) return bad(res, 400, "invalid_credentials", "شماره موبایل و رمز عبور را کامل وارد کنید.");
  const row = await db.get("SELECT * FROM users WHERE phone = ?", [phone]);
  if (!row || !verifyPassword(password, row.password_hash)) return bad(res, 401, "invalid_credentials", "شماره موبایل یا رمز عبور اشتباه است.");
  const token = await createSession(row.id);
  const addresses = (await db.all("SELECT * FROM addresses WHERE user_id = ? ORDER BY id ASC", [row.id])).map(mapAddress);
  res.json({ token, user: mapUser(row), addresses });
});
router.post("/logout", async (req, res) => { await destroySession(bearerToken(req)); res.json({ ok: true }); });
router.get("/me", requireAuth, (req, res) => res.json({ user: req.user }));
router.patch("/profile", requireAuth, async (req, res) => {
  const firstName = sanitizeName(req.body?.firstName ?? req.user.firstName), lastName = sanitizeName(req.body?.lastName ?? req.user.lastName);
  const password = req.body?.password ? String(req.body.password) : null;
  if (password !== null && password.length < 6) return bad(res, 400, "weak_password", "رمز عبور جدید باید حداقل ۶ کاراکتر باشد.");
  if (password !== null) {
    await db.run("UPDATE users SET first_name = ?, last_name = ?, password_hash = ? WHERE id = ?", [firstName, lastName, hashPassword(password), req.user.id]);
    await db.run("DELETE FROM sessions WHERE user_id = ? AND token != ?", [req.user.id, req.token]);
  } else await db.run("UPDATE users SET first_name = ?, last_name = ? WHERE id = ?", [firstName, lastName, req.user.id]);
  res.json({ user: mapUser(await db.get("SELECT * FROM users WHERE id = ?", [req.user.id])) });
});
export default router;

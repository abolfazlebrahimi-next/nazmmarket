import { Router } from "express";
import { db, mapAddress, mapUser } from "../db.js";
import {
  bearerToken,
  createSession,
  destroySession,
  hashPassword,
  isValidPhone,
  loginThrottle,
  normalizePhone,
  requireAuth,
  verifyPassword,
} from "../auth.js";

const router = Router();

const bad = (res, status, code, message) => res.status(status).json({ error: { code, message } });

const sanitizeName = (v) => String(v ?? "").trim().slice(0, 40);

/** POST /api/auth/register — phone number = username, plus a password. */
router.post("/register", (req, res) => {
  const phone = normalizePhone(req.body?.phone);
  const password = String(req.body?.password ?? "");
  const firstName = sanitizeName(req.body?.firstName);
  const lastName = sanitizeName(req.body?.lastName);

  if (!isValidPhone(phone)) {
    return bad(res, 400, "invalid_phone", "شماره موبایل باید ۱۱ رقم و با ۰۹ شروع شود.");
  }
  if (password.length < 6) {
    return bad(res, 400, "weak_password", "رمز عبور باید حداقل ۶ کاراکتر باشد.");
  }
  const exists = db.prepare("SELECT id FROM users WHERE phone = ?").get(phone);
  if (exists) {
    return bad(res, 409, "phone_taken", "این شماره قبلاً ثبت‌نام کرده است. وارد شوید.");
  }

  const info = db
    .prepare(
      `INSERT INTO users (phone, password_hash, first_name, last_name, created_at)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .run(phone, hashPassword(password), firstName, lastName, new Date().toISOString());

  const userId = Number(info.lastInsertRowid);
  const token = createSession(userId);
  const row = db.prepare("SELECT * FROM users WHERE id = ?").get(userId);

  res.status(201).json({ token, user: mapUser(row), addresses: [] });
});

/** POST /api/auth/login */
router.post("/login", loginThrottle, (req, res) => {
  const phone = normalizePhone(req.body?.phone);
  const password = String(req.body?.password ?? "");

  if (!isValidPhone(phone) || !password) {
    return bad(res, 400, "invalid_credentials", "شماره موبایل و رمز عبور را کامل وارد کنید.");
  }

  const row = db.prepare("SELECT * FROM users WHERE phone = ?").get(phone);
  if (!row || !verifyPassword(password, row.password_hash)) {
    return bad(res, 401, "invalid_credentials", "شماره موبایل یا رمز عبور اشتباه است.");
  }

  const token = createSession(row.id);
  const addresses = db
    .prepare("SELECT * FROM addresses WHERE user_id = ? ORDER BY id ASC")
    .all(row.id)
    .map(mapAddress);

  res.json({ token, user: mapUser(row), addresses });
});

/** POST /api/auth/logout */
router.post("/logout", (req, res) => {
  destroySession(bearerToken(req));
  res.json({ ok: true });
});

/** GET /api/auth/me */
router.get("/me", requireAuth, (req, res) => {
  res.json({ user: req.user });
});

/** PATCH /api/auth/profile — name and/or password change. */
router.patch("/profile", requireAuth, (req, res) => {
  const firstName = sanitizeName(req.body?.firstName ?? req.user.firstName);
  const lastName = sanitizeName(req.body?.lastName ?? req.user.lastName);
  const password = req.body?.password ? String(req.body.password) : null;

  if (password !== null && password.length < 6) {
    return bad(res, 400, "weak_password", "رمز عبور جدید باید حداقل ۶ کاراکتر باشد.");
  }

  if (password !== null) {
    db.prepare("UPDATE users SET first_name = ?, last_name = ?, password_hash = ? WHERE id = ?").run(
      firstName,
      lastName,
      hashPassword(password),
      req.user.id,
    );
    // every other session is invalidated after a password change
    db.prepare("DELETE FROM sessions WHERE user_id = ? AND token != ?").run(req.user.id, req.token);
  } else {
    db.prepare("UPDATE users SET first_name = ?, last_name = ? WHERE id = ?").run(
      firstName,
      lastName,
      req.user.id,
    );
  }

  const row = db.prepare("SELECT * FROM users WHERE id = ?").get(req.user.id);
  res.json({ user: mapUser(row) });
});

export default router;

/**
 * Authentication helpers.
 *
 * Login is phone-number based: the phone number *is* the username and the
 * user picks a password. There is no OTP / SMS verification in this phase.
 */
import crypto from "node:crypto";
import { db, mapUser } from "./db.js";

const KEY_LEN = 64;

/** Normalizes Persian/Arabic digits and strips everything that is not a digit. */
export function normalizePhone(input) {
  if (typeof input !== "string") return "";
  const latin = input
    .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
  return latin.replace(/\D/g, "");
}

export function isValidPhone(phone) {
  return /^09\d{9}$/.test(phone);
}

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, KEY_LEN).toString("hex");
  return `scrypt$${salt}$${hash}`;
}

export function verifyPassword(password, stored) {
  const [scheme, salt, hash] = String(stored).split("$");
  if (scheme !== "scrypt" || !salt || !hash) return false;
  const candidate = crypto.scryptSync(password, salt, KEY_LEN).toString("hex");
  const a = Buffer.from(candidate, "hex");
  const b = Buffer.from(hash, "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function createSession(userId) {
  const token = crypto.randomBytes(32).toString("hex");
  db.prepare("INSERT INTO sessions (token, user_id, created_at) VALUES (?, ?, ?)").run(
    token,
    userId,
    new Date().toISOString(),
  );
  return token;
}

export function destroySession(token) {
  if (!token) return;
  db.prepare("DELETE FROM sessions WHERE token = ?").run(token);
}

export function userByToken(token) {
  if (!token) return null;
  const row = db
    .prepare(
      `SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ?`,
    )
    .get(token);
  return row ? mapUser(row) : null;
}

/* ------------------------------------------------------------------ */
/* express middleware                                                  */
/* ------------------------------------------------------------------ */

export function bearerToken(req) {
  const header = req.headers.authorization ?? "";
  return header.startsWith("Bearer ") ? header.slice(7).trim() : "";
}

/** Rejects the request when there is no valid session. */
export function requireAuth(req, res, next) {
  const user = userByToken(bearerToken(req));
  if (!user) {
    return res.status(401).json({ error: { code: "unauthorized", message: "برای این کار باید وارد حساب شوید." } });
  }
  req.user = user;
  req.token = bearerToken(req);
  next();
}

/* ------------------------------------------------------------------ */
/* tiny in-memory throttle for the login endpoint                      */
/* ------------------------------------------------------------------ */

const attempts = new Map();
const WINDOW_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 12;

export function loginThrottle(req, res, next) {
  const key = `${req.ip}|${normalizePhone(req.body?.phone ?? "")}`;
  const now = Date.now();
  const entry = attempts.get(key);
  if (entry && now - entry.first < WINDOW_MS && entry.count >= MAX_ATTEMPTS) {
    const minutes = Math.ceil((WINDOW_MS - (now - entry.first)) / 60000);
    return res.status(429).json({
      error: { code: "too_many_attempts", message: `تلاش‌های ناموفق زیاد بود؛ ${minutes} دقیقه دیگر تلاش کنید.` },
    });
  }
  res.on("finish", () => {
    if (res.statusCode === 401) {
      const current = attempts.get(key);
      if (!current || now - current.first >= WINDOW_MS) attempts.set(key, { count: 1, first: now });
      else current.count += 1;
    } else if (res.statusCode === 200) {
      attempts.delete(key);
    }
  });
  next();
}

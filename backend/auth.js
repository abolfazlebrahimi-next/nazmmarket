/** Phone-number username and password auth; no OTP/SMS flow. */
import crypto from "node:crypto";
import { db, mapUser } from "./db.js";

const KEY_LEN = 64;
export function normalizePhone(input) {
  if (typeof input !== "string") return "";
  const latin = input.replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d))).replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
  return latin.replace(/\D/g, "");
}
export const isValidPhone = (phone) => /^09\d{9}$/.test(phone);
export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  return `scrypt$${salt}$${crypto.scryptSync(password, salt, KEY_LEN).toString("hex")}`;
}
export function verifyPassword(password, stored) {
  const [scheme, salt, hash] = String(stored).split("$");
  if (scheme !== "scrypt" || !salt || !hash) return false;
  const a = Buffer.from(crypto.scryptSync(password, salt, KEY_LEN).toString("hex"), "hex");
  const b = Buffer.from(hash, "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
export async function createSession(userId) {
  const token = crypto.randomBytes(32).toString("hex");
  await db.run("INSERT INTO sessions (token, user_id, created_at) VALUES (?, ?, ?)", [token, userId, new Date().toISOString()]);
  return token;
}
export async function destroySession(token) {
  if (token) await db.run("DELETE FROM sessions WHERE token = ?", [token]);
}
export async function userByToken(token) {
  if (!token) return null;
  const row = await db.get("SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ?", [token]);
  return row ? mapUser(row) : null;
}
export function bearerToken(req) {
  const header = req.headers.authorization ?? "";
  return header.startsWith("Bearer ") ? header.slice(7).trim() : "";
}
export async function requireAuth(req, res, next) {
  try {
    const token = bearerToken(req);
    const user = await userByToken(token);
    if (!user) return res.status(401).json({ error: { code: "unauthorized", message: "برای این کار باید وارد حساب شوید." } });
    req.user = user;
    req.token = token;
    next();
  } catch (error) { next(error); }
}

const attempts = new Map();
const WINDOW_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 12;
export function loginThrottle(req, res, next) {
  const key = `${req.ip}|${normalizePhone(req.body?.phone ?? "")}`;
  const now = Date.now();
  const entry = attempts.get(key);
  if (entry && now - entry.first < WINDOW_MS && entry.count >= MAX_ATTEMPTS) {
    const minutes = Math.ceil((WINDOW_MS - (now - entry.first)) / 60000);
    return res.status(429).json({ error: { code: "too_many_attempts", message: `تلاش‌های ناموفق زیاد بود؛ ${minutes} دقیقه دیگر تلاش کنید.` } });
  }
  res.on("finish", () => {
    if (res.statusCode === 401) {
      const current = attempts.get(key);
      if (!current || now - current.first >= WINDOW_MS) attempts.set(key, { count: 1, first: now });
      else current.count += 1;
    } else if (res.statusCode === 200) attempts.delete(key);
  });
  next();
}

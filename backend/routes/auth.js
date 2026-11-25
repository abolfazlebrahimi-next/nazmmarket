import { Router } from "express";
import crypto from "node:crypto";
import { db, mapAddress, mapUser } from "../db.js";
import { bearerToken, createSession, destroySession, hashPassword, isValidPhone, loginThrottle, normalizePhone, requireAuth, verifyPassword } from "../auth.js";
const router = Router();
const bad = (res, status, code, message) => res.status(status).json({ error: { code, message } });
const sanitizeName = (v) => String(v ?? "").trim().slice(0, 40);
const OTP_TTL_MS = 5 * 60 * 1000;
const OTP_RESEND_MS = 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;
const OTP_REQUEST_WINDOW_MS = 15 * 60 * 1000;
const OTP_REQUEST_MAX = 5;
const otpRequestAttempts = new Map();
const otpSendingPhones = new Set();
const genericOtpMessage = "اگر حسابی با این شماره وجود داشته باشد، کد ورود پیامک می‌شود.";

function otpRequestThrottle(req, res, next) {
  const now = Date.now();
  const phone = normalizePhone(req.body?.phone ?? "");
  if (otpRequestAttempts.size > 1000) {
    for (const [entryKey, entry] of otpRequestAttempts)
      if (now - entry.startedAt >= OTP_REQUEST_WINDOW_MS) otpRequestAttempts.delete(entryKey);
  }
  const limits = [
    { key: `ip:${req.ip ?? "unknown"}`, max: 20 },
    { key: `phone:${phone}`, max: OTP_REQUEST_MAX },
  ];
  for (const limit of limits) {
    const entry = otpRequestAttempts.get(limit.key);
    if (entry && now - entry.startedAt < OTP_REQUEST_WINDOW_MS && entry.count >= limit.max)
      return bad(res, 429, "otp_rate_limited", "درخواست‌های کد ورود زیاد است؛ کمی بعد دوباره تلاش کنید.");
  }
  for (const limit of limits) {
    const entry = otpRequestAttempts.get(limit.key);
    if (!entry || now - entry.startedAt >= OTP_REQUEST_WINDOW_MS)
      otpRequestAttempts.set(limit.key, { startedAt: now, count: 1 });
    else entry.count += 1;
  }
  next();
}

function melipayamakOtpUrl() {
  const configured = process.env.MELIPAYAMAK_OTP_URL?.trim();
  if (!configured) return null;
  try {
    const url = new URL(configured);
    const path = url.pathname.split("/").filter(Boolean);
    if (url.protocol !== "https:" || url.hostname !== "console.melipayamak.com" ||
        (url.port && url.port !== "443") || url.username || url.password || url.search || url.hash ||
        path.length !== 4 || path[0] !== "api" || path[1] !== "send" ||
        path[2] !== "otp" || !path[3])
      return null;
    return url;
  } catch {
    return null;
  }
}

function otpHashConfigured() {
  return typeof process.env.AUTH_OTP_HASH_KEY === "string" &&
    process.env.AUTH_OTP_HASH_KEY.trim().length >= 32;
}

function hashOtp(code, salt) {
  return crypto.createHmac("sha256", process.env.AUTH_OTP_HASH_KEY.trim())
    .update(`${salt}:${code}`)
    .digest("hex");
}

function otpMatches(code, otpRow) {
  const stored = Buffer.from(String(otpRow.code_hash ?? ""), "hex");
  const candidate = Buffer.from(hashOtp(code, String(otpRow.salt ?? "")), "hex");
  return stored.length === candidate.length && stored.length === 32 && crypto.timingSafeEqual(stored, candidate);
}

function isOtpCode(code) {
  return code.length >= 4 && code.length <= 12 &&
    [...code].every((digit) => digit >= "0" && digit <= "9");
}

function providerOtpCode(payload) {
  const value = payload?.code;
  if (typeof value === "string") return value.trim();
  // Some JSON APIs serialize numeric codes as numbers. Accept safe integers;
  // string responses remain important for codes that begin with zero.
  if (typeof value === "number" && Number.isSafeInteger(value) && value >= 0)
    return String(value);
  return "";
}

function safeOtpErrorDetails(error) {
  const rawCode = error?.cause?.code ?? error?.code;
  const errorCode = typeof rawCode === "string" && /^[A-Z0-9_]{1,40}$/.test(rawCode)
    ? rawCode
    : undefined;
  const rawName = typeof error?.name === "string" ? error.name : "Error";
  const errorName = /^[A-Za-z][A-Za-z0-9_]{0,39}$/.test(rawName) ? rawName : "Error";
  return { errorName, ...(errorCode ? { errorCode } : {}) };
}

function safeProviderStatus(status, endpoint, phone, code) {
  if (typeof status !== "string") return undefined;
  let safe = status.replace(/[\u0000-\u001f\u007f]/g, " ");
  const pathToken = endpoint.pathname.split("/").filter(Boolean).at(-1) ?? "";
  const sensitiveValues = [phone, code, pathToken];
  try {
    sensitiveValues.push(decodeURIComponent(pathToken));
  } catch {
    // Keep the encoded token candidate only.
  }
  for (const value of sensitiveValues)
    if (typeof value === "string" && value.length >= 4)
      safe = safe.replaceAll(value, "[redacted]");
  return safe.replace(/[0-9۰-۹٠-٩]{4,12}/g, "[number]").trim().slice(0, 240);
}

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

router.post("/otp/request", otpRequestThrottle, async (req, res) => {
  const phone = normalizePhone(req.body?.phone ?? "");
  if (!isValidPhone(phone))
    return bad(res, 400, "invalid_phone", "شماره موبایل باید ۱۱ رقم و با ۰۹ شروع شود.");
  const endpoint = melipayamakOtpUrl();
  if (!endpoint || !otpHashConfigured())
    return bad(res, 503, "otp_unavailable", "ورود پیامکی هنوز روی سرور پیکربندی نشده است.");

  const now = Date.now();
  await db.run("DELETE FROM auth_otps WHERE expires_at < ?", [now]);
  const user = await db.get("SELECT id FROM users WHERE phone = ?", [phone]);
  if (!user) return res.json({ ok: true, message: genericOtpMessage });

  const previous = await db.get("SELECT sent_at FROM auth_otps WHERE phone = ?", [phone]);
  if (previous && now - Number(previous.sent_at) < OTP_RESEND_MS)
    return res.json({ ok: true, message: genericOtpMessage });
  if (otpSendingPhones.has(phone))
    return res.json({ ok: true, message: genericOtpMessage });

  otpSendingPhones.add(phone);
  let stage = "provider_request";
  try {
    const providerResponse = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ to: phone }),
      redirect: "error",
      signal: AbortSignal.timeout(10_000),
    });
    const providerPayload = await providerResponse.json().catch(() => null);
    const code = providerOtpCode(providerPayload);
    // MeliPayamak's sample includes a `status` field, but its accepted values
    // are not documented here. Trust the HTTP response and returned code only.
    if (!providerResponse.ok || !isOtpCode(code)) {
      const rawCode = providerPayload && typeof providerPayload === "object"
        ? providerPayload.code
        : undefined;
      const rawStatus = providerPayload && typeof providerPayload === "object"
        ? providerPayload.status
        : undefined;
      console.warn("[auth:otp] provider response rejected", {
        httpStatus: providerResponse.status,
        contentType: providerResponse.headers.get("content-type")?.split(";")[0] ?? "unknown",
        codeType: rawCode === undefined ? "missing" : rawCode === null ? "null" : typeof rawCode,
        codeLength: code.length,
        statusType: rawStatus === undefined ? "missing" : rawStatus === null ? "null" : typeof rawStatus,
        statusPreview: safeProviderStatus(rawStatus, endpoint, phone, code),
      });
      return bad(res, 502, "otp_send_failed", "ارسال کد پیامکی انجام نشد؛ کمی بعد دوباره تلاش کنید.");
    }

    stage = "otp_storage";
    const salt = crypto.randomBytes(16).toString("hex");
    const sentAt = Date.now();
    await db.run(
      `INSERT INTO auth_otps (phone, code_hash, salt, expires_at, sent_at, attempts)
       VALUES (?, ?, ?, ?, ?, 0)
       ON DUPLICATE KEY UPDATE code_hash=VALUES(code_hash),salt=VALUES(salt),expires_at=VALUES(expires_at),sent_at=VALUES(sent_at),attempts=0`,
      [phone, hashOtp(code, salt), salt, sentAt + OTP_TTL_MS, sentAt],
    );
    return res.json({ ok: true, message: genericOtpMessage });
  } catch (error) {
    console.warn("[auth:otp] request failed", { stage, ...safeOtpErrorDetails(error) });
    if (stage === "otp_storage")
      return bad(res, 500, "otp_store_failed", "ثبت کد ورود انجام نشد؛ کمی بعد دوباره تلاش کنید.");
    return bad(res, 502, "otp_send_failed", "ارسال کد پیامکی انجام نشد؛ کمی بعد دوباره تلاش کنید.");
  } finally {
    otpSendingPhones.delete(phone);
  }
});

router.post("/otp/verify", loginThrottle, async (req, res) => {
  if (!otpHashConfigured())
    return bad(res, 503, "otp_unavailable", "ورود پیامکی هنوز روی سرور پیکربندی نشده است.");
  const phone = normalizePhone(req.body?.phone ?? "");
  const code = normalizePhone(req.body?.code ?? "");
  if (!isValidPhone(phone) || !isOtpCode(code))
    return bad(res, 400, "invalid_otp", "شماره موبایل یا کد یکبارمصرف معتبر نیست.");

  const result = await db.transaction(async (tx) => {
    const otp = await tx.get(
      "SELECT phone, code_hash, salt, expires_at, attempts FROM auth_otps WHERE phone = ? FOR UPDATE",
      [phone],
    );
    if (!otp) return null;
    if (Number(otp.expires_at) <= Date.now() || Number(otp.attempts) >= OTP_MAX_ATTEMPTS) {
      await tx.run("DELETE FROM auth_otps WHERE phone = ?", [phone]);
      return null;
    }
    if (!otpMatches(code, otp)) {
      if (Number(otp.attempts) + 1 >= OTP_MAX_ATTEMPTS)
        await tx.run("DELETE FROM auth_otps WHERE phone = ?", [phone]);
      else
        await tx.run("UPDATE auth_otps SET attempts = attempts + 1 WHERE phone = ?", [phone]);
      return null;
    }

    const user = await tx.get("SELECT * FROM users WHERE phone = ?", [phone]);
    if (!user) {
      await tx.run("DELETE FROM auth_otps WHERE phone = ?", [phone]);
      return null;
    }
    const addresses = (await tx.all(
      "SELECT * FROM addresses WHERE user_id = ? ORDER BY id ASC",
      [user.id],
    )).map(mapAddress);
    const token = crypto.randomBytes(32).toString("hex");
    await tx.run("DELETE FROM auth_otps WHERE phone = ?", [phone]);
    await tx.run(
      "INSERT INTO sessions (token, user_id, created_at) VALUES (?, ?, ?)",
      [token, user.id, new Date().toISOString()],
    );
    return { token, user: mapUser(user), addresses };
  });

  if (!result)
    return bad(res, 401, "invalid_otp", "کد یکبارمصرف نادرست یا منقضی شده است؛ کد تازه بگیرید.");
  res.json(result);
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

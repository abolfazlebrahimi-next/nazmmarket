import test from "node:test";
import assert from "node:assert/strict";
import app from "../app.js";
import { db, pool } from "../db.js";
import { verifyPassword } from "../auth.js";

const originalFetch = globalThis.fetch;
const originalOtpUrl = process.env.MELIPAYAMAK_OTP_URL;
const originalOtpHashKey = process.env.AUTH_OTP_HASH_KEY;
process.env.MELIPAYAMAK_OTP_URL =
  "https://console.melipayamak.com/api/send/otp/test-provider-key-not-real";
process.env.AUTH_OTP_HASH_KEY = "test-only-otp-hash-key-with-enough-length";

const phone = "09123456789";
const newPhone = "09876543210";
const user = {
  id: 7,
  phone,
  password_hash: "old-password-hash",
  first_name: "Test",
  last_name: "Customer",
  wallet: 0,
  pro: 0,
  created_at: "2026-01-01T00:00:00.000Z",
};
const users = new Map([[phone, user]]);
const challenges = new Map();
let nextUserId = 8;
let otpRow = null;
let providerRequest = null;
let providerResponsePayload = { code: "004271", status: "sent" };
let providerResponseStatus = 200;
let insertedSessions = [];

db.get = async (sql, values = []) => {
  if (sql.includes("FROM users WHERE phone = ?")) return users.get(values[0]) ?? null;
  if (sql.includes("FROM auth_otps WHERE phone = ?"))
    return otpRow?.phone === values[0] ? otpRow : null;
  if (sql.includes("FROM auth_otp_challenges WHERE token_hash = ?"))
    return challenges.get(values[0]) ?? null;
  throw new Error(`Unexpected OTP test query: ${sql}`);
};
db.run = async (sql, values = []) => {
  if (sql.includes("DELETE FROM auth_otps WHERE expires_at")) return { affectedRows: 0 };
  if (sql.includes("DELETE FROM auth_otp_challenges WHERE expires_at")) return { affectedRows: 0 };
  if (sql.includes("INSERT INTO auth_otps")) {
    otpRow = {
      phone: values[0],
      code_hash: values[1],
      salt: values[2],
      expires_at: values[3],
      sent_at: values[4],
      attempts: 0,
      purpose: values[5],
    };
    return { affectedRows: 1 };
  }
  throw new Error(`Unexpected OTP test write: ${sql}`);
};
db.transaction = async (work) => {
  const tx = {
    get: async (sql, values = []) => {
      if (sql.includes("FROM auth_otps WHERE phone = ?"))
        return otpRow?.phone === values[0] ? otpRow : null;
      if (sql.includes("FROM auth_otp_challenges WHERE token_hash = ?"))
        return challenges.get(values[0]) ?? null;
      if (sql.includes("FROM users WHERE phone = ?")) return users.get(values[0]) ?? null;
      if (sql.includes("FROM users WHERE id = ?"))
        return [...users.values()].find((row) => Number(row.id) === Number(values[0])) ?? null;
      throw new Error(`Unexpected OTP test transaction read: ${sql}`);
    },
    all: async (sql) => {
      if (sql.includes("FROM addresses")) return [];
      throw new Error(`Unexpected OTP test transaction list: ${sql}`);
    },
    run: async (sql, values = []) => {
      if (sql.includes("DELETE FROM auth_otps WHERE phone = ?")) {
        if (otpRow?.phone === values[0]) otpRow = null;
        return { affectedRows: 1 };
      }
      if (sql.includes("UPDATE auth_otps SET attempts")) {
        if (otpRow) otpRow.attempts += 1;
        return { affectedRows: 1 };
      }
      if (sql.includes("DELETE FROM auth_otp_challenges WHERE phone = ? AND purpose = ?")) {
        for (const [tokenHash, challenge] of challenges)
          if (challenge.phone === values[0] && challenge.purpose === values[1])
            challenges.delete(tokenHash);
        return { affectedRows: 1 };
      }
      if (sql.includes("INSERT INTO auth_otp_challenges")) {
        challenges.set(values[0], {
          token_hash: values[0],
          phone: values[1],
          purpose: values[2],
          expires_at: values[3],
          created_at: values[4],
        });
        return { affectedRows: 1 };
      }
      if (sql.includes("DELETE FROM auth_otp_challenges WHERE token_hash = ?")) {
        challenges.delete(values[0]);
        return { affectedRows: 1 };
      }
      if (sql.includes("INSERT INTO users")) {
        const inserted = {
          id: nextUserId++,
          phone: values[0],
          password_hash: values[1],
          first_name: values[2],
          last_name: values[3],
          wallet: 0,
          pro: 0,
          created_at: values[4],
        };
        users.set(inserted.phone, inserted);
        return { insertId: inserted.id, affectedRows: 1 };
      }
      if (sql.includes("UPDATE users SET password_hash = ? WHERE id = ?")) {
        const existing = [...users.values()].find((row) => Number(row.id) === Number(values[1]));
        if (existing) existing.password_hash = values[0];
        return { affectedRows: existing ? 1 : 0 };
      }
      if (sql.includes("DELETE FROM sessions WHERE user_id = ?")) {
        insertedSessions = insertedSessions.filter((session) => session.userId !== Number(values[0]));
        return { affectedRows: 1 };
      }
      if (sql.includes("INSERT INTO sessions")) {
        insertedSessions.push({ token: values[0], userId: Number(values[1]) });
        return { affectedRows: 1 };
      }
      throw new Error(`Unexpected OTP test transaction write: ${sql}`);
    },
  };
  return work(tx);
};

globalThis.fetch = async (input, init) => {
  if (String(input).startsWith("https://console.melipayamak.com/")) {
    providerRequest = { url: String(input), body: JSON.parse(init.body) };
    return new Response(JSON.stringify(providerResponsePayload), {
      status: providerResponseStatus,
      headers: { "Content-Type": "application/json" },
    });
  }
  return originalFetch(input, init);
};

const server = app.listen(0, "127.0.0.1");
await new Promise((resolve) => server.once("listening", resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const post = (path, body) => originalFetch(base + path, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

// Login, registration and reset use independent OTP purposes, but share the
// same safe request/verification/session handling as the production routes.
test("OTP login stores only a hash and never returns the provider code to the browser", async () => {
  otpRow = null;
  providerResponsePayload = { code: "004271", status: "sent" };
  providerResponseStatus = 200;
  providerRequest = null;

  const response = await post("/api/auth/otp/request", { phone, purpose: "login" });
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.ok, true);
  assert.equal(JSON.stringify(payload).includes("004271"), false);
  assert.equal(providerRequest.body.to, phone);
  assert.equal(otpRow.phone, phone);
  assert.equal(otpRow.purpose, "login");
  assert.notEqual(otpRow.code_hash, "004271");
  assert.equal(otpRow.code_hash.length, 64);
  assert.equal(otpRow.attempts, 0);
});

test("OTP verification rejects wrong codes and creates a normal session once", async () => {
  const wrong = await post("/api/auth/otp/verify", { phone, code: "111111" });
  assert.equal(wrong.status, 401);
  assert.equal(otpRow.attempts, 1);

  const response = await post("/api/auth/otp/verify", { phone, code: "004271" });
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.user.phone, phone);
  assert.equal(payload.user.firstName, "Test");
  assert.equal(payload.addresses.length, 0);
  assert.equal(typeof payload.token, "string");
  assert.equal(payload.token.length, 64);
  assert.deepEqual(insertedSessions.at(-1), { token: payload.token, userId: user.id });
  assert.equal(otpRow, null);

  const replay = await post("/api/auth/otp/verify", { phone, code: "004271" });
  assert.equal(replay.status, 401);
});

test("numeric provider codes are accepted", async () => {
  providerResponsePayload = { code: 731946, status: "sent" };
  const request = await post("/api/auth/otp/request", { phone, purpose: "login" });
  assert.equal(request.status, 200);
  const response = await post("/api/auth/otp/verify", { phone, code: "731946" });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).user.phone, phone);
  assert.equal(otpRow, null);
});

test("a verified new number can create one account and session", async () => {
  providerResponsePayload = { code: "0073", status: "sent" };
  const request = await post("/api/auth/otp/request", { phone: newPhone, purpose: "login" });
  assert.equal(request.status, 200);
  assert.equal(providerRequest.body.to, newPhone);

  const verified = await post("/api/auth/otp/verify", { phone: newPhone, code: "0073" });
  assert.equal(verified.status, 200);
  const challenge = await verified.json();
  assert.equal(challenge.needsRegistration, true);
  assert.match(challenge.signupToken, /^[a-f0-9]{64}$/);
  assert.equal("token" in challenge, false);

  const registered = await post("/api/auth/otp/register", {
    signupToken: challenge.signupToken,
    name: "New Customer",
    password: "new-password-123",
  });
  assert.equal(registered.status, 201);
  const payload = await registered.json();
  assert.equal(payload.user.phone, newPhone);
  assert.equal(payload.user.firstName, "New");
  assert.equal(payload.user.lastName, "Customer");
  assert.equal(payload.addresses.length, 0);
  assert.deepEqual(insertedSessions.at(-1), { token: payload.token, userId: users.get(newPhone).id });
  assert.equal(challenges.size, 0);

  const replay = await post("/api/auth/otp/register", {
    signupToken: challenge.signupToken,
    name: "New Customer",
    password: "new-password-123",
  });
  assert.equal(replay.status, 401);
});

test("password reset requires its own OTP purpose and consumes the reset challenge once", async () => {
  providerResponsePayload = { code: "5824", status: "sent" };
  const request = await post("/api/auth/otp/request", {
    phone,
    purpose: "password_reset",
  });
  assert.equal(request.status, 200);
  assert.equal(otpRow.purpose, "password_reset");

  const wrongPurpose = await post("/api/auth/otp/verify", { phone, code: "5824" });
  assert.equal(wrongPurpose.status, 401);
  assert.equal(otpRow.purpose, "password_reset");

  const verified = await post("/api/auth/otp/verify-reset", { phone, code: "5824" });
  assert.equal(verified.status, 200);
  const { resetToken } = await verified.json();
  assert.match(resetToken, /^[a-f0-9]{64}$/);

  const reset = await post("/api/auth/otp/reset-password", {
    resetToken,
    password: "changed-password-456",
  });
  assert.equal(reset.status, 200);
  const payload = await reset.json();
  assert.equal(payload.user.phone, phone);
  assert.equal(verifyPassword("changed-password-456", users.get(phone).password_hash), true);
  assert.deepEqual(insertedSessions.at(-1), { token: payload.token, userId: user.id });
  assert.equal(challenges.size, 0);

  const replay = await post("/api/auth/otp/reset-password", {
    resetToken,
    password: "another-password-789",
  });
  assert.equal(replay.status, 401);
});

test("customer registration requires a verified OTP challenge", async () => {
  const unverifiedPhone = "09765432109";
  const response = await post("/api/auth/register", {
    phone: unverifiedPhone,
    password: "unverified-password",
  });
  assert.equal(response.status, 410);
  assert.equal(users.has(unverifiedPhone), false);
});

test("provider diagnostics redact phone, OTP-like numbers, and endpoint token", async () => {
  providerResponseStatus = 400;
  providerResponsePayload = {
    status: `invalid request for ${phone}; code 555666; token test-provider-key-not-real`,
  };
  const warnings = [];
  const originalWarn = console.warn;
  console.warn = (...args) => warnings.push(args);
  try {
    const response = await post("/api/auth/otp/request", { phone, purpose: "login" });
    assert.equal(response.status, 502);
  } finally {
    console.warn = originalWarn;
  }

  const diagnostic = JSON.stringify(warnings);
  assert.match(diagnostic, /invalid request/);
  assert.equal(diagnostic.includes(phone), false);
  assert.equal(diagnostic.includes("555666"), false);
  assert.equal(diagnostic.includes("test-provider-key-not-real"), false);
  assert.match(diagnostic, /\[redacted\]/);
});

test.after(async () => {
  globalThis.fetch = originalFetch;
  if (originalOtpUrl === undefined) delete process.env.MELIPAYAMAK_OTP_URL;
  else process.env.MELIPAYAMAK_OTP_URL = originalOtpUrl;
  if (originalOtpHashKey === undefined) delete process.env.AUTH_OTP_HASH_KEY;
  else process.env.AUTH_OTP_HASH_KEY = originalOtpHashKey;
  server.closeAllConnections?.();
  await new Promise((resolve) => server.close(resolve));
  await pool.end();
});

import test from "node:test";
import assert from "node:assert/strict";
import app from "../app.js";
import { db, pool } from "../db.js";

const originalFetch = globalThis.fetch;
const originalOtpUrl = process.env.MELIPAYAMAK_OTP_URL;
const originalOtpHashKey = process.env.AUTH_OTP_HASH_KEY;
process.env.MELIPAYAMAK_OTP_URL =
  "https://console.melipayamak.com/api/send/otp/test-provider-key-not-real";
process.env.AUTH_OTP_HASH_KEY = "test-only-otp-hash-key-with-enough-length";

const phone = "09123456789";
const providerCode = "004271";
const user = {
  id: 7,
  phone,
  first_name: "Test",
  last_name: "Customer",
  wallet: 0,
  pro: 0,
  created_at: "2026-01-01T00:00:00.000Z",
};
let otpRow = null;
let providerRequest = null;
let insertedSession = null;

db.get = async (sql, values = []) => {
  if (sql.includes("FROM users WHERE phone = ?"))
    return values[0] === phone ? user : null;
  if (sql.includes("FROM auth_otps WHERE phone = ?"))
    return values[0] === phone ? otpRow : null;
  throw new Error(`Unexpected OTP test query: ${sql}`);
};
db.run = async (sql, values = []) => {
  if (sql.includes("DELETE FROM auth_otps WHERE expires_at")) return { affectedRows: 0 };
  if (sql.includes("INSERT INTO auth_otps")) {
    otpRow = {
      phone: values[0],
      code_hash: values[1],
      salt: values[2],
      expires_at: values[3],
      sent_at: values[4],
      attempts: 0,
    };
    return { affectedRows: 1 };
  }
  throw new Error(`Unexpected OTP test write: ${sql}`);
};
db.transaction = async (work) => {
  const tx = {
    get: async (sql, values = []) => {
      if (sql.includes("FROM auth_otps WHERE phone = ?"))
        return values[0] === phone ? otpRow : null;
      if (sql.includes("FROM users WHERE phone = ?"))
        return values[0] === phone ? user : null;
      throw new Error(`Unexpected OTP test transaction read: ${sql}`);
    },
    all: async (sql) => {
      if (sql.includes("FROM addresses")) return [];
      throw new Error(`Unexpected OTP test transaction list: ${sql}`);
    },
    run: async (sql, values = []) => {
      if (sql.includes("DELETE FROM auth_otps WHERE phone = ?")) {
        otpRow = null;
        return { affectedRows: 1 };
      }
      if (sql.includes("UPDATE auth_otps SET attempts")) {
        otpRow.attempts += 1;
        return { affectedRows: 1 };
      }
      if (sql.includes("INSERT INTO sessions")) {
        insertedSession = { token: values[0], userId: values[1] };
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
    return new Response(JSON.stringify({ code: providerCode, status: "sent" }), {
      status: 200,
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

test("OTP login stores only a hash and never returns the provider code to the browser", async () => {
  otpRow = null;
  providerRequest = null;
  insertedSession = null;

  const response = await post("/api/auth/otp/request", { phone });
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.ok, true);
  assert.equal(JSON.stringify(payload).includes(providerCode), false);
  assert.equal(providerRequest.body.to, phone);
  assert.equal(otpRow.phone, phone);
  assert.notEqual(otpRow.code_hash, providerCode);
  assert.equal(otpRow.code_hash.length, 64);
  assert.equal(otpRow.attempts, 0);
});

test("OTP verification rejects wrong codes, then creates a normal customer session once", async () => {
  const wrong = await post("/api/auth/otp/verify", { phone, code: "111111" });
  assert.equal(wrong.status, 401);
  assert.equal(otpRow.attempts, 1);

  const response = await post("/api/auth/otp/verify", { phone, code: providerCode });
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.user.phone, phone);
  assert.equal(payload.user.firstName, "Test");
  assert.equal(payload.addresses.length, 0);
  assert.equal(typeof payload.token, "string");
  assert.equal(payload.token.length, 64);
  assert.deepEqual(insertedSession, { token: payload.token, userId: user.id });
  assert.equal(otpRow, null);

  const replay = await post("/api/auth/otp/verify", { phone, code: providerCode });
  assert.equal(replay.status, 401);
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

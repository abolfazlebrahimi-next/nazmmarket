import test from "node:test";
import assert from "node:assert/strict";
import app from "../app.js";
import { db, pool } from "../db.js";

/**
 * The admin panel's 401s on «کدهای تخفیف» were a mount mismatch, not a dead
 * session: the promo handlers were registered at /operations/promos while the
 * router is mounted at /api/admin, so the documented path never matched a
 * handler. A second bug turned that miss into a misleading 401 — routes/orders.js
 * mounted `requireAuth` on the whole router at "/api", so any unmatched path was
 * challenged as if the login had expired.
 *
 * These checks pin the wiring: documented admin paths reach their handler, and a
 * path that truly does not exist answers 404 instead of a fake login error.
 */
const saved = { get: db.get, all: db.all, run: db.run };

/** Only the reads these routes make; everything else answers "empty". */
db.get = async (sql, values = []) => {
  if (sql.includes("FROM admin_sessions"))
    return values[0] === "admin-token"
      ? { token: "admin-token", expires_at: new Date(Date.now() + 3600e3).toISOString() }
      : null;
  if (sql.includes("FROM sessions"))
    return values[0] === "customer-token" ? { id: 1, phone: "09123456789" } : null;
  if (/COUNT\(\*\)/.test(sql)) return { n: 0 };
  return null;
};
db.all = async (sql) => (sql.includes("FROM platform_promos") ? [] : []);
db.run = async () => ({ affectedRows: 1, insertId: 1 });

const server = app.listen(0, "127.0.0.1");
await new Promise((resolve) => server.once("listening", resolve));
const base = `http://127.0.0.1:${server.address().port}`;

const call = (url, token) =>
  fetch(base + url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

test.after(async () => {
  await new Promise((r) => server.close(r));
  db.get = saved.get;
  db.all = saved.all;
  db.run = saved.run;
  await pool.end().catch(() => {});
});

for (const path of [
  "/api/admin/operations/promos",
  "/api/admin/operations/promo-customers?q=",
  "/api/admin/operations/promos/1/redemptions",
])
  test(`documented admin path ${path} is served, not turned into a 401`, async () => {
    const res = await call(path, "admin-token");
    assert.equal(res.status, 200, "a valid admin token must reach the handler");
    assert.equal(res.headers.get("cache-control"), "no-store");
  });

test("promo endpoints stay admin-only", async () => {
  for (const token of [null, "customer-token"])
    for (const path of [
      "/api/admin/operations/promos",
      "/api/admin/operations/promo-customers",
      "/api/admin/operations/promos/1/redemptions",
    ]) {
      const res = await call(path, token);
      assert.equal(res.status, 401);
      // The admin guard answers; the customer guard would mean the request
      // leaked into another router before the admin one was consulted.
      assert.match(
        (await res.json()).error.message,
        /مدیر/,
        `${path} must be refused by the admin guard`,
      );
    }
});

test("an unmatched API path is 404, not a fake expired session", async () => {
  for (const url of ["/api/admin/nope", "/api/nope"])
    assert.equal((await call(url, "admin-token")).status, 404);
});

test("customer routes keep their own guard", async () => {
  assert.equal((await call("/api/orders")).status, 401);
  assert.equal((await call("/api/orders", "customer-token")).status, 200);
  assert.equal((await call("/api/promos", "customer-token")).status, 200);
});

import test from "node:test";
import assert from "node:assert/strict";
import app from "../app.js";
import { db, pool } from "../db.js";
// Route/access tests use a deliberately tiny persistence stub, not production fixture data.
// Real MySQL workflow coverage is in integration.test.js.
let active = false,
  verification = "pending";
db.get = async (sql, values = []) => {
  if (sql.includes("FROM admin_sessions"))
    return values[0] === "admin-token" ? { token: "admin-token" } : null;
  if (sql.includes("FROM seller_sessions"))
    return values[0] === "seller-token"
      ? { id: 1, phone: "09123456789", owner_name: "Test seller", active: 1 }
      : null;
  if (sql.includes("FROM courier_sessions"))
    return values[0] === "courier-token"
      ? {
          id: 1,
          phone: "09123456789",
          full_name: "Test courier",
          vehicle: "motorcycle",
          active,
          verification_status: verification,
        }
      : null;
  if (sql.includes("FROM stores WHERE seller_id")) return { id: 1 };
  throw new Error("Unexpected DB read in security test: " + sql);
};
const server = app.listen(0, "127.0.0.1");
await new Promise((resolve) => server.once("listening", resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const request = (url, token, body, method = "GET") =>
  fetch(base + url, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
test.after(async () => {
  await new Promise((r) => server.close(r));
  await pool.end();
});
for (const path of [
  "/api/admin/dashboard",
  "/api/admin/products",
  "/api/admin/couriers",
  "/api/admin/couriers/1/documents/national",
])
  test(`admin route ${path} denies missing/customer/seller/courier tokens`, async () => {
    for (const token of [
      null,
      "customer-token",
      "seller-token",
      "courier-token",
    ])
      assert.equal((await request(path, token)).status, 401);
  });
test("admin API cannot be cached", async () => {
  const r = await request("/api/admin/dashboard");
  assert.equal(r.headers.get("cache-control"), "no-store");
  assert.equal(r.headers.get("x-content-type-options"), "nosniff");
});
test("seller cannot write product metadata or stock", async () => {
  for (const body of [
    { name: "tampered" },
    { imageUrl: "/x" },
    { category: "drinks" },
    { stock: 999 },
    { active: true },
  ])
    assert.equal(
      (await request("/api/seller/products/1", "seller-token", body, "PATCH"))
        .status,
      400,
    );
});
test("seller cannot create arbitrary products", async () =>
  assert.equal(
    (
      await request(
        "/api/seller/products",
        "seller-token",
        { masterId: 1, price: 100, name: "tampered" },
        "POST",
      )
    ).status,
    400,
  ));
test("seller cannot delete products", async () =>
  assert.equal(
    (
      await request(
        "/api/seller/products/1",
        "seller-token",
        undefined,
        "DELETE",
      )
    ).status,
    403,
  ));
test("seller cannot mark pickup or completion", async () => {
  for (const status of [0, 1, 4, 5])
    assert.equal(
      (
        await request(
          "/api/seller/orders/X/status",
          "seller-token",
          { status },
          "PATCH",
        )
      ).status,
      400,
    );
});
test("pending courier can log in to verification area but not orders", async () => {
  assert.equal(
    (await request("/api/courier/auth/me", "courier-token")).status,
    200,
  );
  for (const path of [
    "/api/courier/orders",
    "/api/courier/orders/X/claim",
    "/api/courier/orders/X/complete",
  ])
    assert.equal(
      (
        await request(
          path,
          "courier-token",
          undefined,
          path.endsWith("orders") ? "GET" : "POST",
        )
      ).status,
      403,
    );
});
test("active flag alone does not bypass document approval", async () => {
  active = true;
  verification = "pending";
  assert.equal(
    (await request("/api/courier/orders", "courier-token")).status,
    403,
  );
  active = false;
});
test("invalid JSON gets a readable 400", async () => {
  const res = await fetch(base + "/api/admin/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{",
  });
  assert.equal(res.status, 400);
  assert.ok((await res.json()).error.message);
});
test("admin has no default credentials", async () => {
  assert.equal(
    (
      await request(
        "/api/admin/login",
        null,
        { username: "admin", password: "admin" },
        "POST",
      )
    ).status,
    401,
  );
});
test("private documents are never mounted as public static files", async () =>
  assert.notEqual(
    (await request("/api/private-uploads/secret.jpg")).status,
    200,
  ));

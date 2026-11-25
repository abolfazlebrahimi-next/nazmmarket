import test from "node:test";
import assert from "node:assert/strict";
import app from "../app.js";
import { db, pool } from "../db.js";

const saved = { get: db.get, all: db.all, run: db.run };
let currentEntry = {
  id: "1",
  role: "customer",
  firstName: "مشتری",
  lastName: "آزمایشی",
  phone: "09123456789",
  status: "registered",
  createdAt: "2026-11-25T10:00:00.000Z",
  updatedAt: null,
};
const writes = [];

db.get = async (sql, values = []) => {
  if (sql.includes("FROM admin_sessions"))
    return values[0] === "admin-token"
      ? {
          token: "admin-token",
          expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        }
      : null;
  if (sql.includes("AS pendingReview"))
    return {
      total: 1,
      customers: 1,
      sellers: 0,
      couriers: 0,
      newToday: 1,
      approved: 0,
      pendingReview: 1,
      contacted: 0,
      rejected: 0,
    };
  if (sql.includes("SELECT COUNT(*) AS total")) return { total: 1 };
  if (sql.includes("FROM admin_waitlist_entries w") && sql.includes("WHERE w.id=?"))
    return values[0] === currentEntry.id ? { ...currentEntry } : null;
  throw new Error("Unexpected waitlist DB read: " + sql);
};
db.all = async (sql) => {
  if (sql.includes("FROM admin_waitlist_entries w")) return [{ ...currentEntry }];
  throw new Error("Unexpected waitlist DB list: " + sql);
};
db.run = async (sql, values = []) => {
  writes.push({ sql, values });
  if (sql.includes("UPDATE admin_waitlist_entries")) {
    currentEntry = { ...currentEntry, status: values[0], updatedAt: values[1] };
  }
  return { affectedRows: 1, insertId: 1 };
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
  await new Promise((resolve) => server.close(resolve));
  db.get = saved.get;
  db.all = saved.all;
  db.run = saved.run;
  await pool.end().catch(() => {});
});

test("waitlist endpoints reject requests without an admin session", async () => {
  for (const [url, method, body] of [
    ["/api/v1/admin/waitlist", "GET"],
    ["/api/v1/admin/waitlist/stats", "GET"],
    ["/api/v1/admin/waitlist/1", "GET"],
    ["/api/v1/admin/waitlist/export", "GET"],
    ["/api/v1/admin/waitlist/1", "PATCH", { status: "approved" }],
  ]) {
    const response = await request(url, null, body, method);
    assert.equal(response.status, 401, `${method} ${url} must be admin-only`);
  }
});

test("list supports server query parameters and returns real record fields", async () => {
  const response = await request(
    "/api/v1/admin/waitlist?page=1&size=30&q=۰۹۱۲۳۴۵۶۷۸۹&role=customer&status=registered&sort=newest",
    "admin-token",
  );
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  const data = await response.json();
  assert.equal(data.total, 1);
  assert.equal(data.page, 1);
  assert.equal(data.size, 30);
  assert.equal(data.rows[0].id, "1");
  assert.equal(data.rows[0].role, "customer");
  assert.equal(data.rows[0].phone, "09123456789");
  assert.equal(data.rows[0].createdAt, "2026-11-25T10:00:00.000Z");
  assert.equal(
    writes.some((write) => write.sql.includes("INSERT IGNORE INTO admin_waitlist_entries")),
    false,
    "list reads must not full-scan and resync all registration tables",
  );
});

test("stats use the server aggregate contract", async () => {
  const response = await request("/api/v1/admin/waitlist/stats", "admin-token");
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).stats, {
    total: 1,
    customers: 1,
    sellers: 0,
    couriers: 0,
    newToday: 1,
    approved: 0,
    pendingReview: 1,
    contacted: 0,
    rejected: 0,
  });
});

test("detail and status update use the waitlist ID and allowed status field", async () => {
  const detail = await request("/api/v1/admin/waitlist/1", "admin-token");
  assert.equal(detail.status, 200);
  assert.equal((await detail.json()).entry.id, "1");

  const update = await request(
    "/api/v1/admin/waitlist/1",
    "admin-token",
    { status: "contacted" },
    "PATCH",
  );
  assert.equal(update.status, 200);
  const data = await update.json();
  assert.equal(data.entry.status, "contacted");
  assert.ok(data.entry.updatedAt);
  assert.ok(writes.some((write) => write.sql.includes("UPDATE admin_waitlist_entries")));

  const invalid = await request(
    "/api/v1/admin/waitlist/1",
    "admin-token",
    { status: "pending" },
    "PATCH",
  );
  assert.equal(invalid.status, 400);
});

test("export returns an authenticated UTF-8 CSV file", async () => {
  currentEntry = { ...currentEntry, firstName: '=HYPERLINK("https://example.com")' };
  const response = await request(
    "/api/v1/admin/waitlist/export?q=0912&role=customer&status=contacted&sort=oldest",
    "admin-token",
  );
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type"), /text\/csv/);
  assert.match(response.headers.get("content-disposition"), /waitlist\.csv/);
  const bytes = Buffer.from(await response.arrayBuffer());
  assert.deepEqual([...bytes.subarray(0, 3)], [0xef, 0xbb, 0xbf]);
  const csv = bytes.toString("utf8");
  assert.ok(csv.startsWith("\uFEFF"));
  assert.match(csv, /شناسه,نام,نام خانوادگی/);
  assert.match(csv, /'=HYPERLINK/);
});

test("versioned refresh renews only an active opaque admin session", async () => {
  const response = await request(
    "/api/v1/admin/auth/refresh",
    "admin-token",
    undefined,
    "POST",
  );
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.token, "admin-token");
  assert.ok(Date.parse(data.expiresAt) > Date.now());
  assert.ok(writes.some((write) => write.sql.includes("UPDATE admin_sessions")));
});

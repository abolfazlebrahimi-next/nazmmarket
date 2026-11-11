import test from "node:test";
import assert from "node:assert/strict";
import { db, pool } from "../db.js";
import { requireAdmin, ADMIN_SESSION_TTL_MS } from "../routes/admin.js";

/**
 * The admin panel's 401s came from the session, not from the API: a token that had
 * quietly passed its eight hours was still being sent by every poll. These checks pin
 * the middleware's behaviour — renew while the admin keeps working, say so plainly
 * once the session is really dead, and never reject a row an older version of the
 * table wrote without an expiry.
 */
const HOUR = 3600 * 1000;
const request = (token) => ({
  headers: token ? { authorization: `Bearer ${token}` } : {},
});

/** Stubbed persistence for one middleware call; returns what it saw and did. */
async function run(rows, token) {
  const queries = [];
  const savedGet = db.get;
  const savedRun = db.run;
  db.get = async (sql, values = []) => {
    queries.push({ sql, values });
    return (await rows.get(sql, values)) ?? null;
  };
  db.run = async (sql, values = []) => {
    queries.push({ sql, values });
    return { changes: 1 };
  };
  try {
    const outcome = await new Promise((resolve) => {
      let status = 200;
      const res = {
        status(code) {
          status = code;
          return this;
        },
        json(body) {
          resolve({ status, body });
        },
      };
      requireAdmin(request(token), res, () =>
        resolve({ status: 200, passed: true }),
      );
    });
    return { ...outcome, queries };
  } finally {
    db.get = savedGet;
    db.run = savedRun;
  }
}

const writes = (res) => res.queries.filter((q) => /UPDATE|DELETE/.test(q.sql));

test("a request with no token is refused before the database is asked", async () => {
  const res = await run({ get: () => null }, "");
  assert.equal(res.status, 401);
  assert.match(res.body.error.message, /الزامی/);
  assert.deepEqual(res.queries, [], "a missing token must not reach the DB");
});

test("an unknown token is refused", async () => {
  const res = await run({ get: () => null }, "nope");
  assert.equal(res.status, 401);
  assert.equal(res.queries.length, 1);
  assert.equal(res.passed, undefined);
});

test("a session with hours left passes and is not rewritten", async () => {
  const res = await run(
    { get: () => ({ token: "t", expires_at: new Date(Date.now() + 6 * HOUR).toISOString() }) },
    "t",
  );
  assert.equal(res.passed, true);
  assert.deepEqual(writes(res), [], "the row is renewed only when it is nearly expired");
});

test("a session close to expiry is renewed on use", async () => {
  const res = await run(
    { get: () => ({ token: "t", expires_at: new Date(Date.now() + HOUR / 4).toISOString() }) },
    "t",
  );
  assert.equal(res.passed, true);
  const write = res.queries.find((q) =>
    /UPDATE admin_sessions SET expires_at/.test(q.sql),
  );
  assert.ok(write, "the expiry should slide forward while the admin keeps working");
  assert.equal(write.values[1], "t");
  assert.ok(
    Date.parse(write.values[0]) > Date.now() + ADMIN_SESSION_TTL_MS - 60000,
    "the new expiry should be a full TTL from now",
  );
});

test("an expired session is dropped and asks for a new login", async () => {
  const res = await run(
    { get: () => ({ token: "t", expires_at: new Date(Date.now() - 1000).toISOString() }) },
    "t",
  );
  assert.equal(res.status, 401);
  assert.match(res.body.error.message, /تمام شده/);
  assert.ok(
    res.queries.some((q) => /DELETE FROM admin_sessions/.test(q.sql)),
    "a dead row should not linger in the table",
  );
});

test("a row written without an expiry stays accepted", async () => {
  const res = await run({ get: () => ({ token: "t" }) }, "t");
  assert.equal(res.passed, true);
  assert.deepEqual(writes(res), [], "an unreadable expiry is not an expired one");
});

test.after(async () => {
  await pool.end().catch(() => {});
});

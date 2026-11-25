import { once } from "node:events";
import { Router } from "express";
import { db } from "../db.js";

export const WAITLIST_ROLES = Object.freeze(["customer", "seller", "courier"]);
export const WAITLIST_STATUSES = Object.freeze([
  "registered",
  "contacted",
  "approved",
  "rejected",
]);

const router = Router();
const fail = (res, status, code, message) =>
  res.status(status).json({ error: { code, message } });

/*
 * This repository has three real registration sources rather than a single
 * waitlist table: users, seller_accounts and courier_accounts. A one-time
 * startup migration backfills existing accounts; the registration handlers
 * insert each new row transactionally. The admin-only table keeps the stable,
 * globally unique waitlist ID and review status while source rows remain the
 * authority for names, phone numbers and signup dates.
 */

const FROM_SQL = `FROM admin_waitlist_entries w
  LEFT JOIN users u ON w.role='customer' AND u.id=w.source_id
  LEFT JOIN seller_accounts sa ON w.role='seller' AND sa.id=w.source_id
  LEFT JOIN courier_accounts ca ON w.role='courier' AND ca.id=w.source_id`;
const EXISTS_SQL = "(u.id IS NOT NULL OR sa.id IS NOT NULL OR ca.id IS NOT NULL)";
const NAME_SQL = `CASE w.role
  WHEN 'customer' THEN u.first_name
  WHEN 'seller' THEN sa.owner_name
  WHEN 'courier' THEN ca.full_name
  ELSE '' END`;
const PHONE_SQL = `CASE w.role
  WHEN 'customer' THEN u.phone
  WHEN 'seller' THEN sa.phone
  WHEN 'courier' THEN ca.phone
  ELSE '' END`;
const SELECT_SQL = `SELECT CAST(w.id AS CHAR) AS id,w.role,
  ${NAME_SQL} AS firstName,
  CASE WHEN w.role='customer' THEN u.last_name ELSE '' END AS lastName,
  ${PHONE_SQL} AS phone,w.status,w.created_at AS createdAt,w.updated_at AS updatedAt`;

function normalizeQueryDigits(value) {
  return String(value ?? "")
    .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)));
}

function queryOptions(req, res, { pagination = true } = {}) {
  const q = normalizeQueryDigits(req.query.q).trim().slice(0, 100);
  const role = String(req.query.role ?? "all");
  const status = String(req.query.status ?? "all");
  const sort = String(req.query.sort ?? "newest");

  if (role !== "all" && !WAITLIST_ROLES.includes(role)) {
    fail(res, 400, "invalid_role", "نقش انتخاب‌شده معتبر نیست.");
    return null;
  }
  if (status !== "all" && !WAITLIST_STATUSES.includes(status)) {
    fail(res, 400, "invalid_status", "وضعیت انتخاب‌شده معتبر نیست.");
    return null;
  }
  if (!["newest", "oldest"].includes(sort)) {
    fail(res, 400, "invalid_sort", "مرتب‌سازی انتخاب‌شده معتبر نیست.");
    return null;
  }

  const page = pagination
    ? Math.max(1, Math.min(1_000_000, Number.parseInt(String(req.query.page), 10) || 1))
    : 1;
  const size = pagination
    ? Math.max(1, Math.min(100, Number.parseInt(String(req.query.size), 10) || 30))
    : 1000;
  const where = [EXISTS_SQL];
  const values = [];
  if (q) {
    where.push(
      `(CAST(w.id AS CHAR) LIKE ? OR ${NAME_SQL} LIKE ? OR COALESCE(u.last_name,'') LIKE ? OR CONCAT_WS(' ',${NAME_SQL},COALESCE(u.last_name,'')) LIKE ? OR ${PHONE_SQL} LIKE ?)`,
    );
    values.push(...Array(5).fill(`%${q}%`));
  }
  if (role !== "all") {
    where.push("w.role=?");
    values.push(role);
  }
  if (status !== "all") {
    where.push("w.status=?");
    values.push(status);
  }
  return {
    q,
    role,
    status,
    sort,
    page,
    size,
    whereSql: where.join(" AND "),
    values,
  };
}

const orderSql = (sort) =>
  sort === "oldest"
    ? "ORDER BY w.created_at ASC,w.id ASC"
    : "ORDER BY w.created_at DESC,w.id DESC";

function shapeEntry(row) {
  if (!row) return null;
  return {
    id: String(row.id),
    role: row.role,
    firstName: row.firstName ?? "",
    lastName: row.lastName ?? "",
    phone: row.phone ?? "",
    status: row.status,
    createdAt: row.createdAt ?? null,
    // Source account tables do not track profile edits. This timestamp only
    // exists after an admin changes the waitlist review status.
    updatedAt: row.updatedAt ?? null,
  };
}

async function findEntry(id) {
  return db.get(
    `${SELECT_SQL} ${FROM_SQL} WHERE w.id=? AND ${EXISTS_SQL} LIMIT 1`,
    [id],
  );
}

router.get("/waitlist", async (req, res) => {
  const options = queryOptions(req, res);
  if (!options) return;
  const totalRow = await db.get(
    `SELECT COUNT(*) AS total ${FROM_SQL} WHERE ${options.whereSql}`,
    options.values,
  );
  const offset = (options.page - 1) * options.size;
  const rows = await db.all(
    `${SELECT_SQL} ${FROM_SQL} WHERE ${options.whereSql} ${orderSql(options.sort)} LIMIT ${options.size} OFFSET ${offset}`,
    options.values,
  );
  res.json({
    rows: rows.map(shapeEntry),
    total: Number(totalRow?.total ?? 0),
    page: options.page,
    size: options.size,
  });
});

router.get("/waitlist/stats", async (_req, res) => {
  const todayUtc = new Date().toISOString().slice(0, 10);
  const row = await db.get(
    `SELECT COUNT(*) AS total,
      COALESCE(SUM(w.role='customer'),0) AS customers,
      COALESCE(SUM(w.role='seller'),0) AS sellers,
      COALESCE(SUM(w.role='courier'),0) AS couriers,
      COALESCE(SUM(LEFT(w.created_at,10)=?),0) AS newToday,
      COALESCE(SUM(w.status='approved'),0) AS approved,
      COALESCE(SUM(w.status='registered'),0) AS pendingReview,
      COALESCE(SUM(w.status='contacted'),0) AS contacted,
      COALESCE(SUM(w.status='rejected'),0) AS rejected
     ${FROM_SQL} WHERE ${EXISTS_SQL}`,
    [todayUtc],
  );
  const stats = Object.fromEntries(
    [
      "total",
      "customers",
      "sellers",
      "couriers",
      "newToday",
      "approved",
      "pendingReview",
      "contacted",
      "rejected",
    ].map((key) => [key, Number(row?.[key] ?? 0)]),
  );
  res.json({ stats, dateBasis: "UTC" });
});

router.get("/waitlist/export", async (req, res) => {
  const options = queryOptions(req, res, { pagination: false });
  if (!options) return;

  res.status(200);
  res.set({
    "Cache-Control": "no-store",
    "Content-Type": "text/csv; charset=utf-8",
    "Content-Disposition": "attachment; filename=waitlist.csv; filename*=UTF-8''nazarabadshop-waitlist.csv",
  });
  res.write("\uFEFFشناسه,نام,نام خانوادگی,شماره موبایل,نقش,وضعیت,تاریخ ثبت‌نام,آخرین ویرایش\r\n");

  const chunkSize = 1000;
  let offset = 0;
  while (!res.destroyed) {
    const rows = await db.all(
      `${SELECT_SQL} ${FROM_SQL} WHERE ${options.whereSql} ${orderSql(options.sort)} LIMIT ${chunkSize} OFFSET ${offset}`,
      options.values,
    );
    if (!rows.length) break;
    for (const raw of rows) {
      const entry = shapeEntry(raw);
      const values = [
        entry.id,
        entry.firstName,
        entry.lastName,
        entry.phone,
        entry.role,
        entry.status,
        entry.createdAt,
        entry.updatedAt,
      ].map(csvCell);
      if (!res.write(values.join(",") + "\r\n")) {
        await Promise.race([once(res, "drain"), once(res, "close")]);
        if (res.destroyed) return;
      }
    }
    if (rows.length < chunkSize) break;
    offset += rows.length;
  }
  if (!res.destroyed) res.end();
});

router.get("/waitlist/:id", async (req, res) => {
  const id = String(req.params.id ?? "");
  if (!/^\d{1,20}$/.test(id))
    return fail(res, 400, "invalid_id", "شناسهٔ ثبت‌نام معتبر نیست.");
  const row = await findEntry(id);
  if (!row) return fail(res, 404, "not_found", "ثبت‌نام موردنظر پیدا نشد.");
  res.json({ entry: shapeEntry(row) });
});

router.patch("/waitlist/:id", async (req, res) => {
  const id = String(req.params.id ?? "");
  const status = String(req.body?.status ?? "");
  if (!/^\d{1,20}$/.test(id))
    return fail(res, 400, "invalid_id", "شناسهٔ ثبت‌نام معتبر نیست.");
  if (!WAITLIST_STATUSES.includes(status))
    return fail(res, 400, "invalid_status", "وضعیت ثبت‌نام معتبر نیست.");

  const current = await findEntry(id);
  if (!current) return fail(res, 404, "not_found", "ثبت‌نام موردنظر پیدا نشد.");
  await db.run(
    "UPDATE admin_waitlist_entries SET status=?,updated_at=? WHERE id=?",
    [status, new Date().toISOString(), id],
  );
  const updated = await findEntry(id);
  res.json({ ok: true, entry: shapeEntry(updated) });
});

function csvCell(value) {
  let text = String(value ?? "");
  // Prevent spreadsheet formula execution for untrusted registration names.
  if (/^[\u0000-\u0020]*[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

export default router;

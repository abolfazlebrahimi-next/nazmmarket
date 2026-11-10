import { Router } from "express";
import { db } from "../db.js";
import { hashPassword, verifyPassword, loginThrottle } from "../auth.js";
import { notifyCourier } from "../courier-notifications.js";
import { validPoint } from "../delivery.js";
const router = Router();
const fail = (res, status, message) =>
  res.status(status).json({ error: { message } });
export async function courierWallet(courierId, tx = db) {
  const credits = Number(
    (
      await tx.get(
        "SELECT COALESCE(SUM(amount),0) n FROM courier_ledger WHERE courier_id=?",
        [courierId],
      )
    ).n,
  );
  const reserved = Number(
    (
      await tx.get(
        "SELECT COALESCE(SUM(amount),0) n FROM courier_withdrawals WHERE courier_id=? AND status IN ('pending','paid')",
        [courierId],
      )
    ).n,
  );
  return { earned: credits, available: Math.max(0, credits - reserved) };
}
router.post("/auth/password", loginThrottle, async (req, res) => {
  const current = String(req.body.currentPassword || ""),
    next = String(req.body.newPassword || "");
  if (next.length < 10 || next.length > 128)
    return fail(res, 400, "رمز جدید باید بین ۱۰ تا ۱۲۸ نویسه باشد.");
  const ok = await db.transaction(async (tx) => {
    const c = await tx.get(
      "SELECT password_hash FROM courier_accounts WHERE id=? FOR UPDATE",
      [req.courier.id],
    );
    if (!verifyPassword(current, c.password_hash)) return false;
    await tx.run("UPDATE courier_accounts SET password_hash=? WHERE id=?", [
      hashPassword(next),
      req.courier.id,
    ]);
    await tx.run(
      "DELETE FROM courier_sessions WHERE courier_id=? AND token<>?",
      [req.courier.id, req.courierToken],
    );
    await notifyCourier(tx, req.courier.id, {
      key: "password:" + Date.now(),
      kind: "security",
      title: "رمز عبور تغییر کرد",
      body: "نشست‌های دیگر شما بسته شدند. اگر این تغییر کار شما نبوده با پشتیبانی تماس بگیرید.",
      target: "settings",
    });
    return true;
  });
  if (!ok) return fail(res, 401, "رمز فعلی صحیح نیست.");
  res.json({ ok: true });
});
router.get("/notifications", async (req, res) =>
  res.json({
    notifications: await db.all(
      "SELECT id,kind,title,body,target,is_read,created_at FROM courier_notifications WHERE courier_id=? ORDER BY id DESC LIMIT 100",
      [req.courier.id],
    ),
    unread: Number(
      (
        await db.get(
          "SELECT COUNT(*) n FROM courier_notifications WHERE courier_id=? AND is_read=0",
          [req.courier.id],
        )
      ).n,
    ),
  }),
);
router.patch("/notifications/:id/read", async (req, res) => {
  const all = req.params.id === "all";
  await db.run(
    "UPDATE courier_notifications SET is_read=1 WHERE courier_id=?" +
      (all ? "" : " AND id=?"),
    all ? [req.courier.id] : [req.courier.id, req.params.id],
  );
  res.json({ ok: true });
});
router.get("/history", async (req, res) => {
  const page = Math.max(
      1,
      Math.min(1000000, parseInt(req.query.page, 10) || 1),
    ),
    size = 20,
    q = String(req.query.q || "").slice(0, 40),
    status = String(req.query.status || "all");
  const where = [
      "d.courier_id=?",
      "(d.completed_at IS NOT NULL OR d.trip_status IN ('cancelled','failed'))",
    ],
    values = [req.courier.id];
  if (q) {
    where.push("o.id LIKE ?");
    values.push("%" + q + "%");
  }
  if (["completed", "cancelled", "failed"].includes(status)) {
    where.push("d.trip_status=?");
    values.push(status);
  }
  for (const [field, operator] of [
    ["from", ">="],
    ["to", "<="],
  ])
    if (/^\d{4}-\d{2}-\d{2}$/.test(String(req.query[field] || ""))) {
      where.push(`LEFT(d.claimed_at,10) ${operator} ?`);
      values.push(req.query[field]);
    }
  const clause = where.join(" AND "),
    total = Number(
      (
        await db.get(
          "SELECT COUNT(*) n FROM order_deliveries d JOIN orders o ON o.id=d.order_id WHERE " +
            clause,
          values,
        )
      ).n,
    );
  const rows = await db.all(
    `SELECT o.id,o.store_name,o.address_text,o.courier_fee,o.courier_commission_rate,d.claimed_at,d.completed_at,d.trip_status,l.amount,l.gross_amount,l.commission_amount FROM order_deliveries d JOIN orders o ON o.id=d.order_id LEFT JOIN courier_ledger l ON l.order_id COLLATE utf8mb4_unicode_ci=o.id COLLATE utf8mb4_unicode_ci WHERE ${clause} ORDER BY d.claimed_at DESC LIMIT ${size} OFFSET ${(page - 1) * size}`,
    values,
  );
  res.json({ rows, total, page, size });
});
router.get("/summary", async (req, res) => {
  const id = req.courier.id;
  const today = new Date().toISOString().slice(0, 10);
  const weekStart = new Date(Date.now() - 6 * 86400000)
    .toISOString()
    .slice(0, 10);
  const totals = await db.get(
    "SELECT COUNT(*) total,COALESCE(SUM(CASE WHEN LEFT(completed_at,10)=? THEN 1 ELSE 0 END),0) today FROM order_deliveries WHERE courier_id=? AND completed_at IS NOT NULL",
    [today, id],
  );
  const days = await db.all(
    "SELECT LEFT(created_at,10) day,COUNT(*) trips,COALESCE(SUM(amount),0) earnings FROM courier_ledger WHERE courier_id=? AND created_at>=? GROUP BY LEFT(created_at,10) ORDER BY day",
    [id, weekStart],
  );
  res.json({
    totalTrips: Number(totals.total),
    tripsToday: Number(totals.today),
    earningsToday: Number(days.find((d) => d.day === today)?.earnings || 0),
    week: days.map((d) => ({
      day: d.day,
      trips: Number(d.trips),
      earnings: Number(d.earnings),
    })),
    timezone: "UTC",
  });
});
router.patch("/location", async (req, res) => {
  if (!req.courier.active || req.courier.verificationStatus !== "approved")
    return fail(res, 403, "برای ثبت موقعیت عملیاتی، حساب باید تأیید شده باشد.");
  if (!validPoint(req.body.lat, req.body.lng))
    return fail(res, 400, "مختصات معتبر نیست.");
  await db.run(
    "UPDATE courier_accounts SET lat=?,lng=?,location_updated_at=? WHERE id=?",
    [
      Number(req.body.lat),
      Number(req.body.lng),
      new Date().toISOString(),
      req.courier.id,
    ],
  );
  res.json({ ok: true });
});
router.patch("/availability", async (req, res) => {
  if (typeof req.body.online !== "boolean")
    return fail(res, 400, "وضعیت فعالیت معتبر نیست.");
  if (
    req.body.online &&
    (!req.courier.active || req.courier.verificationStatus !== "approved")
  )
    return fail(res, 403, "برای شروع فعالیت، احراز هویت باید تأیید شود.");
  if (req.body.online && !validPoint(req.body.lat, req.body.lng))
    return fail(
      res,
      400,
      "برای پیدا کردن سفارش نزدیک، موقعیت مکانی را فعال کنید.",
    );
  await db.run(
    "UPDATE courier_accounts SET online=?,lat=COALESCE(?,lat),lng=COALESCE(?,lng),location_updated_at=? WHERE id=?",
    [
      req.body.online ? 1 : 0,
      req.body.online ? Number(req.body.lat) : null,
      req.body.online ? Number(req.body.lng) : null,
      new Date().toISOString(),
      req.courier.id,
    ],
  );
  res.json({ online: req.body.online });
});
router.get("/wallet", async (req, res) =>
  res.json({
    ...(await courierWallet(req.courier.id)),
    periods: await db.get(
      "SELECT COALESCE(SUM(CASE WHEN LEFT(created_at,10)=? THEN amount ELSE 0 END),0) today,COALESCE(SUM(CASE WHEN created_at>=? THEN amount ELSE 0 END),0) week,COALESCE(SUM(CASE WHEN LEFT(created_at,7)=? THEN amount ELSE 0 END),0) month,COALESCE(SUM(commission_amount),0) commission FROM courier_ledger WHERE courier_id=?",
      [
        new Date().toISOString().slice(0, 10),
        new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10),
        new Date().toISOString().slice(0, 7),
        req.courier.id,
      ],
    ),
    ledger: await db.all(
      "SELECT order_id,amount,gross_amount,commission_amount,created_at FROM courier_ledger WHERE courier_id=? ORDER BY id DESC LIMIT 100",
      [req.courier.id],
    ),
    withdrawals: await db.all(
      "SELECT id,amount,status,reference,reason,created_at FROM courier_withdrawals WHERE courier_id=? ORDER BY id DESC LIMIT 100",
      [req.courier.id],
    ),
  }),
);
router.post("/withdrawals", async (req, res) => {
  const amount = Number(req.body.amount),
    iban = String(req.body.iban || "")
      .replace(/\s/g, "")
      .toUpperCase();
  if (
    !Number.isSafeInteger(amount) ||
    amount < 50000 ||
    !/^IR\d{24}$/.test(iban)
  )
    return fail(
      res,
      400,
      "حداقل برداشت ۵۰ هزار تومان و شبای معتبر الزامی است.",
    );
  const ok = await db.transaction(async (tx) => {
    const c = await tx.get(
      "SELECT active,verification_status FROM courier_accounts WHERE id=? FOR UPDATE",
      [req.courier.id],
    );
    if (!c?.active || c.verification_status !== "approved") return false;
    const w = await courierWallet(req.courier.id, tx);
    if (amount > w.available) return false;
    await tx.run(
      "INSERT INTO courier_withdrawals (courier_id,amount,iban,status,created_at) VALUES (?,?,?,'pending',?)",
      [req.courier.id, amount, iban, new Date().toISOString()],
    );
    return true;
  });
  if (!ok)
    return fail(
      res,
      409,
      "موجودی قابل برداشت کافی نیست یا حساب تأیید نشده است.",
    );
  res.status(201).json({ ok: true });
});
router.get("/tickets", async (req, res) =>
  res.json({
    tickets: await db.all(
      "SELECT * FROM courier_tickets WHERE courier_id=? ORDER BY id DESC",
      [req.courier.id],
    ),
  }),
);
router.post("/tickets", async (req, res) => {
  const subject = String(req.body.subject || "")
      .trim()
      .slice(0, 180),
    body = String(req.body.body || "")
      .trim()
      .slice(0, 5000);
  if (!subject || !body)
    return fail(res, 400, "موضوع و متن تیکت را تکمیل کنید.");
  const id = await db.transaction(async (tx) => {
    const r = await tx.run(
      "INSERT INTO courier_tickets (courier_id,subject,category,status,created_at) VALUES (?,?,?,'open',?)",
      [
        req.courier.id,
        subject,
        [
          "order",
          "store",
          "customer",
          "finance",
          "kyc",
          "technical",
          "incident",
          "other",
        ].includes(req.body.category)
          ? req.body.category
          : "other",
        new Date().toISOString(),
      ],
    );
    await tx.run(
      "INSERT INTO courier_ticket_messages (ticket_id,role,body,created_at) VALUES (?,'courier',?,?)",
      [r.insertId, body, new Date().toISOString()],
    );
    return r.insertId;
  });
  res.status(201).json({ id });
});
router.get("/tickets/:id", async (req, res) => {
  const t = await db.get(
    "SELECT * FROM courier_tickets WHERE id=? AND courier_id=?",
    [req.params.id, req.courier.id],
  );
  if (!t) return fail(res, 404, "تیکت پیدا نشد.");
  res.json({
    ticket: t,
    messages: await db.all(
      "SELECT * FROM courier_ticket_messages WHERE ticket_id=? ORDER BY id",
      [t.id],
    ),
  });
});
router.post("/tickets/:id/messages", async (req, res) => {
  const body = String(req.body.body || "")
    .trim()
    .slice(0, 5000);
  if (!body) return fail(res, 400, "متن پیام لازم است.");
  const ok = await db.transaction(async (tx) => {
    const t = await tx.get(
      "SELECT * FROM courier_tickets WHERE id=? AND courier_id=? FOR UPDATE",
      [req.params.id, req.courier.id],
    );
    if (!t || t.status === "closed") return false;
    await tx.run(
      "INSERT INTO courier_ticket_messages (ticket_id,role,body,created_at) VALUES (?,'courier',?,?)",
      [t.id, body, new Date().toISOString()],
    );
    await tx.run("UPDATE courier_tickets SET status='open' WHERE id=?", [t.id]);
    return true;
  });
  if (!ok) return fail(res, 409, "تیکت بسته شده یا متعلق به شما نیست.");
  res.status(201).json({ ok: true });
});
export default router;

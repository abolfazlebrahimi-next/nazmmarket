import { Router } from "express";
import { db } from "../db.js";
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
    ledger: await db.all(
      "SELECT order_id,amount,created_at FROM courier_ledger WHERE courier_id=? ORDER BY id DESC LIMIT 100",
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
      "INSERT INTO courier_tickets (courier_id,subject,status,created_at) VALUES (?,?,'open',?)",
      [req.courier.id, subject, new Date().toISOString()],
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

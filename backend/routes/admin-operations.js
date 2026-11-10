import { Router } from "express";
import { db } from "../db.js";
import { platformSettings } from "../delivery.js";
const router = Router();
const fail = (res, status, message) =>
  res.status(status).json({ error: { message } });
router.get("/operations", async (_req, res) =>
  res.json({
    settings: await platformSettings(db),
    withdrawals: await db.all(
      "SELECT w.*,c.full_name,c.phone FROM courier_withdrawals w JOIN courier_accounts c ON c.id=w.courier_id ORDER BY w.id DESC LIMIT 200",
    ),
    tickets: await db.all(
      "SELECT t.*,c.full_name FROM courier_tickets t JOIN courier_accounts c ON c.id=t.courier_id ORDER BY t.id DESC LIMIT 200",
    ),
    expenses: await db.all(
      "SELECT * FROM platform_expenses ORDER BY id DESC LIMIT 100",
    ),
  }),
);
router.put("/settings", async (req, res) => {
  const commission = Number(req.body.commissionPercent),
    weather = req.body.weather;
  if (
    !["normal", "rain", "snow"].includes(weather) ||
    !Number.isFinite(commission) ||
    commission < 0 ||
    commission > 30
  )
    return fail(res, 400, "وضعیت هوا یا درصد کارمزد معتبر نیست.");
  await db.run(
    "INSERT INTO platform_settings (id,value_json) VALUES (1,?) ON DUPLICATE KEY UPDATE value_json=VALUES(value_json)",
    [JSON.stringify({ weather, commissionPercent: commission })],
  );
  res.json({ ok: true });
});
router.post("/expenses", async (req, res) => {
  const description = String(req.body.description || "")
      .trim()
      .slice(0, 255),
    amount = Number(req.body.amount);
  if (!description || !Number.isSafeInteger(amount) || amount <= 0)
    return fail(res, 400, "عنوان و هزینه معتبر لازم است.");
  await db.run(
    "INSERT INTO platform_expenses (description,amount,created_at) VALUES (?,?,?)",
    [description, amount, new Date().toISOString()],
  );
  res.status(201).json({ ok: true });
});
router.patch("/withdrawals/:id", async (req, res) => {
  const state = req.body.status,
    reference = String(req.body.reference || "")
      .trim()
      .slice(0, 120),
    reason = String(req.body.reason || "")
      .trim()
      .slice(0, 500);
  if (
    !["paid", "rejected"].includes(state) ||
    (state === "paid" && !reference) ||
    (state === "rejected" && !reason)
  )
    return fail(
      res,
      400,
      "برای پرداخت شناسه پرداخت و برای رد، دلیل الزامی است.",
    );
  const r = await db.run(
    "UPDATE courier_withdrawals SET status=?,reference=?,reason=? WHERE id=? AND status='pending'",
    [state, reference, reason, req.params.id],
  );
  if (!r.affectedRows) return fail(res, 409, "درخواست قبلاً بررسی شده است.");
  res.json({ ok: true });
});
router.get("/tickets/:id", async (req, res) =>
  res.json({
    messages: await db.all(
      "SELECT * FROM courier_ticket_messages WHERE ticket_id=? ORDER BY id",
      [req.params.id],
    ),
  }),
);
router.post("/tickets/:id/messages", async (req, res) => {
  const body = String(req.body.body || "")
    .trim()
    .slice(0, 5000);
  if (!body) return fail(res, 400, "متن پاسخ لازم است.");
  const ok = await db.transaction(async (tx) => {
    const t = await tx.get(
      "SELECT id FROM courier_tickets WHERE id=? FOR UPDATE",
      [req.params.id],
    );
    if (!t) return false;
    await tx.run(
      "INSERT INTO courier_ticket_messages (ticket_id,role,body,created_at) VALUES (?,'admin',?,?)",
      [t.id, body, new Date().toISOString()],
    );
    await tx.run("UPDATE courier_tickets SET status=? WHERE id=?", [
      req.body.close ? "closed" : "answered",
      t.id,
    ]);
    return true;
  });
  if (!ok) return fail(res, 404, "تیکت پیدا نشد.");
  res.status(201).json({ ok: true });
});
export default router;

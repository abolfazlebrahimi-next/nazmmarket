import { notifyCourier } from "../courier-notifications.js";
import { Router } from "express";
import { db, mapPromo } from "../db.js";
import { platformSettings } from "../delivery.js";
import { promoDateBound } from "../promos.js";
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
    weather = req.body.weather,
    courierCommission = Number(req.body.courierCommissionPercent ?? 0);
  if (
    !["normal", "rain", "snow"].includes(weather) ||
    !Number.isFinite(commission) ||
    commission < 0 ||
    commission > 30 ||
    !Number.isFinite(courierCommission) ||
    courierCommission < 0 ||
    courierCommission > 30
  )
    return fail(res, 400, "وضعیت هوا یا درصد کارمزد معتبر نیست.");
  await db.run(
    "INSERT INTO platform_settings (id,value_json) VALUES (1,?) ON DUPLICATE KEY UPDATE value_json=VALUES(value_json)",
    [
      JSON.stringify({
        weather,
        commissionPercent: commission,
        courierCommissionPercent: courierCommission,
      }),
    ],
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
  const withdrawal = await db.get(
    "SELECT courier_id FROM courier_withdrawals WHERE id=?",
    [req.params.id],
  );
  await notifyCourier(db, withdrawal.courier_id, {
    key: "withdrawal:" + req.params.id + ":" + state,
    kind: "finance",
    title: "وضعیت تسویه تغییر کرد",
    body: state === "paid" ? "پرداخت تسویه توسط مدیریت ثبت شد." : reason,
    target: "wallet",
  });
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
/* ---------------- platform discount codes ---------------- */
const promoText = (value, max) =>
  String(value ?? "")
    .trim()
    .slice(0, max);

/** Shared validation for creating and editing a platform code. */
function promoInput(body, existingId = null) {
  const code = promoText(body.code, 40).toUpperCase().replace(/[^A-Z0-9_-]/g, "");
  const title = promoText(body.title, 180);
  const description = promoText(body.description, 255);
  const kind = body.kind === "percent" ? "percent" : "fixed";
  const amount = Math.floor(Number(body.amount));
  const minSubtotal = Math.floor(Number(body.minSubtotal ?? 0));
  const maxDiscount = Math.floor(Number(body.maxDiscount ?? 0));
  const audience = body.audience === "users" ? "users" : "all";
  const maxUses =
    body.maxUses === undefined || body.maxUses === null || body.maxUses === ""
      ? audience === "users"
        ? 1
        : 0
      : Math.floor(Number(body.maxUses));
  // A picked day means "from its first minute" to "its last minute", not the
  // instant a Date constructor would read out of a bare `YYYY-MM-DD`.
  const startsAt = promoDateBound(body.startsAt, "start");
  const expiresAt = promoDateBound(body.expiresAt, "end");
  const userIds = Array.isArray(body.userIds)
    ? [...new Set(body.userIds.map(Number))].filter(
        (id) => Number.isSafeInteger(id) && id > 0,
      )
    : [];
  const error = (message) => ({ invalid: message });
  if (!/^[A-Z0-9_-]{3,40}$/.test(code))
    return error("کد باید ۳ تا ۴۰ نویسه باشد و فقط حرف بزرگ، رقم، خط تیره و زیرخط بپذیرد.");
  if (!title) return error("عنوان کد تخفیف لازم است.");
  if (!Number.isSafeInteger(amount) || amount < 1)
    return error("مبلغ یا درصد تخفیف معتبر نیست.");
  if (kind === "percent" && amount > 100)
    return error("درصد تخفیف نمی‌تواند بیشتر از ۱۰۰ باشد.");
  if (!Number.isSafeInteger(minSubtotal) || minSubtotal < 0)
    return error("حداقل مبلغ سبد معتبر نیست.");
  if (!Number.isSafeInteger(maxDiscount) || maxDiscount < 0)
    return error("سقف تخفیف معتبر نیست.");
  if (!Number.isSafeInteger(maxUses) || maxUses < 0 || maxUses > 1000000)
    return error("تعداد مجاز مصرف معتبر نیست.");
  if (startsAt === undefined || expiresAt === undefined)
    return error("تاریخ شروع یا پایان معتبر نیست.");
  if (startsAt && expiresAt && startsAt > expiresAt)
    return error("تاریخ پایان نمی‌تواند پیش از تاریخ شروع باشد.");
  if (audience === "users" && !userIds.length)
    return error("برای کد اختصاصی دست‌کم یک مشتری را انتخاب کنید.");
  if (userIds.length > 5000)
    return error("حداکثر ۵۰۰ مشتری برای یک کد قابل انتخاب است.");
  if (audience === "all" && userIds.length) userIds.length = 0;
  return {
    value: {
      id: existingId,
      code,
      title,
      description,
      kind,
      amount,
      minSubtotal,
      maxDiscount,
      audience,
      maxUses,
      startsAt,
      expiresAt,
      userIds,
    },
  };
}
router.get("/promos", async (_req, res) => {
  const rows = await db.all(
    `SELECT p.*, (SELECT COUNT(*) FROM platform_promo_users t WHERE t.promo_id=p.id) AS target_count
     FROM platform_promos p ORDER BY p.id DESC LIMIT 500`,
  );
  const usage = await db.all(
    `SELECT promo_id, COUNT(*) AS uses, COALESCE(SUM(discount),0) AS spent
     FROM promo_redemptions WHERE scope='platform' GROUP BY promo_id`,
  );
  const byPromo = new Map(
    usage.map((u) => [Number(u.promo_id), { uses: Number(u.uses), spent: Number(u.spent) }]),
  );
  const names = await db.all(
    `SELECT t.promo_id,u.id,u.first_name,u.last_name,u.phone FROM platform_promo_users t
     JOIN users u ON u.id=t.user_id WHERE t.promo_id IN (SELECT id FROM platform_promos ORDER BY id DESC LIMIT 500)
     ORDER BY t.promo_id, u.id LIMIT 5000`,
  );
  const targets = new Map();
  for (const row of names) {
    const id = Number(row.promo_id);
    if (!targets.has(id)) targets.set(id, []);
    targets.get(id).push({
      id: Number(row.id),
      name: `${row.first_name ?? ""} ${row.last_name ?? ""}`.trim() || "بدون نام",
      phone: row.phone,
    });
  }
  res.json({
    promos: rows.map((row) => ({
      ...mapPromo(row),
      startsAt: row.starts_at ?? null,
      audience: row.audience,
      used: byPromo.get(Number(row.id))?.uses ?? Number(row.usage_count ?? 0),
      spent: byPromo.get(Number(row.id))?.spent ?? 0,
      targets: row.audience === "users" ? targets.get(Number(row.id)) ?? [] : [],
      targetCount: Number(row.target_count ?? 0),
    })),
  });
});
router.get("/promo-customers", async (req, res) => {
  const q = promoText(req.query.q, 60);
  const clause = q
    ? "WHERE (u.phone LIKE ? OR u.first_name LIKE ? OR u.last_name LIKE ? OR CONCAT_WS(' ', u.first_name, u.last_name) LIKE ?)"
    : "";
  const values = q ? Array(4).fill("%" + q + "%") : [];
  res.json({
    customers: await db.all(
      `SELECT u.id, u.phone, u.first_name, u.last_name, COALESCE(stat.orders,0) AS orders
       FROM users u
       LEFT JOIN (SELECT user_id, COUNT(*) AS orders FROM orders GROUP BY user_id) stat
         ON stat.user_id = u.id
       ${clause} ORDER BY orders DESC, u.id DESC LIMIT 60`,
      values,
    ),
  });
});
router.post("/promos", async (req, res) => {
  const parsed = promoInput(req.body ?? {});
  if (parsed.invalid) return fail(res, 400, parsed.invalid);
  const p = parsed.value;
  try {
    const created = await db.transaction(async (tx) => {
      const result = await tx.run(
        `INSERT INTO platform_promos (code,title,description,kind,amount,min_subtotal,max_discount,
          audience,active,max_uses,usage_count,starts_at,expires_at,created_at)
         VALUES (?,?,?,?,?,?,?,?,1,?,0,?,?,?)`,
        [
          p.code,
          p.title,
          p.description,
          p.kind,
          p.amount,
          p.minSubtotal,
          p.maxDiscount,
          p.audience,
          p.maxUses,
          p.startsAt,
          p.expiresAt,
          new Date().toISOString(),
        ],
      );
      const promoId = Number(result.insertId);
      for (const userId of p.userIds)
        await tx.run(
          "INSERT IGNORE INTO platform_promo_users (promo_id,user_id,created_at) VALUES (?,?,?)",
          [promoId, userId, new Date().toISOString()],
        );
      return promoId;
    });
    res.status(201).json({ id: created });
  } catch (error) {
    if (error?.code === "ER_DUP_ENTRY")
      return fail(res, 409, "این کد قبلاً در سامانه ثبت شده است.");
    throw error;
  }
});
router.patch("/promos/:id", async (req, res) => {
  const id = Number(req.params.id);
  const current = await db.get("SELECT * FROM platform_promos WHERE id=?", [id]);
  if (!current) return fail(res, 404, "کد تخفیف پیدا نشد.");
  if (req.body?.active !== undefined) {
    await db.run("UPDATE platform_promos SET active=? WHERE id=?", [
      req.body.active ? 1 : 0,
      id,
    ]);
    return res.json({ ok: true });
  }
  const parsed = promoInput({ ...current, ...req.body, code: req.body?.code ?? current.code }, id);
  if (parsed.invalid) return fail(res, 400, parsed.invalid);
  const p = parsed.value;
  await db.transaction(async (tx) => {
    await tx.run(
      `UPDATE platform_promos SET code=?,title=?,description=?,kind=?,amount=?,min_subtotal=?,max_discount=?,
        audience=?,max_uses=?,starts_at=?,expires_at=? WHERE id=?`,
      [
        p.code,
        p.title,
        p.description,
        p.kind,
        p.amount,
        p.minSubtotal,
        p.maxDiscount,
        p.audience,
        p.maxUses,
        p.startsAt,
        p.expiresAt,
        id,
      ],
    );
    await tx.run("DELETE FROM platform_promo_users WHERE promo_id=?", [id]);
    for (const userId of p.userIds)
      await tx.run(
        "INSERT IGNORE INTO platform_promo_users (promo_id,user_id,created_at) VALUES (?,?,?)",
        [id, userId, new Date().toISOString()],
      );
    // The counter always mirrors the redemption table after an edit.
    await tx.run(
      `UPDATE platform_promos SET usage_count=(SELECT COUNT(*) FROM promo_redemptions r
        WHERE r.scope='platform' AND r.promo_id=?) WHERE id=?`,
      [id, id],
    );
  });
  res.json({ ok: true });
});
router.delete("/promos/:id", async (req, res) => {
  const id = Number(req.params.id);
  const used = await db.get(
    "SELECT COUNT(*) n FROM promo_redemptions WHERE scope='platform' AND promo_id=?",
    [id],
  );
  if (Number(used?.n ?? 0) > 0)
    return fail(
      res,
      409,
      "این کد استفاده شده و برای حفظ سوابق سفارش‌ها قابل حذف نیست؛ آن را غیرفعال کنید.",
    );
  await db.run("DELETE FROM platform_promos WHERE id=?", [id]);
  res.json({ ok: true });
});
/**
 * The audit trail behind «مصرف: ۳ از ۱۰»: which accounts burned this code, on
 * which order and for how much. Read-only and capped — a code is created to be
 * spent, so the admin needs to see the rows, not edit them.
 */
router.get("/promos/:id/redemptions", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id < 1)
    return fail(res, 400, "شناسه کد تخفیف معتبر نیست.");
  const rows = await db.all(
    `SELECT r.order_id, r.discount, r.created_at, u.id AS user_id,
            u.first_name, u.last_name, u.phone
     FROM promo_redemptions r JOIN users u ON u.id = r.user_id
     WHERE r.scope='platform' AND r.promo_id=?
     ORDER BY r.created_at DESC LIMIT 200`,
    [id],
  );
  const counted = await db.get(
    "SELECT COUNT(*) n FROM promo_redemptions WHERE scope='platform' AND promo_id=?",
    [id],
  );
  res.json({
    total: Number(counted?.n ?? 0),
    redemptions: rows.map((r) => ({
      orderId: String(r.order_id ?? ""),
      discount: Number(r.discount ?? 0),
      createdAt: r.created_at,
      customer: {
        id: Number(r.user_id),
        name: `${r.first_name ?? ""} ${r.last_name ?? ""}`.trim() || "بدون نام",
        phone: String(r.phone ?? ""),
      },
    })),
  });
});

router.post("/tickets/:id/messages", async (req, res) => {
  const body = String(req.body.body || "")
    .trim()
    .slice(0, 5000);
  if (!body) return fail(res, 400, "متن پاسخ لازم است.");
  const ok = await db.transaction(async (tx) => {
    const t = await tx.get(
      "SELECT id,courier_id FROM courier_tickets WHERE id=? FOR UPDATE",
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
    await notifyCourier(tx, t.courier_id, {
      key: "ticket:" + t.id + ":" + Date.now(),
      kind: "support",
      title: "پاسخ جدید پشتیبانی",
      body: "پشتیبانی به تیکت شما پاسخ داده است.",
      target: "tickets",
    });
    return true;
  });
  if (!ok) return fail(res, 404, "تیکت پیدا نشد.");
  res.status(201).json({ ok: true });
});
export default router;

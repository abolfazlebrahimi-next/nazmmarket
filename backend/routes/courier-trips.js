import { notifyCourier } from "../courier-notifications.js";
import { Router } from "express";
import { db, mapOrder } from "../db.js";
import { recordOrderEvent } from "../order-workflow.js";
import { createDeliveryCode, deliveryCodeMatches } from "../trip-security.js";
const router = Router();
const fail = (res, status, message) =>
  res.status(status).json({ error: { message } });
const event = (tx, id, courier, stage) =>
  tx.run(
    "INSERT IGNORE INTO courier_trip_events (order_id,courier_id,stage,created_at) VALUES (?,?,?,?)",
    [id, courier, stage, new Date().toISOString()],
  );
router.post("/orders/:id/claim", async (req, res) => {
  try {
    const ok = await db.transaction(async (tx) => {
      const c = await tx.get(
        "SELECT * FROM courier_accounts WHERE id=? FOR UPDATE",
        [req.courier.id],
      );
      const o = await tx.get(
        "SELECT o.id,o.status,o.delivery_mode,o.dispatch_paused,o.address_city,COALESCE(o.dispatch_started_at,o.created_at) AS dispatch_started_at,s.lat,s.lng FROM orders o JOIN stores s ON s.id=o.store_id WHERE o.id=? FOR UPDATE",
        [req.params.id],
      );
      if (!o) return false;
      const existing = await tx.get(
        "SELECT * FROM order_deliveries WHERE order_id=? FOR UPDATE",
        [req.params.id],
      );
      if (existing)
        return (
          Number(existing.courier_id) === req.courier.id &&
          !existing.completed_at &&
          Number(o.status) !== 5 &&
          !["completed", "cancelled", "failed"].includes(existing.trip_status)
        );
      // پذیرش سفارش نباید به کلید فعالیت وابسته باشد؛ با پذیرش، سفیر آنلاین می‌شود.
      if (!c?.active || c.verification_status !== "approved") return false;
      // پیک‌های پلتفرم فقط سفارش‌های نظرآباد را برمی‌دارند؛
      // نه فاصله (کیلومتر) مهم است نه تازگی موقعیت.
      if (o.address_city && o.address_city !== "نظرآباد") return false;
      if (
        Number(o.status) !== 3 ||
        o.delivery_mode !== "courier" ||
        Boolean(o.dispatch_paused) ||
        !Number.isFinite(Date.parse(o.dispatch_started_at)) ||
        Date.now() - Date.parse(o.dispatch_started_at) >= 15 * 60000
      )
        return false;
      if (
        await tx.get(
          "SELECT order_id FROM order_deliveries WHERE courier_id=? AND completed_at IS NULL AND trip_status NOT IN ('cancelled','failed') LIMIT 1 FOR UPDATE",
          [req.courier.id],
        )
      )
        return false;
      const offer = await tx.get(
        "SELECT * FROM courier_offers WHERE courier_id=? AND order_id=? AND state IN ('pending','declined') FOR UPDATE",
        [req.courier.id, req.params.id],
      );
      if (!offer) return false;
      await tx.run("UPDATE courier_accounts SET online=1 WHERE id=?", [
        req.courier.id,
      ]);
      await tx.run(
        "INSERT INTO order_deliveries (order_id,courier_id,claimed_at,trip_status) VALUES (?,?,?,'accepted')",
        [o.id, req.courier.id, new Date().toISOString()],
      );
      await tx.run(
        "UPDATE courier_offers SET state='accepted' WHERE courier_id=? AND order_id=?",
        [req.courier.id, o.id],
      );
      await event(tx, o.id, req.courier.id, "accepted");
      return true;
    });
    if (!ok)
      return fail(
        res,
        409,
        "این سفارش هم‌اکنون قابل پذیرش نیست (ممکن است سفیر دیگری آن را پذیرفته یا از بازهٔ جست‌وجو خارج شده باشد)؛ فهرست را تازه‌سازی کنید.",
      );
    res.json({ ok: true });
  } catch (e) {
    if (e.code === "ER_DUP_ENTRY" || e.code === "ER_LOCK_DEADLOCK")
      return fail(
        res,
        409,
        "سفارش توسط سفیر دیگری پذیرفته شد؛ فهرست را تازه‌سازی کنید.",
      );
    throw e;
  }
});
router.post("/orders/:id/arrive", async (req, res) => {
  const ok = await db.transaction(async (tx) => {
    const d = await tx.get(
      "SELECT * FROM order_deliveries WHERE order_id=? AND courier_id=? FOR UPDATE",
      [req.params.id, req.courier.id],
    );
    if (!d || d.completed_at) return false;
    if (["arrived", "in_transit"].includes(d.trip_status)) return true;
    if (d.trip_status !== "accepted") return false;
    await tx.run(
      "UPDATE order_deliveries SET trip_status='arrived',arrived_at=? WHERE order_id=?",
      [new Date().toISOString(), req.params.id],
    );
    await event(tx, req.params.id, req.courier.id, "arrived");
    return true;
  });
  if (!ok) return fail(res, 409, "سفر برای اعلام رسیدن آماده نیست.");
  res.json({ ok: true });
});
router.post("/orders/:id/pickup", async (req, res) => {
  const ok = await db.transaction(async (tx) => {
    const d = await tx.get(
      "SELECT * FROM order_deliveries WHERE order_id=? AND courier_id=? FOR UPDATE",
      [req.params.id, req.courier.id],
    );
    if (!d || d.completed_at) return false;
    if (d.trip_status === "in_transit") return true;
    if (d.trip_status !== "arrived") return false;
    const changed = await tx.run(
      "UPDATE orders SET status=4 WHERE id=? AND status=3",
      [req.params.id],
    );
    if (!changed.affectedRows) return false;
    const otp = createDeliveryCode();
    await tx.run(
      "UPDATE order_deliveries SET trip_status='in_transit',picked_up_at=?,delivery_otp=?,otp_attempts=0,otp_expires_at=? WHERE order_id=?",
      [
        new Date().toISOString(),
        otp.encrypted,
        new Date(Date.now() + 86400000).toISOString(),
        req.params.id,
      ],
    );
    await event(tx, req.params.id, req.courier.id, "picked_up");
    await recordOrderEvent(tx, req.params.id, 4, "courier", req.courier.id);
    return true;
  });
  if (!ok)
    return fail(
      res,
      409,
      "ابتدا رسیدن به فروشگاه و سپس دریافت واقعی بسته را تأیید کنید.",
    );
  res.json({ ok: true });
});
router.post("/orders/:id/complete", async (req, res) => {
  const result = await db.transaction(async (tx) => {
    const d = await tx.get(
      "SELECT * FROM order_deliveries WHERE order_id=? AND courier_id=? FOR UPDATE",
      [req.params.id, req.courier.id],
    );
    if (!d) return { status: 409, message: "این سفر متعلق به شما نیست." };
    if (d.completed_at)
      return {
        order: await tx.get("SELECT * FROM orders WHERE id=?", [req.params.id]),
      };
    if (d.trip_status !== "in_transit")
      return { status: 409, message: "ابتدا بسته را از فروشگاه دریافت کنید." };
    // Legacy deliveries that predate OTP remain finishable; all new pickups require a code.
    if (d.delivery_otp) {
      if (d.otp_attempts >= 5)
        return {
          status: 429,
          message:
            "تعداد تلاش‌های کد تحویل بیش از حد مجاز است؛ با پشتیبانی تماس بگیرید.",
        };
      if (new Date(d.otp_expires_at).getTime() < Date.now())
        return {
          status: 409,
          message: "اعتبار کد تحویل تمام شده؛ با پشتیبانی تماس بگیرید.",
        };
      if (!deliveryCodeMatches(req.body.code, d.delivery_otp)) {
        await tx.run(
          "UPDATE order_deliveries SET otp_attempts=otp_attempts+1 WHERE order_id=?",
          [req.params.id],
        );
        return {
          status: 400,
          message:
            "کد شش‌رقمی تحویل صحیح نیست. کد را از اپلیکیشن مشتری دریافت کنید.",
        };
      }
    }
    const o = await tx.get("SELECT * FROM orders WHERE id=? FOR UPDATE", [
      req.params.id,
    ]);
    if (o.status !== 4)
      return { status: 409, message: "سفارش در مرحلهٔ تحویل نیست." };
    const now = new Date().toISOString(),
      gross = Number(o.courier_fee ?? o.delivery),
      commission = Math.round(
        (gross * Number(o.courier_commission_rate || 0)) / 100,
      );
    await tx.run("UPDATE orders SET status=5 WHERE id=?", [o.id]);
    await tx.run(
      "UPDATE order_deliveries SET trip_status='completed',completed_at=? WHERE order_id=?",
      [now, o.id],
    );
    await tx.run(
      "INSERT INTO courier_ledger (courier_id,order_id,amount,gross_amount,commission_amount,created_at) VALUES (?,?,?,?,?,?)",
      [req.courier.id, o.id, gross - commission, gross, commission, now],
    );
    await event(tx, o.id, req.courier.id, "completed");
    await recordOrderEvent(tx, o.id, 5, "courier", req.courier.id);
    await notifyCourier(tx, req.courier.id, {
      key: "delivery:" + o.id,
      kind: "finance",
      title: "درآمد سفر ثبت شد",
      body: `درآمد خالص سفارش ${o.id} به کیف پول اضافه شد.`,
      target: "wallet",
    });
    return { order: await tx.get("SELECT * FROM orders WHERE id=?", [o.id]) };
  });
  if (result.status) return fail(res, result.status, result.message);
  res.json({ order: mapOrder(result.order) });
});
export default router;

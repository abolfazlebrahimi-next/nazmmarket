import { deliveryQuote, platformSettings } from "../delivery.js";
import { readDeliveryCode } from "../trip-security.js";
import { firstOffer } from "../product-rules.js";
import { recordOrderEvent } from "../order-workflow.js";
import { Router } from "express";
import crypto from "node:crypto";
import { db, mapOrder } from "../db.js";
import { requireAuth } from "../auth.js";
import { computeDiscount } from "../pricing.js";
const router = Router();
router.use(requireAuth);
const orderTime = () =>
  new Date().toLocaleTimeString("fa-IR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Tehran",
  });
const error = (status, code, message) =>
  Object.assign(new Error(message), { status, code });
router.get("/orders", async (req, res) => {
  const rows = await db.all(
    "SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC, id DESC",
    [req.user.id],
  );
  res.json({ orders: rows.map(mapOrder) });
});
router.get("/orders/:id/delivery-code", async (req, res) => {
  res.set("Cache-Control", "no-store");
  const row = await db.get(
    "SELECT d.delivery_otp,d.otp_expires_at FROM orders o JOIN order_deliveries d ON d.order_id=o.id WHERE o.id=? AND o.user_id=? AND o.status=4",
    [req.params.id, req.user.id],
  );
  if (!row?.delivery_otp)
    return res
      .status(404)
      .json({ error: { message: "کد تحویل برای این سفارش در دسترس نیست." } });
  res.json({
    code: readDeliveryCode(row.delivery_otp),
    expiresAt: row.otp_expires_at,
  });
});
router.get("/orders/:id/events", async (req, res) => {
  const order = await db.get("SELECT id FROM orders WHERE id=? AND user_id=?", [
    req.params.id,
    req.user.id,
  ]);
  if (!order) return res.sendStatus(404);
  res.json({
    events: await db.all(
      "SELECT status,actor_role,created_at FROM order_events WHERE order_id=? ORDER BY id",
      [order.id],
    ),
  });
});
router.get("/orders/:id", async (req, res) => {
  const row = await db.get(
    "SELECT * FROM orders WHERE id = ? AND user_id = ?",
    [req.params.id, req.user.id],
  );
  if (!row)
    return res
      .status(404)
      .json({ error: { code: "not_found", message: "سفارش پیدا نشد." } });
  res.json({ order: mapOrder(row) });
});
router.post("/delivery/quote", async (req, res) => {
  const store = await db.get(
    "SELECT * FROM stores WHERE id=? AND is_active=1",
    [Number(req.body.storeId) || 0],
  );
  if (!store)
    return res
      .status(400)
      .json({ error: { message: "فروشگاه معتبر انتخاب کنید." } });
  const address = await db.get(
    "SELECT * FROM addresses WHERE id=? AND user_id=?",
    [Number(req.body.addressId) || 0, req.user.id],
  );
  let weightKg = 0;
  for (const [id, qty] of Object.entries(req.body.items || {})) {
    const p = await db.get(
      "SELECT m.weight_kg FROM products p JOIN master_products m ON m.id=p.master_product_id WHERE p.id=? AND p.store_id=?",
      [Number(id) || 0, store.id],
    );
    if (p)
      weightKg +=
        Number(p.weight_kg) * Math.max(0, Math.min(99, Number(qty) || 0));
  }
  const settings = await platformSettings(db);
  res.json({
    quote: deliveryQuote({
      from: store,
      to: address,
      weightKg,
      weather: settings.weather,
    }),
  });
});
router.post("/orders", async (req, res) => {
  try {
    const body = req.body ?? {},
      storeId = Number(body.storeId);
    const storeRow = Number.isInteger(storeId)
      ? await db.get(
          "SELECT * FROM stores WHERE id = ? AND seller_id IS NOT NULL AND is_active=1",
          [storeId],
        )
      : null;
    if (!storeRow)
      return res.status(400).json({
        error: {
          code: "store_required",
          message: "فروشگاه فعال و واقعی انتخاب نشده است.",
        },
      });
    const requested = Object.entries(body.items ?? {})
      .map(([id, qty]) => [Number(id), Math.floor(Number(qty))])
      .filter(
        ([id, qty]) =>
          Number.isInteger(id) && id > 0 && Number.isInteger(qty) && qty > 0,
      );
    if (!requested.length)
      return res
        .status(400)
        .json({ error: { code: "empty_cart", message: "سبد خرید خالی است." } });
    const items = [];
    for (const [productId, qty] of requested) {
      if (qty > 99)
        return res.status(400).json({
          error: {
            code: "quantity_too_large",
            message: "تعداد یک کالا نمی‌تواند بیشتر از ۹۹ باشد.",
          },
        });
      const product = await db.get(
        "SELECT products.*, (SELECT weight_kg FROM master_products m WHERE m.id=products.master_product_id) AS weight_kg FROM products WHERE id=? AND store_id=? AND seller_id=? AND active=1 AND master_product_id IN (SELECT id FROM master_products WHERE active=1)",
        [productId, storeId, storeRow.seller_id],
      );
      if (!product)
        return res.status(400).json({
          error: {
            code: "product_unavailable",
            message: "یکی از کالاها دیگر در این فروشگاه موجود نیست.",
          },
        });
      if (Number(product.stock) < qty)
        return res.status(409).json({
          error: {
            code: "out_of_stock",
            message: `موجودی «${product.name}» کافی نیست.`,
          },
        });
      items.push({
        id: Number(product.id),
        masterId: Number(product.master_product_id),
        name: product.name,
        category: product.category,
        qty,
        weightKg: Number(product.weight_kg || 0.5),
        price: Number(product.price),
      });
    }
    const subtotal = items.reduce(
      (sum, item) => sum + item.price * item.qty,
      0,
    );
    if (!Number.isSafeInteger(subtotal))
      return res.status(400).json({
        error: {
          code: "basket_too_large",
          message: "مبلغ سبد خرید معتبر نیست.",
        },
      });
    if (subtotal < Number(storeRow.min_basket ?? 0))
      return res.status(400).json({
        error: {
          code: "minimum_basket",
          message: `حداقل مبلغ سفارش این فروشگاه ${Number(storeRow.min_basket).toLocaleString("fa-IR")} تومان است.`,
        },
      });
    const promoCode = body.promoCode
      ? String(body.promoCode).trim().toUpperCase()
      : null;
    const promo = promoCode
      ? await db.get(
          `SELECT * FROM seller_promos WHERE store_id=? AND code=? AND active=1 AND (expires_at IS NULL OR expires_at>=?)`,
          [storeId, promoCode, new Date().toISOString()],
        )
      : null;
    if (promoCode && !promo)
      return res.status(400).json({
        error: { code: "invalid_promo", message: "کد تخفیف معتبر نیست." },
      });
    if (promo && subtotal < Number(promo.min_subtotal))
      return res.status(400).json({
        error: {
          code: "minimum_not_met",
          message: "مبلغ سبد خرید به حداقل استفاده از کد تخفیف نرسیده است.",
        },
      });
    const sellerDiscount = promo
      ? computeDiscount(
          {
            ...promo,
            amount: Number(promo.amount),
            min_subtotal: Number(promo.min_subtotal),
            max_discount: Number(promo.max_discount),
          },
          subtotal,
        )
      : 0;
    const firstOrderProductId =
      body.firstOrderProductId == null
        ? null
        : Number(body.firstOrderProductId);
    const addressId = Number(body.addressId);
    const addressRow = Number.isInteger(addressId)
      ? await db.get("SELECT * FROM addresses WHERE id=? AND user_id=?", [
          addressId,
          req.user.id,
        ])
      : null;
    const addressTitle = String(
      body.addressTitle ?? addressRow?.title ?? "آدرس انتخابی",
    ).slice(0, 60);
    const addressText = addressRow
      ? `${addressRow.address}، ${addressRow.detail}`
      : String(body.addressText ?? "").slice(0, 240);
    if (!addressText.trim())
      return res.status(400).json({
        error: {
          code: "address_required",
          message: "نشانی تحویل سفارش لازم است.",
        },
      });
    // A real payment gateway is not connected yet; do not mark a simulated online payment as paid.
    if (body.payment === "online")
      return res.status(400).json({
        error: {
          code: "payment_gateway_unavailable",
          message:
            "درگاه پرداخت هنوز فعال نیست؛ فعلاً پرداخت در محل را انتخاب کنید.",
        },
      });
    const payment = "cash",
      id = `NM-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
    const createdAt = new Date().toISOString(),
      slot = String(body.slot ?? "ارسال فوری").slice(0, 60);
    const row = await db.transaction(async (tx) => {
      // Serialize simultaneous first orders for this account so the one-time offer cannot be redeemed twice.
      await tx.get("SELECT id FROM users WHERE id=? FOR UPDATE", [req.user.id]);
      const liveStore = await tx.get(
        "SELECT id FROM stores WHERE id=? AND is_active=1 FOR UPDATE",
        [storeId],
      );
      if (!liveStore)
        throw error(409, "store_unavailable", "فروشگاه دیگر فعال نیست.");
      // Deterministic lock order prevents overselling across different sellers of a central product.
      for (const item of [...items].sort((a, b) => a.masterId - b.masterId)) {
        const master = await tx.get(
          "SELECT id,active FROM master_products WHERE id=? FOR UPDATE",
          [item.masterId],
        );
        if (!master?.active)
          throw error(409, "out_of_stock", "کالا توسط مدیریت غیرفعال شده است.");
        const live = await tx.get(
          "SELECT price,category,active,stock FROM products WHERE id=? FOR UPDATE",
          [item.id],
        );
        if (
          !live?.active ||
          Number(live.stock) < item.qty ||
          Number(live.price) !== item.price ||
          live.category !== item.category
        )
          throw error(
            409,
            "price_changed",
            "اطلاعات کالا تغییر کرده؛ سبد را به‌روز کنید.",
          );
      }
      const priorOrder = await tx.get(
        "SELECT id FROM orders WHERE user_id=? LIMIT 1",
        [req.user.id],
      );
      const redeemed = await tx.get(
        "SELECT user_id FROM first_offer_redemptions WHERE user_id=?",
        [req.user.id],
      );
      const firstOrderDiscount = firstOffer(
        items,
        firstOrderProductId,
        Boolean(priorOrder || redeemed),
      );
      const discount = Math.min(subtotal, sellerDiscount + firstOrderDiscount);
      const settings = await platformSettings(tx);
      const quote = deliveryQuote({
        from: storeRow,
        to: addressRow,
        weightKg: items.reduce(
          (sum, item) => sum + item.weightKg * item.qty,
          0,
        ),
        weather: settings.weather,
      });
      const delivery = quote.fee;
      const total = Math.max(0, subtotal - discount + delivery);
      for (const item of items) {
        const changed = await tx.run(
          "UPDATE products SET stock=stock-? WHERE id=? AND seller_id=? AND stock>=?",
          [item.qty, item.id, storeRow.seller_id, item.qty],
        );
        if (!changed.affectedRows)
          throw error(409, "out_of_stock", "موجودی فروشنده تغییر کرده است.");
      }
      await tx.run(
        `INSERT INTO orders (id, user_id, store_id, store_name, items, subtotal, discount, delivery, total,
          address_title, address_text, slot, payment, payment_status, promo_code, status, time, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'unpaid', ?, 1, ?, ?)`,
        [
          id,
          req.user.id,
          storeId,
          storeRow.name,
          JSON.stringify(items),
          subtotal,
          discount,
          delivery,
          total,
          addressTitle,
          addressText,
          slot,
          payment,
          promoCode,
          orderTime(),
          createdAt,
        ],
      );
      await tx.run(
        "UPDATE orders SET destination_lat=?,destination_lng=?,fare_details=?,courier_fee=?,courier_commission_rate=?,platform_commission=?,first_offer_discount=?,seller_discount=? WHERE id=?",
        [
          addressRow?.lat ?? null,
          addressRow?.lng ?? null,
          JSON.stringify(quote),
          quote.fee,
          settings.courierCommissionPercent,
          Math.round(
            ((subtotal - sellerDiscount) * settings.commissionPercent) / 100,
          ),
          firstOrderDiscount,
          sellerDiscount,
          id,
        ],
      );
      await recordOrderEvent(tx, id, 1, "customer", req.user.id);
      if (firstOrderDiscount > 0)
        await tx.run(
          "INSERT INTO first_offer_redemptions (user_id,order_id,product_id,discount,created_at) VALUES (?,?,?,?,?)",
          [req.user.id, id, firstOrderProductId, firstOrderDiscount, createdAt],
        );
      await tx.run(
        `INSERT INTO carts (user_id, store_id, items, updated_at) VALUES (?, NULL, '{}', ?)
        ON DUPLICATE KEY UPDATE store_id=NULL, items='{}', updated_at=VALUES(updated_at)`,
        [req.user.id, createdAt],
      );
      return tx.get("SELECT * FROM orders WHERE id=?", [id]);
    });
    res.status(201).json({ order: mapOrder(row) });
  } catch (err) {
    if (err.status)
      return res
        .status(err.status)
        .json({ error: { code: err.code, message: err.message } });
    throw err;
  }
});
router.patch("/orders/:id/cancel", async (req, res) => {
  const row = await db.get("SELECT * FROM orders WHERE id=? AND user_id=?", [
    req.params.id,
    req.user.id,
  ]);
  if (!row)
    return res
      .status(404)
      .json({ error: { code: "not_found", message: "سفارش پیدا نشد." } });
  if (Number(row.status) !== 1)
    return res.status(409).json({
      error: {
        code: "not_cancelable",
        message: "این سفارش دیگر قابل لغو نیست.",
      },
    });
  await db.transaction(async (tx) => {
    const changed = await tx.run(
      "UPDATE orders SET status=0 WHERE id=? AND user_id=? AND status=1",
      [row.id, req.user.id],
    );
    if (!changed.affectedRows)
      throw error(
        409,
        "not_cancelable",
        "وضعیت سفارش تغییر کرده و دیگر قابل لغو نیست.",
      );
    await recordOrderEvent(tx, row.id, 0, "customer", req.user.id);
    const items = Array.isArray(row.items)
      ? row.items
      : JSON.parse(row.items || "[]");
    for (const item of items)
      await tx.run("UPDATE products SET stock=stock+? WHERE id=?", [
        Number(item.qty),
        Number(item.id),
      ]);
  });
  res.json({ order: mapOrder({ ...row, status: 0 }) });
});
export default router;

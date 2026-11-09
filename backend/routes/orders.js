import { Router } from "express";
import crypto from "node:crypto";
import { db, mapOrder, mapStore } from "../db.js";
import { requireAuth } from "../auth.js";
import { computeDelivery, computeDiscount } from "../pricing.js";
const router = Router();
router.use(requireAuth);
const orderTime = () => new Date().toLocaleTimeString("fa-IR", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Tehran" });
const error = (status, code, message) => Object.assign(new Error(message), { status, code });
router.get("/orders", async (req, res) => {
  const rows = await db.all("SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC, id DESC", [req.user.id]);
  res.json({ orders: rows.map(mapOrder) });
});
router.get("/orders/:id", async (req, res) => {
  const row = await db.get("SELECT * FROM orders WHERE id = ? AND user_id = ?", [req.params.id, req.user.id]);
  if (!row) return res.status(404).json({ error: { code: "not_found", message: "سفارش پیدا نشد." } });
  res.json({ order: mapOrder(row) });
});
router.post("/orders", async (req, res) => {
  try {
    const body = req.body ?? {}, storeId = Number(body.storeId);
    const storeRow = Number.isInteger(storeId) ? await db.get("SELECT * FROM stores WHERE id = ? AND seller_id IS NOT NULL AND is_active=1", [storeId]) : null;
    if (!storeRow) return res.status(400).json({ error: { code: "store_required", message: "فروشگاه فعال و واقعی انتخاب نشده است." } });
    const requested = Object.entries(body.items ?? {}).map(([id, qty]) => [Number(id), Math.floor(Number(qty))]).filter(([id, qty]) => Number.isInteger(id) && id > 0 && Number.isInteger(qty) && qty > 0);
    if (!requested.length) return res.status(400).json({ error: { code: "empty_cart", message: "سبد خرید خالی است." } });
    const items = [];
    for (const [productId, qty] of requested) {
      if (qty > 99) return res.status(400).json({ error: { code: "quantity_too_large", message: "تعداد یک کالا نمی‌تواند بیشتر از ۹۹ باشد." } });
      const product = await db.get("SELECT * FROM products WHERE id=? AND store_id=? AND seller_id=? AND active=1", [productId, storeId, storeRow.seller_id]);
      if (!product) return res.status(400).json({ error: { code: "product_unavailable", message: "یکی از کالاها دیگر در این فروشگاه موجود نیست." } });
      if (Number(product.stock) < qty) return res.status(409).json({ error: { code: "out_of_stock", message: `موجودی «${product.name}» کافی نیست.` } });
      items.push({ id: Number(product.id), name: product.name, category: product.category, qty, price: Number(product.price) });
    }
    const subtotal = items.reduce((sum, item) => sum + item.price * item.qty, 0);
    if (!Number.isSafeInteger(subtotal)) return res.status(400).json({ error: { code: "basket_too_large", message: "مبلغ سبد خرید معتبر نیست." } });
    if (subtotal < Number(storeRow.min_basket ?? 0)) return res.status(400).json({ error: { code: "minimum_basket", message: `حداقل مبلغ سفارش این فروشگاه ${Number(storeRow.min_basket).toLocaleString("fa-IR")} تومان است.` } });
    const promoCode = body.promoCode ? String(body.promoCode).trim().toUpperCase() : null;
    const promo = promoCode ? await db.get(
      `SELECT * FROM seller_promos WHERE store_id=? AND code=? AND active=1 AND (expires_at IS NULL OR expires_at>=?)`,
      [storeId, promoCode, new Date().toISOString()],
    ) : null;
    if (promoCode && !promo) return res.status(400).json({ error: { code: "invalid_promo", message: "کد تخفیف معتبر نیست." } });
    if (promo && subtotal < Number(promo.min_subtotal)) return res.status(400).json({ error: { code: "minimum_not_met", message: "مبلغ سبد خرید به حداقل استفاده از کد تخفیف نرسیده است." } });
    const sellerDiscount = promo ? computeDiscount({ ...promo, amount: Number(promo.amount), min_subtotal: Number(promo.min_subtotal), max_discount: Number(promo.max_discount) }, subtotal) : 0;
    const firstOrderProductId = body.firstOrderProductId == null ? null : Number(body.firstOrderProductId);
    const addressId = Number(body.addressId);
    const addressRow = Number.isInteger(addressId) ? await db.get("SELECT * FROM addresses WHERE id=? AND user_id=?", [addressId, req.user.id]) : null;
    const addressTitle = String(body.addressTitle ?? addressRow?.title ?? "آدرس انتخابی").slice(0, 60);
    const addressText = addressRow ? `${addressRow.address}، ${addressRow.detail}` : String(body.addressText ?? "").slice(0, 240);
    if (!addressText.trim()) return res.status(400).json({ error: { code: "address_required", message: "نشانی تحویل سفارش لازم است." } });
    // A real payment gateway is not connected yet; do not mark a simulated online payment as paid.
    if (body.payment === "online") return res.status(400).json({ error: { code: "payment_gateway_unavailable", message: "درگاه پرداخت هنوز فعال نیست؛ فعلاً پرداخت در محل را انتخاب کنید." } });
    const payment = "cash", id = `NM-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
    const createdAt = new Date().toISOString(), slot = String(body.slot ?? "ارسال فوری").slice(0, 60);
    const row = await db.transaction(async (tx) => {
      // Serialize simultaneous first orders for this account so the one-time offer cannot be redeemed twice.
      await tx.get("SELECT id FROM users WHERE id=? FOR UPDATE", [req.user.id]);
      const priorOrder = await tx.get("SELECT id FROM orders WHERE user_id=? AND status<>0 LIMIT 1", [req.user.id]);
      let firstOrderDiscount = 0;
      if (firstOrderProductId != null) {
        if (priorOrder) throw error(409, "first_offer_used", "تخفیف اولین خرید قبلاً استفاده شده است.");
        const eligibleItem = items.find((item) => item.id === firstOrderProductId && item.category === "drinks");
        if (!eligibleItem) throw error(400, "first_offer_invalid", "تخفیف خرید اول فقط برای یک نوشیدنی داخل همین سبد قابل استفاده است.");
        firstOrderDiscount = Math.floor(eligibleItem.price / 2);
        eligibleItem.discountedQty = 1;
        eligibleItem.unitDiscount = firstOrderDiscount;
      }
      const discount = Math.min(subtotal, sellerDiscount + firstOrderDiscount);
      const delivery = computeDelivery(mapStore(storeRow), subtotal);
      const total = Math.max(0, subtotal - discount + delivery);
      for (const item of items) {
        const stockUpdate = await tx.run("UPDATE products SET stock=stock-? WHERE id=? AND store_id=? AND seller_id=? AND active=1 AND stock>=?", [item.qty, item.id, storeId, storeRow.seller_id, item.qty]);
        if (!stockUpdate.affectedRows) throw error(409, "out_of_stock", `موجودی «${item.name}» تغییر کرده؛ سبد را دوباره بررسی کنید.`);
      }
      await tx.run(
        `INSERT INTO orders (id, user_id, store_id, store_name, items, subtotal, discount, delivery, total,
          address_title, address_text, slot, payment, payment_status, promo_code, status, time, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'unpaid', ?, 1, ?, ?)`,
        [id, req.user.id, storeId, storeRow.name, JSON.stringify(items), subtotal, discount, delivery, total, addressTitle, addressText, slot, payment, promoCode, orderTime(), createdAt],
      );
      await tx.run(`INSERT INTO carts (user_id, store_id, items, updated_at) VALUES (?, NULL, '{}', ?)
        ON DUPLICATE KEY UPDATE store_id=NULL, items='{}', updated_at=VALUES(updated_at)`, [req.user.id, createdAt]);
      return tx.get("SELECT * FROM orders WHERE id=?", [id]);
    });
    res.status(201).json({ order: mapOrder(row) });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: { code: err.code, message: err.message } });
    throw err;
  }
});
router.patch("/orders/:id/cancel", async (req, res) => {
  const row = await db.get("SELECT * FROM orders WHERE id=? AND user_id=?", [req.params.id, req.user.id]);
  if (!row) return res.status(404).json({ error: { code: "not_found", message: "سفارش پیدا نشد." } });
  if (Number(row.status) !== 1) return res.status(409).json({ error: { code: "not_cancelable", message: "این سفارش دیگر قابل لغو نیست." } });
  await db.transaction(async (tx) => {
    const changed = await tx.run("UPDATE orders SET status=0 WHERE id=? AND user_id=? AND status=1", [row.id, req.user.id]);
    if (!changed.affectedRows) throw error(409, "not_cancelable", "وضعیت سفارش تغییر کرده و دیگر قابل لغو نیست.");
    const items = Array.isArray(row.items) ? row.items : JSON.parse(row.items || "[]");
    for (const item of items) await tx.run("UPDATE products SET stock=stock+? WHERE id=?", [Number(item.qty), Number(item.id)]);
  });
  res.json({ order: mapOrder({ ...row, status: 0 }) });
});
export default router;

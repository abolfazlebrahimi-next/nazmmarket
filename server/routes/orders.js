import { Router } from "express";
import { db, mapOrder, mapStore } from "../db.js";
import { requireAuth } from "../auth.js";
import { computeDelivery, computeDiscount } from "../pricing.js";

const router = Router();
router.use(requireAuth);

const ORDER_START = 2841;

function nextOrderId() {
  const row = db.prepare("SELECT COUNT(*) AS n FROM orders").get();
  let n = ORDER_START + Number(row?.n ?? 0);
  let id = `NM-${n}`;
  while (db.prepare("SELECT 1 FROM orders WHERE id = ?").get(id)) {
    n += 1;
    id = `NM-${n}`;
  }
  return id;
}

function orderTime() {
  return new Date().toLocaleTimeString("fa-IR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Tehran",
  });
}

/** GET /api/orders */
router.get("/orders", (req, res) => {
  const rows = db
    .prepare("SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC, id DESC")
    .all(req.user.id);
  res.json({ orders: rows.map(mapOrder) });
});

/** GET /api/orders/:id */
router.get("/orders/:id", (req, res) => {
  const row = db.prepare("SELECT * FROM orders WHERE id = ? AND user_id = ?").get(req.params.id, req.user.id);
  if (!row) return res.status(404).json({ error: { code: "not_found", message: "سفارش پیدا نشد." } });
  res.json({ order: mapOrder(row) });
});

/** POST /api/orders — prices and totals are always computed on the server. */
router.post("/orders", (req, res) => {
  const body = req.body ?? {};
  const storeId = Number(body.storeId);
  const storeRow = Number.isFinite(storeId)
    ? db.prepare("SELECT * FROM stores WHERE id = ?").get(storeId)
    : null;
  if (!storeRow) {
    return res.status(400).json({ error: { code: "store_required", message: "ابتدا فروشگاه را انتخاب کنید." } });
  }

  const items = [];
  for (const [key, value] of Object.entries(body.items ?? {})) {
    const productId = Number(key);
    const qty = Math.floor(Number(value));
    if (!Number.isFinite(productId) || !Number.isFinite(qty) || qty <= 0) continue;
    const product = db.prepare("SELECT * FROM products WHERE id = ?").get(productId);
    if (!product) continue;
    items.push({ id: product.id, name: product.name, qty, price: product.price });
  }
  if (items.length === 0) {
    return res.status(400).json({ error: { code: "empty_cart", message: "سبد خرید شما خالی است." } });
  }

  const subtotal = items.reduce((sum, i) => sum + i.price * i.qty, 0);
  const promoCode = body.promoCode ? String(body.promoCode).toUpperCase() : null;
  const promo = promoCode ? db.prepare("SELECT * FROM promos WHERE code = ? AND active = 1").get(promoCode) : null;
  const discount = computeDiscount(promo, subtotal);
  const delivery = computeDelivery(mapStore(storeRow), subtotal);
  const total = Math.max(0, subtotal - discount + delivery);

  const addressId = Number(body.addressId);
  const addressRow = Number.isFinite(addressId)
    ? db.prepare("SELECT * FROM addresses WHERE id = ? AND user_id = ?").get(addressId, req.user.id)
    : null;

  const id = nextOrderId();
  const createdAt = new Date().toISOString();
  const time = orderTime();
  const addressTitle = String(body.addressTitle ?? addressRow?.title ?? "آدرس انتخابی").slice(0, 60);
  const addressText = addressRow ? `${addressRow.address}، ${addressRow.detail}` : String(body.addressText ?? "").slice(0, 240);
  const slot = String(body.slot ?? "ارسال فوری").slice(0, 60);
  const payment = body.payment === "cash" ? "cash" : "online";

  db.prepare(
    `INSERT INTO orders
      (id, user_id, store_id, store_name, items, subtotal, discount, delivery, total,
       address_title, address_text, slot, payment, promo_code, status, time, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id, req.user.id, storeRow.id, storeRow.name, JSON.stringify(items), subtotal, discount, delivery,
    total, addressTitle, addressText, slot, payment, promoCode, 1, time, createdAt,
  );

  // the cart is consumed by the order
  db.prepare(
    `INSERT INTO carts (user_id, store_id, items, updated_at) VALUES (?, NULL, '{}', ?)
     ON CONFLICT(user_id) DO UPDATE SET store_id = NULL, items = '{}', updated_at = excluded.updated_at`,
  ).run(req.user.id, createdAt);

  const row = db.prepare("SELECT * FROM orders WHERE id = ?").get(id);
  res.status(201).json({ order: mapOrder(row) });
});

/** PATCH /api/orders/:id/cancel — allowed while the shop has not started packing. */
router.patch("/orders/:id/cancel", (req, res) => {
  const row = db.prepare("SELECT * FROM orders WHERE id = ? AND user_id = ?").get(req.params.id, req.user.id);
  if (!row) return res.status(404).json({ error: { code: "not_found", message: "سفارش پیدا نشد." } });
  if (row.status !== 1) {
    return res.status(409).json({ error: { code: "not_cancelable", message: "این سفارش دیگر قابل لغو نیست." } });
  }
  db.prepare("UPDATE orders SET status = 0 WHERE id = ?").run(row.id);
  res.json({ order: mapOrder({ ...row, status: 0 }) });
});

export default router;

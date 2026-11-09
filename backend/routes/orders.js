import { Router } from "express";
import crypto from "node:crypto";
import { db, mapOrder, mapStore } from "../db.js";
import { requireAuth } from "../auth.js";
import { computeDelivery, computeDiscount } from "../pricing.js";
const router = Router();
router.use(requireAuth);
const orderTime = () => new Date().toLocaleTimeString("fa-IR", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Tehran" });
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
  const body = req.body ?? {}, storeId = Number(body.storeId);
  const storeRow = Number.isFinite(storeId) ? await db.get("SELECT * FROM stores WHERE id = ?", [storeId]) : null;
  if (!storeRow) return res.status(400).json({ error: { code: "store_required", message: "ابتدا فروشگاه را انتخاب کنید." } });
  const items = [];
  for (const [key, value] of Object.entries(body.items ?? {})) {
    const productId = Number(key), qty = Math.floor(Number(value));
    if (!Number.isFinite(productId) || !Number.isFinite(qty) || qty <= 0) continue;
    const product = await db.get("SELECT * FROM products WHERE id = ?", [productId]);
    if (product) items.push({ id: Number(product.id), name: product.name, qty: Math.min(qty, 999), price: Number(product.price) });
  }
  if (!items.length) return res.status(400).json({ error: { code: "empty_cart", message: "سبد خرید شما خالی است." } });
  const subtotal = items.reduce((sum, i) => sum + i.price * i.qty, 0);
  const promoCode = body.promoCode ? String(body.promoCode).toUpperCase() : null;
  const promo = promoCode ? await db.get("SELECT * FROM promos WHERE code = ? AND active = 1", [promoCode]) : null;
  const discount = computeDiscount(promo, subtotal), delivery = computeDelivery(mapStore(storeRow), subtotal);
  const total = Math.max(0, subtotal - discount + delivery);
  const addressId = Number(body.addressId);
  const addressRow = Number.isFinite(addressId) ? await db.get("SELECT * FROM addresses WHERE id = ? AND user_id = ?", [addressId, req.user.id]) : null;
  const id = `NM-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
  const createdAt = new Date().toISOString();
  const addressTitle = String(body.addressTitle ?? addressRow?.title ?? "آدرس انتخابی").slice(0, 60);
  const addressText = addressRow ? `${addressRow.address}، ${addressRow.detail}` : String(body.addressText ?? "").slice(0, 240);
  const slot = String(body.slot ?? "ارسال فوری").slice(0, 60), payment = body.payment === "cash" ? "cash" : "online";
  const row = await db.transaction(async (tx) => {
    await tx.run(`INSERT INTO orders (id, user_id, store_id, store_name, items, subtotal, discount, delivery, total, address_title, address_text, slot, payment, promo_code, status, time, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, req.user.id, storeRow.id, storeRow.name, JSON.stringify(items), subtotal, discount, delivery, total, addressTitle, addressText, slot, payment, promoCode, 1, orderTime(), createdAt]);
    await tx.run(`INSERT INTO carts (user_id, store_id, items, updated_at) VALUES (?, NULL, '{}', ?)
      ON DUPLICATE KEY UPDATE store_id=NULL, items='{}', updated_at=VALUES(updated_at)`, [req.user.id, createdAt]);
    return tx.get("SELECT * FROM orders WHERE id = ?", [id]);
  });
  res.status(201).json({ order: mapOrder(row) });
});
router.patch("/orders/:id/cancel", async (req, res) => {
  const row = await db.get("SELECT * FROM orders WHERE id = ? AND user_id = ?", [req.params.id, req.user.id]);
  if (!row) return res.status(404).json({ error: { code: "not_found", message: "سفارش پیدا نشد." } });
  if (Number(row.status) !== 1) return res.status(409).json({ error: { code: "not_cancelable", message: "این سفارش دیگر قابل لغو نیست." } });
  await db.run("UPDATE orders SET status = 0 WHERE id = ? AND user_id = ?", [row.id, req.user.id]);
  res.json({ order: mapOrder({ ...row, status: 0 }) });
});
export default router;

import { Router } from "express";
import { db, mapAddress, mapOrder, mapUser } from "../db.js";
import { requireAuth, normalizePhone } from "../auth.js";
const router = Router();
router.use(requireAuth);
const readCart = async (userId) => {
  const row = await db.get("SELECT * FROM carts WHERE user_id = ?", [userId]);
  if (!row) return { storeId: null, items: {} };
  let items = {}; try { items = JSON.parse(row.items || "{}"); } catch { /* recover with an empty cart */ }
  return { storeId: row.store_id == null ? null : Number(row.store_id), items };
};
const readAddresses = async (id) => (await db.all("SELECT * FROM addresses WHERE user_id = ? ORDER BY id ASC", [id])).map(mapAddress);
const readFavorites = async (id) => (await db.all("SELECT product_id FROM favorites WHERE user_id = ? ORDER BY product_id", [id])).map((r) => Number(r.product_id));
const readOrders = async (id) => (await db.all("SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC, id DESC", [id])).map(mapOrder);
router.get("/state", async (req, res) => {
  const [cart, favorites, addresses, orders] = await Promise.all([readCart(req.user.id), readFavorites(req.user.id), readAddresses(req.user.id), readOrders(req.user.id)]);
  res.json({ user: req.user, cart, favorites, addresses, orders, wallet: req.user.wallet, pro: req.user.pro });
});
router.put("/cart", async (req, res) => {
  const body = req.body ?? {}, candidate = Number(body.storeId);
  const storeId = body.storeId != null && Number.isFinite(candidate) ? candidate : null;
  const items = {};
  for (const [key, value] of Object.entries(body.items ?? {})) {
    const id = Number(key), qty = Math.max(0, Math.min(999, Math.floor(Number(value))));
    if (Number.isFinite(id) && id > 0 && qty > 0) items[id] = qty;
  }
  const store = storeId ? await db.get("SELECT id FROM stores WHERE id = ?", [storeId]) : null;
  const finalStore = store ? storeId : null;
  await db.run(`INSERT INTO carts (user_id, store_id, items, updated_at) VALUES (?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE store_id=VALUES(store_id), items=VALUES(items), updated_at=VALUES(updated_at)`, [req.user.id, finalStore, JSON.stringify(items), new Date().toISOString()]);
  res.json({ cart: { storeId: finalStore, items } });
});
router.put("/favorites", async (req, res) => {
  const ids = Array.isArray(req.body?.ids) ? req.body.ids.map(Number).filter((n) => Number.isFinite(n) && n > 0) : [];
  const unique = [...new Set(ids)].slice(0, 500);
  const existing = new Set((await db.all("SELECT id FROM products")).map((r) => Number(r.id)));
  const valid = unique.filter((id) => existing.has(id));
  await db.transaction(async (tx) => {
    await tx.run("DELETE FROM favorites WHERE user_id = ?", [req.user.id]);
    for (const id of valid) await tx.run("INSERT INTO favorites (user_id, product_id) VALUES (?, ?)", [req.user.id, id]);
  });
  res.json({ favorites: valid });
});
router.put("/addresses", async (req, res) => {
  const list = Array.isArray(req.body?.addresses) ? req.body.addresses : [];
  if (list.length > 20) return res.status(400).json({ error: { code: "too_many_addresses", message: "حداکثر ۲۰ آدرس مجاز است." } });
  const clean = list.map((a) => ({
    title: String(a?.title ?? "").trim().slice(0, 30) || "آدرس", address: String(a?.address ?? "").trim().slice(0, 180),
    detail: String(a?.detail ?? "").trim().slice(0, 180), phone: normalizePhone(String(a?.phone ?? "")).slice(0, 11),
    type: a?.type === "work" ? "work" : "home", lat: Number.isFinite(Number(a?.lat)) ? Number(a.lat) : null,
    lng: Number.isFinite(Number(a?.lng)) ? Number(a.lng) : null,
  })).filter((a) => a.address.length > 0 || a.detail.length > 0);
  await db.transaction(async (tx) => {
    await tx.run("DELETE FROM addresses WHERE user_id = ?", [req.user.id]);
    for (const a of clean) await tx.run("INSERT INTO addresses (user_id, title, address, detail, phone, type, lat, lng) VALUES (?, ?, ?, ?, ?, ?, ?, ?)", [req.user.id, a.title, a.address, a.detail, a.phone, a.type, a.lat, a.lng]);
  });
  res.json({ addresses: await readAddresses(req.user.id) });
});
router.post("/wallet/topup", async (req, res) => {
  const amount = Math.floor(Number(req.body?.amount));
  if (!Number.isFinite(amount) || amount < 1000 || amount > 5_000_000) return res.status(400).json({ error: { code: "invalid_amount", message: "مبلغ شارژ معتبر نیست." } });
  await db.run("UPDATE users SET wallet = wallet + ? WHERE id = ?", [amount, req.user.id]);
  const row = await db.get("SELECT * FROM users WHERE id = ?", [req.user.id]);
  res.json({ wallet: Number(row.wallet), user: mapUser(row) });
});
router.patch("/pro", async (req, res) => {
  await db.run("UPDATE users SET pro = ? WHERE id = ?", [req.body?.active ? 1 : 0, req.user.id]);
  const row = await db.get("SELECT * FROM users WHERE id = ?", [req.user.id]);
  res.json({ pro: Boolean(row.pro) });
});
export default router;

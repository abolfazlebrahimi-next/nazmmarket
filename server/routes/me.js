import { Router } from "express";
import { db, mapAddress, mapOrder, mapUser } from "../db.js";
import { requireAuth } from "../auth.js";
import { normalizePhone } from "../auth.js";

const router = Router();
router.use(requireAuth);

const readCart = (userId) => {
  const row = db.prepare("SELECT * FROM carts WHERE user_id = ?").get(userId);
  if (!row) return { storeId: null, items: {} };
  return { storeId: row.store_id ?? null, items: JSON.parse(row.items || "{}") };
};

const readAddresses = (userId) =>
  db.prepare("SELECT * FROM addresses WHERE user_id = ? ORDER BY id ASC").all(userId).map(mapAddress);

const readFavorites = (userId) =>
  db.prepare("SELECT product_id FROM favorites WHERE user_id = ? ORDER BY product_id").all(userId).map((r) => r.product_id);

const readOrders = (userId) =>
  db.prepare("SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC, id DESC").all(userId).map(mapOrder);

/** GET /api/me/state — full hydration payload after login. */
router.get("/state", (req, res) => {
  res.json({
    user: req.user,
    cart: readCart(req.user.id),
    favorites: readFavorites(req.user.id),
    addresses: readAddresses(req.user.id),
    orders: readOrders(req.user.id),
    wallet: req.user.wallet,
    pro: req.user.pro,
  });
});

/** PUT /api/me/cart */
router.put("/cart", (req, res) => {
  const body = req.body ?? {};
  const storeId = Number.isFinite(Number(body.storeId)) && body.storeId != null ? Number(body.storeId) : null;
  const items = {};
  for (const [key, value] of Object.entries(body.items ?? {})) {
    const id = Number(key);
    const qty = Math.max(0, Math.min(999, Math.floor(Number(value))));
    if (Number.isFinite(id) && id > 0 && qty > 0) items[id] = qty;
  }
  const store = storeId ? db.prepare("SELECT id FROM stores WHERE id = ?").get(storeId) : null;
  const finalStore = store ? storeId : null;

  db.prepare(
    `INSERT INTO carts (user_id, store_id, items, updated_at) VALUES (?, ?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET store_id = excluded.store_id, items = excluded.items, updated_at = excluded.updated_at`,
  ).run(req.user.id, finalStore, JSON.stringify(items), new Date().toISOString());

  res.json({ cart: { storeId: finalStore, items } });
});

/** PUT /api/me/favorites */
router.put("/favorites", (req, res) => {
  const ids = Array.isArray(req.body?.ids) ? req.body.ids.map(Number).filter((n) => Number.isFinite(n) && n > 0) : [];
  const unique = [...new Set(ids)].slice(0, 500);
  const existing = new Set(db.prepare("SELECT id FROM products").all().map((r) => r.id));
  const valid = unique.filter((id) => existing.has(id));

  db.exec("BEGIN");
  try {
    db.prepare("DELETE FROM favorites WHERE user_id = ?").run(req.user.id);
    const insert = db.prepare("INSERT INTO favorites (user_id, product_id) VALUES (?, ?)");
    valid.forEach((id) => insert.run(req.user.id, id));
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
  res.json({ favorites: valid });
});

/** PUT /api/me/addresses — replaces the whole address book (small list, simple & atomic). */
router.put("/addresses", (req, res) => {
  const list = Array.isArray(req.body?.addresses) ? req.body.addresses : [];
  if (list.length > 20) {
    return res.status(400).json({ error: { code: "too_many_addresses", message: "حداکثر ۲۰ آدرس مجاز است." } });
  }
  const clean = list
    .map((a) => ({
      title: String(a?.title ?? "").trim().slice(0, 30) || "آدرس",
      address: String(a?.address ?? "").trim().slice(0, 180),
      detail: String(a?.detail ?? "").trim().slice(0, 180),
      phone: normalizePhone(String(a?.phone ?? "")).slice(0, 11),
      type: a?.type === "work" ? "work" : "home",
      lat: Number.isFinite(Number(a?.lat)) ? Number(a.lat) : null,
      lng: Number.isFinite(Number(a?.lng)) ? Number(a.lng) : null,
    }))
    .filter((a) => a.address.length > 0 || a.detail.length > 0);

  db.exec("BEGIN");
  try {
    db.prepare("DELETE FROM addresses WHERE user_id = ?").run(req.user.id);
    const insert = db.prepare(
      "INSERT INTO addresses (user_id, title, address, detail, phone, type, lat, lng) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    );
    clean.forEach((a) => insert.run(req.user.id, a.title, a.address, a.detail, a.phone, a.type, a.lat, a.lng));
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
  res.json({ addresses: readAddresses(req.user.id) });
});

/** POST /api/me/wallet/topup */
router.post("/wallet/topup", (req, res) => {
  const amount = Math.floor(Number(req.body?.amount));
  if (!Number.isFinite(amount) || amount < 1000 || amount > 5_000_000) {
    return res.status(400).json({ error: { code: "invalid_amount", message: "مبلغ شارژ معتبر نیست." } });
  }
  db.prepare("UPDATE users SET wallet = wallet + ? WHERE id = ?").run(amount, req.user.id);
  const row = db.prepare("SELECT * FROM users WHERE id = ?").get(req.user.id);
  res.json({ wallet: row.wallet, user: mapUser(row) });
});

/** PATCH /api/me/pro — activate the Pro subscription (demo checkout). */
router.patch("/pro", (req, res) => {
  const active = Boolean(req.body?.active);
  db.prepare("UPDATE users SET pro = ? WHERE id = ?").run(active ? 1 : 0, req.user.id);
  const row = db.prepare("SELECT * FROM users WHERE id = ?").get(req.user.id);
  res.json({ pro: Boolean(row.pro) });
});

export default router;

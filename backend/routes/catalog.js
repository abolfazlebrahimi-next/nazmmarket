import { Router } from "express";
import { db, mapProduct, mapStore, mapPromo, catalog } from "../db.js";
const router = Router();
const allProducts = async (category, q, storeId) => {
  const where = ["seller_id IS NOT NULL", "store_id IS NOT NULL", "active = 1", "stock > 0", "image_url IS NOT NULL", "EXISTS (SELECT 1 FROM stores s WHERE s.id=products.store_id AND s.seller_id=products.seller_id AND s.is_active=1)"];
  const values = [];
  if (category && category !== "all") { where.push("category = ?"); values.push(category); }
  if (q) { where.push("(name LIKE ? OR category LIKE ?)"); values.push(`%${q.trim()}%`, `%${q.trim()}%`); }
  if (storeId != null) { where.push("store_id = ?"); values.push(storeId); }
  return (await db.all(`SELECT * FROM products WHERE ${where.join(" AND ")} ORDER BY sort_order ASC, id DESC`, values)).map(mapProduct);
};
const allStores = async (q, type) => {
  const where = ["seller_id IS NOT NULL", "is_active = 1", "photo_url IS NOT NULL"];
  const values = [];
  if (q) { where.push("(name LIKE ? OR area LIKE ? OR address LIKE ?)"); values.push(`%${q.trim()}%`, `%${q.trim()}%`, `%${q.trim()}%`); }
  if (type) { where.push("type = ?"); values.push(type); }
  return (await db.all(`SELECT * FROM stores WHERE ${where.join(" AND ")} ORDER BY id DESC`, values)).map(mapStore);
};
const activePromos = async () => (await db.all(
  `SELECT p.*, s.name AS store_name FROM seller_promos p JOIN stores s ON s.id=p.store_id
   WHERE p.active=1 AND s.is_active=1 AND (p.expires_at IS NULL OR p.expires_at >= ?)
   ORDER BY p.created_at DESC`, [new Date().toISOString()],
)).map((row) => ({ ...mapPromo(row), storeId: Number(row.store_id), storeName: row.store_name }));

router.get("/catalog", async (_req, res) => {
  const [products, stores, promos] = await Promise.all([allProducts(), allStores(), activePromos()]);
  res.json({ products, stores, categories: catalog.categories, brands: [], promos });
});
router.get("/products", async (req, res) => res.json({ products: await allProducts(String(req.query.category ?? "all"), String(req.query.q ?? ""), req.query.storeId == null ? null : Number(req.query.storeId)) }));
router.get("/stores", async (req, res) => res.json({ stores: await allStores(String(req.query.q ?? ""), String(req.query.type ?? "") || undefined) }));
router.get("/stores/:id", async (req, res) => {
  const id = Number(req.params.id);
  const row = Number.isInteger(id) ? await db.get("SELECT * FROM stores WHERE id = ? AND seller_id IS NOT NULL AND is_active=1", [id]) : null;
  if (!row) return res.status(404).json({ error: { code: "not_found", message: "فروشگاه پیدا نشد." } });
  res.json({ store: mapStore(row), products: await allProducts(undefined, undefined, id) });
});
router.get("/search", async (req, res) => {
  const q = String(req.query.q ?? "").trim();
  res.json({ query: q, stores: q ? await allStores(q) : [], products: q ? await allProducts(undefined, q) : [] });
});
export default router;

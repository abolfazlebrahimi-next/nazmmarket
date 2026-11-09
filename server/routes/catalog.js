import { Router } from "express";
import { db, mapProduct, mapStore, mapPromo, catalog } from "../db.js";
const router = Router();
const allProducts = async (category, q) => {
  let rows = await db.all("SELECT * FROM products ORDER BY sort_order ASC, id ASC");
  if (category && category !== "all") rows = rows.filter((r) => r.category === category);
  if (q) { const needle = q.trim(); rows = rows.filter((r) => r.name.includes(needle) || r.category.includes(needle)); }
  return rows.map(mapProduct);
};
const allStores = async (q) => {
  let rows = await db.all("SELECT * FROM stores ORDER BY id ASC");
  if (q) { const needle = q.trim(); rows = rows.filter((r) => r.name.includes(needle) || r.area.includes(needle)); }
  return rows.map(mapStore);
};
router.get("/catalog", async (_req, res) => {
  const [promos, products, stores] = await Promise.all([db.all("SELECT * FROM promos WHERE active = 1"), allProducts(), allStores()]);
  res.json({ products, stores, categories: catalog.categories, brands: catalog.brands, promos: promos.map(mapPromo) });
});
router.get("/products", async (req, res) => res.json({ products: await allProducts(String(req.query.category ?? "all"), String(req.query.q ?? "")) }));
router.get("/stores", async (_req, res) => res.json({ stores: await allStores() }));
router.get("/stores/:id", async (req, res) => {
  const row = await db.get("SELECT * FROM stores WHERE id = ?", [Number(req.params.id)]);
  if (!row) return res.status(404).json({ error: { code: "not_found", message: "فروشگاه پیدا نشد." } });
  res.json({ store: mapStore(row), products: await allProducts() });
});
router.get("/search", async (req, res) => {
  const q = String(req.query.q ?? "").trim();
  res.json({ query: q, stores: q ? await allStores(q) : [], products: q ? await allProducts(undefined, q) : [] });
});
export default router;

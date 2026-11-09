import { Router } from "express";
import { db, mapProduct, mapStore, mapPromo, catalog } from "../db.js";

const router = Router();

const allProducts = (category, q) => {
  let rows = db.prepare("SELECT * FROM products ORDER BY sort_order ASC, id ASC").all();
  if (category && category !== "all") rows = rows.filter((r) => r.category === category);
  if (q) {
    const needle = q.trim();
    rows = rows.filter((r) => r.name.includes(needle) || r.category.includes(needle));
  }
  return rows.map(mapProduct);
};

const allStores = (q) => {
  let rows = db.prepare("SELECT * FROM stores ORDER BY id ASC").all();
  if (q) {
    const needle = q.trim();
    rows = rows.filter((r) => r.name.includes(needle) || r.area.includes(needle));
  }
  return rows.map(mapStore);
};

/** GET /api/catalog — everything the storefront needs in one round-trip. */
router.get("/catalog", (_req, res) => {
  const promos = db.prepare("SELECT * FROM promos WHERE active = 1").all().map(mapPromo);
  res.json({
    products: allProducts(),
    stores: allStores(),
    categories: catalog.categories,
    brands: catalog.brands,
    promos,
  });
});

/** GET /api/products?category=dairy&q=شیر */
router.get("/products", (req, res) => {
  res.json({ products: allProducts(String(req.query.category ?? "all"), String(req.query.q ?? "")) });
});

/** GET /api/stores */
router.get("/stores", (_req, res) => {
  res.json({ stores: allStores() });
});

/** GET /api/stores/:id */
router.get("/stores/:id", (req, res) => {
  const row = db.prepare("SELECT * FROM stores WHERE id = ?").get(Number(req.params.id));
  if (!row) return res.status(404).json({ error: { code: "not_found", message: "فروشگاه پیدا نشد." } });
  res.json({ store: mapStore(row), products: allProducts() });
});

/** GET /api/search?q= */
router.get("/search", (req, res) => {
  const q = String(req.query.q ?? "").trim();
  res.json({
    query: q,
    stores: q ? allStores(q) : [],
    products: q ? allProducts(undefined, q) : [],
  });
});

export default router;

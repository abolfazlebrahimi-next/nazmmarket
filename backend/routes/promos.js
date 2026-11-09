import { Router } from "express";
import { db, mapPromo } from "../db.js";
import { requireAuth } from "../auth.js";
import { computeDiscount } from "../pricing.js";
const router = Router();
router.post("/apply", requireAuth, async (req, res) => {
  const code = String(req.body?.code ?? "").trim().toUpperCase();
  const subtotal = Math.max(0, Math.floor(Number(req.body?.subtotal ?? 0)));
  const storeId = Number(req.body?.storeId);
  if (!code) return res.status(400).json({ error: { code: "empty_code", message: "کد تخفیف را وارد کنید." } });
  if (!Number.isInteger(storeId) || storeId < 1) return res.status(400).json({ error: { code: "store_required", message: "ابتدا فروشگاه را انتخاب کنید." } });
  const promo = await db.get(
    `SELECT * FROM seller_promos WHERE store_id=? AND code=? AND active=1
     AND (expires_at IS NULL OR expires_at >= ?)`, [storeId, code, new Date().toISOString()],
  );
  if (!promo) return res.json({ applied: false, amount: 0, message: "این کد برای فروشگاه انتخاب‌شده معتبر نیست." });
  promo.amount = Number(promo.amount); promo.min_subtotal = Number(promo.min_subtotal); promo.max_discount = Number(promo.max_discount);
  if (subtotal < promo.min_subtotal) return res.json({ applied: false, amount: 0, minSubtotal: promo.min_subtotal, message: `این کد برای خرید بالای ${promo.min_subtotal.toLocaleString("fa-IR")} تومان است.` });
  res.json({ applied: true, amount: computeDiscount(promo, subtotal), promo: mapPromo(promo), message: "کد تخفیف فروشگاه اعمال شد." });
});
router.get("/", requireAuth, async (req, res) => {
  const rows = await db.all(
    `SELECT p.* FROM seller_promos p JOIN stores s ON s.id=p.store_id
     WHERE s.is_active=1 AND p.active=1 AND (p.expires_at IS NULL OR p.expires_at >= ?)
     ORDER BY p.created_at DESC`, [new Date().toISOString()],
  );
  res.json({ promos: rows.map(mapPromo) });
});
export default router;

import { Router } from "express";
import { db, mapPromo } from "../db.js";
import { requireAuth } from "../auth.js";
import { computeDiscount } from "../pricing.js";
const router = Router();
router.post("/apply", requireAuth, async (req, res) => {
  const code = String(req.body?.code ?? "").trim().toUpperCase(), subtotal = Math.max(0, Math.floor(Number(req.body?.subtotal ?? 0)));
  if (!code) return res.status(400).json({ error: { code: "empty_code", message: "کد تخفیف را وارد کنید." } });
  const promo = await db.get("SELECT * FROM promos WHERE code = ? AND active = 1", [code]);
  if (!promo) return res.json({ applied: false, amount: 0, message: "کد تخفیف معتبر نیست." });
  promo.min_subtotal = Number(promo.min_subtotal); promo.amount = Number(promo.amount); promo.max_discount = Number(promo.max_discount);
  if (subtotal < promo.min_subtotal) return res.json({ applied: false, amount: 0, minSubtotal: promo.min_subtotal, message: `این کد برای خرید بالای ${promo.min_subtotal.toLocaleString("fa-IR")} تومان است.` });
  res.json({ applied: true, amount: computeDiscount(promo, subtotal), promo: mapPromo(promo), message: "کد تخفیف اعمال شد." });
});
router.get("/", requireAuth, async (_req, res) => {
  const rows = await db.all("SELECT * FROM promos WHERE active = 1");
  res.json({ promos: rows.map(mapPromo) });
});
export default router;

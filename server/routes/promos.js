import { Router } from "express";
import { db, mapPromo } from "../db.js";
import { requireAuth } from "../auth.js";
import { computeDiscount } from "../pricing.js";

const router = Router();

/** POST /api/promos/apply { code, subtotal } */
router.post("/apply", requireAuth, (req, res) => {
  const code = String(req.body?.code ?? "").trim().toUpperCase();
  const subtotal = Math.max(0, Math.floor(Number(req.body?.subtotal ?? 0)));

  if (!code) {
    return res.status(400).json({ error: { code: "empty_code", message: "کد تخفیف را وارد کنید." } });
  }

  const promo = db.prepare("SELECT * FROM promos WHERE code = ? AND active = 1").get(code);
  if (!promo) {
    return res.json({ applied: false, amount: 0, message: "کد تخفیف معتبر نیست." });
  }
  if (subtotal < promo.min_subtotal) {
    return res.json({
      applied: false,
      amount: 0,
      minSubtotal: promo.min_subtotal,
      message: `این کد برای خرید بالای ${promo.min_subtotal.toLocaleString("fa-IR")} تومان است.`,
    });
  }

  res.json({
    applied: true,
    amount: computeDiscount(promo, subtotal),
    promo: mapPromo(promo),
    message: "کد تخفیف اعمال شد.",
  });
});

/** GET /api/promos — active codes shown in "کدهای تخفیف من". */
router.get("/", requireAuth, (_req, res) => {
  res.json({ promos: db.prepare("SELECT * FROM promos WHERE active = 1").all().map(mapPromo) });
});

export default router;

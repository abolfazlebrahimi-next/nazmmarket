import { Router } from "express";
import { db, mapPromo } from "../db.js";
import { requireAuth } from "../auth.js";
import {
  alreadyRedeemed,
  findPromo,
  promoDiscount,
  promoExhausted,
} from "../promos.js";
const router = Router();

/** Pre-flight check used by the cart; it never consumes the code. */
router.post("/apply", requireAuth, async (req, res) => {
  const code = String(req.body?.code ?? "").trim().toUpperCase();
  const subtotal = Math.max(0, Math.floor(Number(req.body?.subtotal ?? 0)));
  const storeId = Number(req.body?.storeId);
  if (!code)
    return res
      .status(400)
      .json({ error: { code: "empty_code", message: "کد تخفیف را وارد کنید." } });
  if (!Number.isInteger(storeId) || storeId < 1)
    return res.status(400).json({
      error: {
        code: "store_required",
        message: "ابتدا فروشگاه را انتخاب کنید.",
      },
    });
  const promo = await findPromo(db, {
    code,
    userId: req.user.id,
    storeId,
  });
  if (!promo)
    return res.json({
      applied: false,
      amount: 0,
      message: "این کد برای فروشگاه انتخاب‌شده معتبر یا فعال نیست.",
    });
  if (promoExhausted(promo))
    return res.json({
      applied: false,
      amount: 0,
      message: "ظرفیت این کد تخفیف تکمیل شده است.",
    });
  if (await alreadyRedeemed(db, promo, req.user.id))
    return res.json({
      applied: false,
      amount: 0,
      message:
        promo.max_uses > 0
          ? "این کد یک‌بارمصرف است و قبلاً روی حساب شما استفاده شده."
          : "این کد را قبلاً در یک سفارش استفاده کرده‌اید.",
    });
  if (subtotal < Number(promo.min_subtotal))
    return res.json({
      applied: false,
      amount: 0,
      minSubtotal: Number(promo.min_subtotal),
      message: `این کد برای خرید بالای ${Number(promo.min_subtotal).toLocaleString("fa-IR")} تومان است.`,
    });
  res.json({
    applied: true,
    amount: promoDiscount(promo, subtotal),
    promo: { ...mapPromo(promo), storeId: Number(promo.store_id ?? 0) || null },
    message:
      promo.scope === "platform"
        ? "کد تخفیف نازمارکت اعمال شد."
        : "کد تخفیف فروشگاه اعمال شد.",
  });
});

/** Every code the signed-in account may currently use. */
router.get("/", requireAuth, async (req, res) => {
  const now = new Date().toISOString();
  const [storeRows, platformRows] = await Promise.all([
    db.all(
      `SELECT p.*, 'store' AS scope, s.name AS store_name FROM seller_promos p JOIN stores s ON s.id=p.store_id
       WHERE s.is_active=1 AND p.active=1 AND (p.expires_at IS NULL OR p.expires_at >= ?)
         AND (p.max_uses = 0 OR p.usage_count < p.max_uses)
       ORDER BY p.created_at DESC`,
      [now],
    ),
    db.all(
      `SELECT p.*, 'platform' AS scope FROM platform_promos p
       WHERE p.active=1 AND (p.starts_at IS NULL OR p.starts_at <= ?)
         AND (p.expires_at IS NULL OR p.expires_at >= ?)
         AND (p.max_uses = 0 OR p.usage_count < p.max_uses)
         AND (p.audience='all' OR EXISTS(
           SELECT 1 FROM platform_promo_users t WHERE t.promo_id=p.id AND t.user_id=?))
       ORDER BY p.id DESC`,
      [now, now, req.user.id],
    ),
  ]);
  const redeemed = new Map(
    (
      await db.all(
        `SELECT scope,promo_id FROM promo_redemptions WHERE user_id=?`,
        [req.user.id],
      )
    ).map((r) => [`${r.scope}:${Number(r.promo_id)}`, true]),
  );
  const decorate = (row) => {
    const base = mapPromo(row);
    return {
      ...base,
      scope: row.scope,
      storeId: row.store_id == null ? null : Number(row.store_id),
      storeName: row.store_name ?? null,
      used: redeemed.has(`${row.scope}:${Number(row.id)}`),
      remaining: base.maxUses > 0 ? Math.max(0, base.maxUses - base.usageCount) : null,
    };
  };
  res.json({
    promos: [...platformRows, ...storeRows].map(decorate),
  });
});

export default router;

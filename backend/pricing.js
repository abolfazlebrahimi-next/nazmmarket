/** Shared pricing rules — one source of truth for the API. */
import { FREE_DELIVERY } from "./config.js";

export function computeDiscount(promo, subtotal) {
  if (!promo || !promo.active) return 0;
  if (subtotal < promo.min_subtotal) return 0;
  const raw = promo.kind === "percent" ? Math.round((subtotal * promo.amount) / 100) : promo.amount;
  const capped = promo.max_discount > 0 ? Math.min(raw, promo.max_discount) : raw;
  return Math.max(0, Math.min(capped, subtotal));
}

export function computeDelivery(store, subtotal) {
  if (subtotal <= 0) return 0;
  if (subtotal >= FREE_DELIVERY) return 0;
  return store?.fee ?? 35000;
}

export function moneySum(items) {
  return items.reduce((sum, item) => sum + item.price * item.qty, 0);
}

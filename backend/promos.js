/**
 * Shared discount-code rules.
 *
 * Two families of codes exist:
 *  - `store`    → seller_promos, created by a seller for one store.
 *  - `platform` → platform_promos, created by the main admin panel either for
 *                 every customer (`audience='all'`) or for a chosen list of accounts.
 *
 * Every code is single-use per account: `promo_redemptions` keeps a unique
 * (scope, promo_id, user_id) row, so the same customer can never redeem a code
 * twice. `max_uses` adds an optional total capacity (0 = unlimited) which is
 * consumed atomically inside the order transaction.
 */
import { computeDiscount } from "./pricing.js";

export const PROMO_TABLES = Object.freeze({
  store: "seller_promos",
  platform: "platform_promos",
});

const promoError = (status, code, message) => {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
};

/** Reads the first live code matching `code` for this account and store. */
export async function findPromo(executor, { code, userId, storeId }) {
  const key = String(code || "").trim().toUpperCase();
  if (!key) return null;
  const now = new Date().toISOString();
  const platform = await executor.get(
    `SELECT p.*, 'platform' AS scope FROM platform_promos p
     WHERE p.code=? AND p.active=1
       AND (p.starts_at IS NULL OR p.starts_at<=?)
       AND (p.expires_at IS NULL OR p.expires_at>=?)
       AND (p.audience='all' OR EXISTS(
         SELECT 1 FROM platform_promo_users t WHERE t.promo_id=p.id AND t.user_id=?))
     ORDER BY p.id DESC LIMIT 1`,
    [key, now, now, userId],
  );
  if (platform) return platform;
  if (storeId == null) return null;
  return executor.get(
    `SELECT p.*, 'store' AS scope FROM seller_promos p
      JOIN stores s ON s.id=p.store_id AND s.is_active=1
     WHERE p.store_id=? AND p.code=? AND p.active=1
       AND (p.starts_at IS NULL OR p.starts_at<=?)
       AND (p.expires_at IS NULL OR p.expires_at>=?)`,
    [Number(storeId), key, now, now],
  );
}

/** Capacity left on a code; `max_uses = 0` means unlimited. */
export function promoExhausted(promo) {
  return (
    Number(promo?.max_uses ?? 0) > 0 &&
    Number(promo?.usage_count ?? 0) >= Number(promo.max_uses)
  );
}

/** The customer already redeemed this exact code on an earlier order. */
export async function alreadyRedeemed(executor, promo, userId) {
  const row = await executor.get(
    "SELECT order_id FROM promo_redemptions WHERE scope=? AND promo_id=? AND user_id=?",
    [promo.scope, Number(promo.id), Number(userId)],
  );
  return row ?? null;
}

/**
 * Locks one redemption for the account. Must run inside the order
 * transaction so two parallel checkouts cannot consume the same code.
 */
export async function consumePromo(tx, { promo, userId, orderId, discount, createdAt }) {
  const table = PROMO_TABLES[promo.scope];
  const maxUses = Number(promo.max_uses ?? 0);
  const taken = await tx.run(
    `UPDATE \`${table}\` SET usage_count = usage_count + 1
     WHERE id=? AND (max_uses = 0 OR usage_count < max_uses)`,
    [Number(promo.id)],
  );
  if (!taken.affectedRows)
    throw promoError(
      409,
      "promo_exhausted",
      "ظرفیت این کد تخفیف همین حالا تکمیل شد؛ مبلغ تخفیف اعمال نشد.",
    );
  await tx.run(
    `INSERT INTO promo_redemptions (scope,promo_id,user_id,order_id,discount,created_at)
     VALUES (?,?,?,?,?,?)`,
    [promo.scope, Number(promo.id), Number(userId), orderId, discount, createdAt],
  );
}

/** Frees the redemption again when the order that consumed it is cancelled. */
export async function releasePromo(tx, orderId) {
  const rows = await tx.all(
    "SELECT scope,promo_id FROM promo_redemptions WHERE order_id=?",
    [orderId],
  );
  for (const row of rows) {
    const table = PROMO_TABLES[row.scope] || PROMO_TABLES.store;
    await tx.run(
      `UPDATE \`${table}\` SET usage_count = GREATEST(CAST(usage_count AS SIGNED) - 1, 0) WHERE id=?`,
      [Number(row.promo_id)],
    );
    await tx.run("DELETE FROM promo_redemptions WHERE order_id=? AND scope=? AND promo_id=?", [
      orderId,
      row.scope,
      Number(row.promo_id),
    ]);
  }
  return rows.length;
}

/**
 * Bound a code window with a day picked in a Persian calendar.
 *
 * A date picker hands over `YYYY-MM-DD`; the panels mean "from the start of
 * that day" and "until the end of it", so the day is expanded to UTC bounds
 * rather than read as an instant — that reading used to expire a code before
 * its last day had begun and made "today" an invalid deadline. Values that
 * already carry a time (an edit that keeps the stored row) pass through, and an
 * unparsable value yields `undefined` so the caller can reject the form.
 */
export function promoDateBound(value, bound = "end") {
  const raw = String(value ?? "").trim();
  if (!raw || raw === "null" || raw === "undefined") return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const instant = new Date(raw);
    return Number.isFinite(instant.getTime()) ? instant.toISOString() : undefined;
  }
  return `${raw}T${bound === "start" ? "00:00:00.000" : "23:59:59.999"}Z`;
}

/** Discount value of a code for a basket, shared by /promos/apply and checkout. */
export function promoDiscount(promo, subtotal) {
  return computeDiscount(
    {
      active: 1,
      kind: promo.kind,
      amount: Number(promo.amount),
      min_subtotal: Number(promo.min_subtotal),
      max_discount: Number(promo.max_discount),
    },
    subtotal,
  );
}

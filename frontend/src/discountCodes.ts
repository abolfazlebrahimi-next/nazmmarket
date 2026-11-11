/**
 * Discount codes as the customer app shows them.
 *
 * Two families reach this layer: the public catalog payload (store codes only,
 * no account knowledge) and `GET /api/promos`, which is scoped to the signed-in
 * account and therefore also carries the platform codes, whether this account
 * already burned a code, and how much capacity is left. Both shapes are read
 * through `readDiscountCodes` so a card never has to guess which source it got.
 */
export type DiscountCode = {
  code: string;
  title: string;
  desc: string;
  amount: number;
  kind: "percent" | "fixed";
  scope: "store" | "platform";
  storeId: number | null;
  storeName: string | null;
  minSubtotal: number;
  maxDiscount: number;
  maxUses: number;
  usageCount: number;
  /** `null` when the code has no total cap — never read it as "none left". */
  remaining: number | null;
  /** This account already redeemed the code on an order. */
  used: boolean;
  expiresAt: string | null;
};

export type WireDiscountCode = {
  code?: string | null;
  title?: string | null;
  desc?: string | null;
  description?: string | null;
  amount?: number | string | null;
  kind?: string | null;
  scope?: string | null;
  storeId?: number | string | null;
  store_id?: number | string | null;
  storeName?: string | null;
  store_name?: string | null;
  minSubtotal?: number | string | null;
  maxDiscount?: number | string | null;
  maxUses?: number | string | null;
  usageCount?: number | string | null;
  remaining?: number | string | null;
  used?: boolean | number | string | null;
  expiresAt?: string | null;
};

const text = (value: unknown, max: number) => String(value ?? "").slice(0, max);
const whole = (value: unknown) => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
};
const idOf = (value: unknown) => {
  const n = Number(value);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
};
const truthy = (value: unknown) =>
  value === true || value === 1 || value === "1" || value === "true";

/** One card row, with every optional wire field given a safe default. */
export function readDiscountCode(row: WireDiscountCode): DiscountCode {
  const maxUses = whole(row.maxUses);
  const usageCount = whole(row.usageCount);
  const remaining =
    row.remaining === undefined || row.remaining === null
      ? maxUses > 0
        ? Math.max(0, maxUses - usageCount)
        : null
      : Math.max(0, whole(row.remaining));
  return {
    code: text(row.code, 40).toUpperCase(),
    title: text(row.title, 180),
    desc: text(row.desc ?? row.description, 255),
    amount: whole(row.amount),
    kind: row.kind === "percent" ? "percent" : "fixed",
    scope: row.scope === "platform" ? "platform" : "store",
    storeId: idOf(row.storeId ?? row.store_id),
    storeName: text(row.storeName ?? row.store_name, 120) || null,
    minSubtotal: whole(row.minSubtotal),
    maxDiscount: whole(row.maxDiscount),
    maxUses,
    usageCount,
    remaining,
    used: truthy(row.used),
    expiresAt: row.expiresAt ? text(row.expiresAt, 32) : null,
  };
}

export const readDiscountCodes = (
  rows: readonly WireDiscountCode[] | null | undefined,
): DiscountCode[] =>
  (rows ?? [])
    .filter((row): row is WireDiscountCode => !!row && typeof row === "object")
    .map(readDiscountCode)
    .filter((row) => row.code)
    .sort(
      (a, b) =>
        Number(a.used) - Number(b.used) ||
        (a.scope === b.scope ? 0 : a.scope === "platform" ? -1 : 1) ||
        a.code.localeCompare(b.code),
    );

/** «۲۰٪» or «۱۵٬۰۰۰ تومان» — the value line shared by the code cards. */
export const discountValue = (
  code: Pick<DiscountCode, "kind" | "amount">,
  format: (n: number) => string,
) =>
  code.kind === "percent"
    ? `${format(code.amount)}٪`
    : `${format(code.amount)} تومان`;

/** Conditions that must hold before the code is worth typing at checkout. */
export const discountConditions = (
  code: DiscountCode,
  format: (n: number) => string,
): string[] => {
  const lines: string[] = [];
  if (code.minSubtotal > 0) lines.push(`حداقل سبد ${format(code.minSubtotal)}`);
  if (code.maxDiscount > 0) lines.push(`سقف تخفیف ${format(code.maxDiscount)}`);
  if (code.remaining !== null)
    lines.push(`${format(code.remaining)} مصرف باقی‌مانده`);
  return lines;
};

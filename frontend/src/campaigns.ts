import type { Category, Product } from "./data";
const available = (p: Product) => p.active !== false && Number(p.stock) > 0;
export function amazingDeals(catalog: Product[]): Product[] {
  return catalog
    .filter(
      (p) =>
        available(p) &&
        Number(p.oldPrice) > 0 &&
        (Number(p.oldPrice) - p.price) * 100 > Number(p.oldPrice) * 5,
    )
    .sort(
      (a, b) =>
        (Number(b.oldPrice) - b.price) / Number(b.oldPrice) -
        (Number(a.oldPrice) - a.price) / Number(a.oldPrice),
    );
}
export function isWater(name: string): boolean {
  const text = name
    .normalize("NFKC")
    .replace(/[\u064b-\u065f]/g, "")
    .replace(/ي/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/[\u200c\u200f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (/\bwater\b/i.test(text)) return true;
  if (
    /(?:^|\s)آب\s+(?:معدنی|آشامیدنی|گازدار|طعم\s?دار|ساده|بدون گاز)(?:\s|$)/.test(
      text,
    )
  )
    return true;
  if (!/^آب(?:\s|$)/.test(text)) return false;
  // Spaced juice names are not bottled water (nor is the word آبمیوه).
  return !/^آب\s+(?:میوه|پرتقال|انار|سیب|آلبالو|هویج|انگور|آناناس|نارگیل|زرشک|لیمو|لیموی)(?:\s|$)/.test(
    text,
  );
}
export function energizingDrinks(catalog: Product[]): Product[] {
  return catalog
    .filter((p) => available(p) && p.category === "drinks" && !isWater(p.name))
    .sort((a, b) => a.price - b.price || a.id - b.id);
}

/** Rows a customer could not add right now do not count towards a tile. */
type ShelfRow = { category?: string; active?: boolean; stock?: number };
const offShelf = (p: ShelfRow) => p.active === false || !(Number(p.stock) > 0);

/**
 * The quick-access shelf: every category that currently has something to sell,
 * the fullest stock first (ties broken by the Persian name), so the row reads as
 * an ordered list instead of whatever order the catalog happened to arrive in.
 * The "همه" pseudo-category is the row's neighbour, not a tile of its own.
 */
export function categoryShelf(
  catalog: ShelfRow[],
  categories: Category[],
): (Category & { count: number })[] {
  const counts = new Map<string, number>();
  for (const item of catalog) {
    const id = item.category;
    if (!id || offShelf(item)) continue;
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return categories
    .filter((cat) => cat.id !== "all")
    .map((cat) => ({ ...cat, count: counts.get(cat.id) ?? 0 }))
    .filter((cat) => cat.count > 0)
    .sort(
      (a, b) =>
        b.count - a.count ||
        a.name.localeCompare(b.name, "fa", { numeric: true }),
    );
}

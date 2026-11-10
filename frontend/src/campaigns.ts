import type { Product } from "./data";
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

import type { Order, Product } from "./data";
// Use only the signed-in customer's completed orders. Catalog fields (price,
// inventory and availability) are always current, not historical snapshots.
export function previousPurchases(
  orders: Order[],
  catalog: Product[],
  limit = 8,
): Product[] {
  if (limit < 1) return [];
  const found = new Map<number, Product>();
  const completed = orders
    .filter((o) => o.status === 5)
    .sort(
      (a, b) =>
        (Date.parse(b.createdAt || "") || 0) -
        (Date.parse(a.createdAt || "") || 0),
    );
  for (const order of completed) {
    for (const item of order.items) {
      if (found.has(item.id)) continue;
      const current = catalog.find(
        (p) =>
          p.id === item.id &&
          p.storeId === order.storeId &&
          p.active !== false &&
          Number(p.stock) > 0,
      );
      if (current) found.set(current.id, current);
      if (found.size >= limit) return [...found.values()];
    }
  }
  return [...found.values()];
}

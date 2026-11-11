import { db, mapOrder } from "./db.js";
import { recordOrderEvent } from "./order-workflow.js";

/**
 * Automatic store hand-off for unconfirmed orders.
 *
 * An order placed by a customer (status 1) gives the receiving store ten
 * minutes to confirm it. When the store stays silent, the order moves to
 * another store that carries the same master products — same names, same
 * quantities, and the customer's bill frozen exactly as placed. If the next
 * store also stays silent for ten minutes the cycle repeats, and the customer
 * may cancel or switch stores by hand after twenty minutes.
 */
export const REASSIGN_WAIT_MS = 10 * 60 * 1000;
/** Customers get manual cancel/switch controls twenty minutes in. */
export const CUSTOMER_REASSIGN_AFTER_MS = 20 * 60 * 1000;

const nowIso = () => new Date().toISOString();

const parseItems = (row) =>
  Array.isArray(row.items) ? row.items : JSON.parse(row.items || "[]");

const parseHistory = (row) =>
  Array.isArray(row.reassign_history)
    ? row.reassign_history
    : JSON.parse(row.reassign_history || "[]");

/**
 * Pure policy behind `eligibleStores`: groups the joined listing rows per
 * store, keeps only stores covering every item with enough stock, and prefers
 * stores that have never received this order before. Returns the chosen
 * target with its `listings` map, or null.
 */
export function takeOverTarget(listingRows, items, history = []) {
  const byStore = new Map();
  for (const r of listingRows) {
    const id = Number(r.id);
    if (!byStore.has(id))
      byStore.set(id, { id, name: r.name, listings: new Map() });
    byStore.get(id).listings.set(Number(r.master_product_id), {
      productId: Number(r.product_id),
      stock: Number(r.stock),
    });
  }
  const tried = new Set(
    history.map((h) => Number(h.storeId)).filter(Number.isFinite),
  );
  const fits = [...byStore.values()]
    .filter((store) =>
      items.every((item) => {
        const listing = store.listings.get(Number(item.masterId));
        return listing && listing.stock >= Number(item.qty);
      }),
    )
    .sort((a, b) => Number(tried.has(a.id)) - Number(tried.has(b.id)));
  return fits[0] ?? null;
}

/**
 * Stores that could take this order over: active, open for business, not the
 * store that just ignored it, and holding a sufficiently stocked, active
 * listing of every master product on the order. Stores that never received
 * this order are preferred over ones that already let it time out.
 */
async function eligibleStores(orderRow, items) {
  const masterIds = [...new Set(items.map((item) => Number(item.masterId)))];
  if (!masterIds.length) return null;
  const placeholders = masterIds.map(() => "?").join(",");
  const rows = await db.all(
    `SELECT s.id, s.name, p.master_product_id, p.id AS product_id, p.stock
       FROM stores s JOIN products p ON p.store_id = s.id
      WHERE s.seller_id IS NOT NULL AND s.is_active = 1 AND s.is_open = 1
        AND s.id != ?
        AND p.active = 1
        AND p.master_product_id IN (${placeholders})
        AND p.master_product_id IN (SELECT id FROM master_products WHERE active = 1)`,
    [Number(orderRow.store_id), ...masterIds],
  );
  return takeOverTarget(rows, items, parseHistory(orderRow));
}

/**
 * Moves one unconfirmed order (status 1) to another store. Stock returns to
 * the store that never confirmed and is reserved at the store taking over;
 * prices, quantities and totals never change. Returns the fresh order row, or
 * null when no other store can currently fulfil it (the sweep retries later).
 */
export async function reassignUnconfirmedOrder(orderRow, actor = "system") {
  const target = await eligibleStores(orderRow, parseItems(orderRow));
  if (!target) return null;
  return db.transaction(async (tx) => {
    const current = await tx.get(
      "SELECT * FROM orders WHERE id=? AND status=1 FOR UPDATE",
      [orderRow.id],
    );
    if (!current) return null; // confirmed or cancelled while we picked a store
    const items = parseItems(current);
    for (const item of items)
      await tx.run("UPDATE products SET stock=stock+? WHERE id=?", [
        Number(item.qty),
        Number(item.id),
      ]);
    const newItems = [];
    for (const item of items) {
      const listing = target.listings.get(Number(item.masterId));
      const taken = await tx.run(
        "UPDATE products SET stock=stock-? WHERE id=? AND active=1 AND stock>=?",
        [Number(item.qty), listing.productId, Number(item.qty)],
      );
      if (!taken.affectedRows) {
        const err = new Error("stock changed while reassigning");
        err.code = "reassign_stock_race";
        throw err;
      }
      newItems.push({ ...item, id: listing.productId });
    }
    const at = nowIso();
    const history = [
      ...parseHistory(current),
      {
        storeId: target.id,
        storeName: target.name,
        at,
        by: actor,
      },
    ];
    await tx.run(
      `UPDATE orders SET store_id=?, store_name=?, items=?, reassign_count=reassign_count+1,
         reassign_started_at=?, reassign_history=? WHERE id=? AND status=1`,
      [
        target.id,
        target.name,
        JSON.stringify(newItems),
        at,
        JSON.stringify(history),
        current.id,
      ],
    );
    await recordOrderEvent(tx, current.id, 1, "platform", null);
    return tx.get("SELECT * FROM orders WHERE id=?", [current.id]);
  });
}

/** Serialised as the API returns it; used by the customer-facing endpoint. */
export const reassignResponse = (row) => mapOrder(row);

/**
 * Periodic sweep: every order that has been waiting in status 1 for ten
 * minutes without confirmation is handed to another store. Failures on one
 * order never stop the rest of the run.
 */
export async function reassignSweep() {
  try {
    const cutoff = new Date(Date.now() - REASSIGN_WAIT_MS).toISOString();
    const rows = await db.all(
      "SELECT * FROM orders WHERE status=1 AND COALESCE(reassign_started_at, created_at) < ?",
      [cutoff],
    );
    for (const row of rows) {
      try {
        const moved = await reassignUnconfirmedOrder(row);
        if (moved)
          console.log(
            `[reassign] order ${row.id} → store ${moved.store_id} (${moved.store_name})`,
          );
      } catch (err) {
        if (err?.code !== "reassign_stock_race")
          console.warn(
            "[reassign] order",
            row.id,
            err?.code || err?.message || err,
          );
      }
    }
  } catch (err) {
    console.warn("[reassign] sweep failed", err?.code || err?.message || err);
  }
}

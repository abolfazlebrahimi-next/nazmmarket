import test from "node:test";
import assert from "node:assert/strict";
import {
  takeOverTarget,
  REASSIGN_WAIT_MS,
  CUSTOMER_REASSIGN_AFTER_MS,
} from "../reassign.js";

/* Joined listing rows as `eligibleStores` queries them. */
const rows = (...specs) =>
  specs.map(([id, name, master_product_id, product_id, stock]) => ({
    id,
    name,
    master_product_id,
    product_id,
    stock,
  }));

test("only stores carrying every master item with enough stock may take over", () => {
  const items = [
    { masterId: 10, qty: 2 },
    { masterId: 11, qty: 1 },
  ];
  const target = takeOverTarget(
    rows(
      // store 2 covers both items with enough stock
      [2, "دوم", 10, 200, 5],
      [2, "دوم", 11, 201, 3],
      // store 3 misses master item 11 entirely
      [3, "سوم", 10, 300, 9],
      // store 4 has both, but only 1 of master 10 (needs 2)
      [4, "چهارم", 10, 400, 1],
      [4, "چهارم", 11, 401, 9],
    ),
    items,
  );
  assert.equal(target?.id, 2);
  assert.equal(target.listings.get(10).productId, 200);
  assert.equal(target.listings.get(11).productId, 201);
});

test("no store at all → null, so the sweep simply retries later", () => {
  assert.equal(
    takeOverTarget(
      rows([3, "سوم", 10, 300, 9]),
      [{ masterId: 10, qty: 1 }, { masterId: 11, qty: 1 }],
    ),
    null,
  );
  assert.equal(takeOverTarget([], [{ masterId: 10, qty: 1 }]), null);
});

test("a store that already let the order time out is only used as a last resort", () => {
  const items = [{ masterId: 10, qty: 1 }];
  const listings = rows(
    [2, "دوم", 10, 200, 5],
    [3, "سوم", 10, 300, 5],
    [4, "چهارم", 10, 400, 5],
  );
  // Stores 2 and 3 already received this order; store 4 is the fresh face.
  const first = takeOverTarget(listings, items, [
    { storeId: 2 },
    { storeId: 3 },
  ]);
  assert.equal(first?.id, 4);
  // Once everyone has been tried, any fit may be chosen again.
  const again = takeOverTarget(listings, items, [
    { storeId: 2 },
    { storeId: 3 },
    { storeId: 4 },
  ]);
  assert.ok([2, 3, 4].includes(again?.id));
});

test("the cycle timings follow the spec: ten-minute hops, twenty-minute customer controls", () => {
  assert.equal(REASSIGN_WAIT_MS, 10 * 60 * 1000);
  assert.equal(CUSTOMER_REASSIGN_AFTER_MS, 20 * 60 * 1000);
  assert.ok(CUSTOMER_REASSIGN_AFTER_MS > REASSIGN_WAIT_MS);
});

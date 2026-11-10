import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import ts from "typescript";
// Type-only imports disappear; test the exact production helper without adding
// a test framework or coupling customer recommendations to backend fixtures.
const source = await fs.readFile(
  new URL("../src/personalization.ts", import.meta.url),
  "utf8",
);
const { outputText } = ts.transpileModule(source, {
  compilerOptions: {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ES2022,
  },
});
const { previousPurchases } = await import(
  "data:text/javascript;base64," + Buffer.from(outputText).toString("base64")
);
const catalog = [1, 2, 3, 4, 5].map((id) => ({
  id,
  storeId: 1,
  stock: 10,
  active: true,
  price: 1000,
}));
const order = (id, items, status = 5, createdAt = "2026-01-01") => ({
  id,
  storeId: 1,
  status,
  createdAt,
  items: items.map((id) => ({ id, price: 5, qty: 1 })),
});
test("only previous completed purchases, deduplicated and newest first", () => {
  const result = previousPurchases(
    [
      order("old", [1, 2]),
      order("new", [2, 3], 5, "2026-02-01"),
      order("cancelled", [4], 0),
      order("pending", [5], 3),
    ],
    catalog,
  );
  assert.deepEqual(
    result.map((p) => p.id),
    [2, 3, 1],
  );
  assert.equal(result[0].price, 1000);
});
test("exclude deleted, unavailable and wrong-store products and cap count", () => {
  const current = catalog.map((p) => ({
    ...p,
    ...(p.id === 1
      ? { stock: 0 }
      : p.id === 2
        ? { active: false }
        : p.id === 3
          ? { storeId: 2 }
          : {}),
  }));
  assert.deepEqual(
    previousPurchases([order("test", [1, 2, 3, 4, 5, 99])], current).map(
      (p) => p.id,
    ),
    [4, 5],
  );
  assert.deepEqual(
    previousPurchases([order("test", [4, 5])], current, 1).map((p) => p.id),
    [4],
  );
  assert.deepEqual(previousPurchases([], catalog), []);
  assert.deepEqual(previousPurchases([order("test", [4])], current, 0), []);
});

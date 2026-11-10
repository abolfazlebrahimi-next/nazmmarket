import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import ts from "typescript";
const source = await fs.readFile(
  new URL("../src/campaigns.ts", import.meta.url),
  "utf8",
);
const { outputText } = ts.transpileModule(source, {
  compilerOptions: {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ES2022,
  },
});
const { amazingDeals, energizingDrinks, isWater } = await import(
  "data:text/javascript;base64," + Buffer.from(outputText).toString("base64")
);
const product = (id, name, price, extra = {}) => ({
  id,
  name,
  category: "drinks",
  price,
  stock: 10,
  active: true,
  ...extra,
});
test("amazing deals uses strict real discount above five percent and available stock", () => {
  const products = [
    product(1, "۵٪", 9500, { oldPrice: 10000 }),
    product(2, "بالاتر از ۵٪", 9499, { oldPrice: 10000 }),
    product(3, "تخفیف بیشتر", 8000, { oldPrice: 10000 }),
    product(4, "ناموجود", 1000, { oldPrice: 10000, stock: 0 }),
    product(5, "غیرفعال", 1000, { oldPrice: 10000, active: false }),
    product(6, "قیمت عادی", 1000),
  ];
  assert.deepEqual(
    amazingDeals(products).map((p) => p.id),
    [3, 2],
  );
  assert.equal(products[0].id, 1);
});
test("water variants excluded without excluding juices; available drinks sorted low to high", () => {
  for (const name of [
    "آب",
    "آب معدنی دماوند",
    "آب‌معدنی",
    "بطری آب آشامیدنی",
    "آب گازدار",
    "Mineral Water",
  ])
    assert.equal(isWater(name), true, name);
  for (const name of [
    "آبمیوه پرتقال",
    "آب میوه انار",
    "آب انار",
    "نوشابه",
    "دوغ",
    "نوشیدنی انرژی‌زا",
  ])
    assert.equal(isWater(name), false, name);
  const products = [
    product(1, "آب معدنی", 100),
    product(2, "نوشابه", 500),
    product(3, "آبمیوه", 300),
    product(4, "دوغ", 200),
    product(5, "شیر", 100, { category: "dairy" }),
    product(6, "نوشیدنی ناموجود", 50, { stock: 0 }),
  ];
  assert.deepEqual(
    energizingDrinks(products).map((p) => p.id),
    [4, 3, 2],
  );
});

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import ts from "typescript";

// The code shelf renders whatever the two endpoints give it, so the reader that
// reconciles them is the place a regression would hide.
const source = await fs.readFile(
  new URL("../src/discountCodes.ts", import.meta.url),
  "utf8",
);
const { outputText } = ts.transpileModule(source, {
  compilerOptions: {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ES2022,
  },
});
const { readDiscountCodes, discountValue, discountConditions } = await import(
  "data:text/javascript;base64," + Buffer.from(outputText).toString("base64")
);
const fa = (n) => Number(n).toLocaleString("fa-IR");

test("a public catalog code carries no account knowledge", () => {
  const [row] = readDiscountCodes([
    {
      code: "NAZ20",
      title: "بیست درصد نوشیدنی",
      desc: "روی سبد بالای ۲۰۰ هزار",
      amount: 20,
      kind: "percent",
      storeId: 7,
      storeName: "سوپرمارکت ناز",
    },
  ]);
  assert.equal(row.scope, "store");
  assert.equal(row.used, false);
  assert.equal(row.remaining, null, "no cap must not read as zero left");
  assert.equal(row.storeId, 7);
  assert.equal(discountValue(row, fa), `${fa(20)}٪`);
});

test("an account code keeps its scope, capacity and redemption state", () => {
  const [row] = readDiscountCodes([
    {
      code: "vip10000",
      title: "ده هزار تومان ویژهٔ شما",
      amount: 10000,
      kind: "fixed",
      scope: "platform",
      minSubtotal: 150000,
      maxDiscount: 0,
      maxUses: 0,
      usageCount: 3,
      remaining: null,
      used: 1,
      expiresAt: "2026-11-10T23:59:59.999Z",
    },
  ]);
  assert.equal(row.code, "VIP10000", "codes are shown as they are typed");
  assert.equal(row.scope, "platform");
  assert.equal(row.used, true, "MySQL tinyint counts as used");
  assert.equal(row.maxUses, 0);
  assert.equal(row.usageCount, 3);
  assert.equal(row.remaining, null);
  assert.equal(row.expiresAt, "2026-11-10T23:59:59.999Z");
  assert.deepEqual(discountConditions(row, fa), [
    `حداقل سبد ${fa(150000)}`,
  ]);
});

test("a missing remaining is derived from the cap, an explicit zero is kept", () => {
  const [derived] = readDiscountCodes([
    { code: "CAP10", maxUses: 10, usageCount: 4 },
  ]);
  assert.equal(derived.remaining, 6);
  const [empty] = readDiscountCodes([{ code: "CAP0", maxUses: 10, remaining: 0 }]);
  assert.equal(empty.remaining, 0);
  assert.deepEqual(discountConditions(empty, fa), [`۰ مصرف باقی‌مانده`]);
});

test("used codes sink to the bottom and platform codes lead the rest", () => {
  const rows = readDiscountCodes([
    { code: "STORE-USED", storeName: "ناز", used: true },
    { code: "STORE-FRESH", storeName: "ناز" },
    { code: "PLATFORM-FRESH" },
    { scope: "platform", code: "PLATFORM-USED", used: true },
    { title: "بی‌کد" },
  ]);
  assert.deepEqual(
    rows.map((r) => r.code),
    ["PLATFORM-FRESH", "STORE-FRESH", "PLATFORM-USED", "STORE-USED"],
  );
});

test("junk rows never reach the screen", () => {
  assert.deepEqual(readDiscountCodes([{ title: "بدون کد" }, null, {}]), []);
  assert.deepEqual(readDiscountCodes(undefined), []);
});

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

/**
 * The customer's order view was deliberately shrunk to three steps and plain
 * words, and a store's rejection has to reach them. These checks read the
 * sources because the layout itself needs a browser: what can be pinned down
 * here is which strings and styles exist, so a later edit cannot quietly put
 * paperwork back into the customer's face.
 */
const read = (rel) => fs.readFile(new URL(rel, import.meta.url), "utf8");

/** Comments may name a label precisely to say it is gone; only code counts. */
const code = (src) =>
  src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((line) => !line.trim().startsWith("//"))
    .join("\n");

test("the order row shows three steps and no paperwork", async () => {
  const src = code(await read("../src/pages/Orders.tsx"));
  const steps = src.match(/const statusSteps = \[([\s\S]*?)\];/);
  assert.ok(steps, "statusSteps is gone");
  assert.deepEqual(
    [...steps[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]),
    ["در حال آماده‌سازی", "تحویل به سفیر", "تقدیم به شما شده"],
  );
  for (const hidden of [
    "ثبت سفارش",
    "آماده تحویل",
    "تکمیل سفارش",
    "خرید مجدد",
    "پشتیبانی",
    "مشاهده تاریخچه",
    "کد سفارش",
  ])
    assert.ok(!src.includes(hidden), `left in the customer's view: ${hidden}`);
});

test("the order line says when it was placed, in one sentence", async () => {
  const src = await read("../src/pages/Orders.tsx");
  assert.match(src, /سفارش در ساعت \{o\.time\} ثبت شد/);
  assert.ok(
    !/o\.id\.replace\("NM-"/.test(src),
    "the order id is shown to the customer again",
  );
});

test("a rejected order sends the customer to another store", async () => {
  const card = await read("../src/pages/Orders.tsx");
  assert.match(card, /o\.status === 0 && o\.rejectedBy === "seller"/);
  assert.match(card, /فروشگاه دیگری انتخاب کنید/);
  assert.match(card, /openSub\(\{ name: "stores" \}\)/);
  // …and it interrupts them on the home screen, not only in the history tab.
  const home = await read("../src/pages/Home.tsx");
  assert.match(home, /market-reject-alert/);
  assert.match(home, /rejectedBy === "seller"/);
  assert.match(home, /save\(REJECT_SEEN_KEY, next\)/);
});

test("the surfaces touched this round are styled, not only markup", async () => {
  const css = await read("../src/index.css");
  for (const cls of [
    "cart-sheet",
    "market-cat-grid",
    "market-reject-alert",
    "market-product-saving",
    "screen-heading.no-desktop-heading",
  ])
    assert.ok(css.includes(`.${cls}`), `missing style for .${cls}`);
  const seller = await read("../../seller-frontend/src/style.css");
  for (const cls of ["btn.reject", "reject-form", "reject-reasons", "reject-reason"])
    assert.ok(seller.includes(`.${cls}`), `missing seller style for .${cls}`);
});

test("suggestions live in the phone modal only", async () => {
  const store = await read("../src/pages/Store.tsx");
  assert.match(store, /product-modal-suggestions mt-6 md:hidden/);
  assert.match(store, /Number\(item\.stock\) > 0/);
});

test("a store can reject before hand-over, and the code comes back", async () => {
  const route = await read("../../backend/routes/seller.js");
  const from = route.indexOf('router.post("/orders/:id/reject"');
  assert.ok(from > 0, "no reject route");
  const to = route.indexOf('router.post("/orders/:id/dispatch"', from);
  const body = route.slice(from, to);
  assert.match(body, /status IN \(1,2\)/, "reject is not limited to pre-handover");
  assert.match(body, /rejected_by='seller'/);
  assert.match(body, /recordOrderEvent\(tx, id, 0, "seller", req\.seller\.id\)/);
  assert.match(body, /releasePromo\(tx, id\)/, "the single-use code is not returned");
  assert.match(body, /UPDATE products SET stock=stock\+\?/, "stock is not restored");
  assert.match(body, /"not_rejectable"/);
});

test("the customer list carries the rejection fields", async () => {
  const mapper = await read("../../backend/db.js");
  assert.match(mapper, /rejectedBy: r\.rejected_by \?\? null/);
  assert.match(mapper, /rejectReason: r\.reject_reason \?\? null/);
  assert.match(
    mapper,
    /rejected_by: "VARCHAR\(20\) NULL",\s*\n\s*reject_reason: "VARCHAR\(255\) NULL",/,
    "the columns are not created",
  );
});

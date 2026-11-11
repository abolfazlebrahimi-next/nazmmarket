import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import { firstOffer, sellerPrice } from "../product-rules.js";
import { allowedTransition } from "../order-workflow.js";
import { normalizeImage } from "../images.js";
import {
  secureDocument,
  privateDir,
  readDocument,
} from "../private-documents.js";
const basket = () => [
  { id: 1, category: "drinks", price: 40000, qty: 2 },
  { id: 2, category: "bakery", price: 30000, qty: 2 },
];
/* فروشنده: ۲۵٪ تخفیف، بدون حداقل سبد. */
const offer = { percent: 25, minBasket: 0 };
test("the chosen offer product gets the seller's percent on exactly one unit", () => {
  const items = basket();
  assert.equal(firstOffer(items, 1, false, offer), 10000);
  assert.equal(items[0].discountedQty, 1);
  assert.equal(items[1].unitDiscount, undefined);
  assert.equal(items.reduce((s, i) => s + i.price * i.qty, 0) - 10000, 130000);
});
test("below the seller's minimum basket the deal applies nothing", () => {
  // جمع سبد ۱۴۰٬۰۰۰ است؛ حداقلِ ۱۵۰٬۰۰۰ یعنی تخفیفی در کار نیست.
  assert.equal(
    firstOffer(basket(), 1, false, { percent: 25, minBasket: 150000 }),
    0,
  );
  assert.equal(
    firstOffer(basket(), 1, false, { percent: 25, minBasket: 140000 }),
    10000,
  );
});
test("first offer rejects previous use, including cancelled redemption", () =>
  assert.throws(() => firstOffer(basket(), 1, true, offer), {
    status: 409,
    code: "first_offer_used",
  }));
test("first offer rejects missing item, zero quantity, tampered ID and inactive offers", () => {
  for (const id of [3, NaN, Infinity])
    assert.throws(() => firstOffer(basket(), id, false, offer), { status: 400 });
  assert.throws(
    () => firstOffer([{ ...basket()[0], qty: 0 }], 1, false, offer),
    { status: 400 },
  );
  // کالا باید در فهرستِ فعالِ پیشنهاد باشد؛ نبودِ offer یا درصد غیرمجاز یعنی مردود.
  assert.throws(() => firstOffer(basket(), 1, false, null), { status: 400 });
  assert.throws(() => firstOffer(basket(), 1, false, { percent: 20, minBasket: 0 }), {
    status: 400,
  });
});
test("not selecting an offer gives no discount", () =>
  assert.equal(firstOffer(basket(), null, false, offer), 0));
test("server prices use integer money and enforce maximum allowed discount", () => {
  assert.deepEqual(sellerPrice(100000, 25, 30), {
    price: 75000,
    oldPrice: 100000,
  });
  for (const [price, off] of [
    [NaN, 2],
    [0, 2],
    [-1, 0],
    [1.2, 0],
    [100, 31],
    [100, -1],
    [100, 2.5],
    [Infinity, 0],
  ])
    assert.throws(() => sellerPrice(price, off, 30), { status: 400 });
  assert.equal(sellerPrice(100, 0, 0).oldPrice, null);
});
test("seller can only advance placed → preparing → ready", () => {
  for (let from = 0; from <= 5; from++)
    for (let to = 0; to <= 5; to++)
      assert.equal(
        allowedTransition("seller", from, to),
        (from === 1 && to === 2) || (from === 2 && to === 3),
      );
});
test("courier alone advances ready → shipping → complete", () => {
  for (let from = 0; from <= 5; from++)
    for (let to = 0; to <= 5; to++)
      assert.equal(
        allowedTransition("courier", from, to),
        (from === 3 && to === 4) || (from === 4 && to === 5),
      );
  assert.equal(allowedTransition("admin", 3, 5), false);
});
test("image normalization stores exact square with padding, not cropping", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "naz-image-"));
  try {
    const file = { path: path.join(dir, "image.jpg") };
    await sharp({
      create: { width: 160, height: 80, channels: 3, background: "#ff0000" },
    })
      .png()
      .toFile(file.path);
    await normalizeImage(file, true);
    const meta = await sharp(file.path).metadata();
    assert.equal(meta.width, 1000);
    assert.equal(meta.height, 1000);
    const { data, info } = await sharp(file.path)
      .raw()
      .toBuffer({ resolveWithObject: true });
    assert.ok(
      data[0] > 245 && data[1] > 245 && data[2] > 245,
      "padding stays white",
    );
    const center = (500 * info.width + 500) * info.channels;
    assert.ok(
      data[center] > 240 && data[center + 1] < 20,
      "complete product remains visible",
    );
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});
test("identity documents encrypted at rest, authenticated on read, and key required", async () => {
  process.env.SELLER_PII_KEY = "ab".repeat(32);
  await fs.mkdir(privateDir, { recursive: true });
  const filename = "test-" + Date.now() + ".jpg",
    file = { path: path.join(privateDir, filename) };
  try {
    await sharp({
      create: { width: 50, height: 100, channels: 3, background: "#00aa00" },
    })
      .jpeg()
      .toFile(file.path);
    await secureDocument(file);
    const stored = await fs.readFile(file.path);
    assert.notEqual(stored.subarray(0, 2).toString("hex"), "ffd8");
    const plain = await readDocument(filename);
    assert.equal((await sharp(plain).metadata()).format, "jpeg");
    const bad = Buffer.from(stored);
    bad[bad.length - 1] ^= 1;
    await fs.writeFile(file.path, bad);
    await assert.rejects(readDocument(filename), {
      status: 409,
      code: "document_decryption_failed",
    });
    await fs.writeFile(file.path, stored);
    process.env.SELLER_PII_KEY = "cd".repeat(32);
    await assert.rejects(readDocument(filename), {
      status: 409,
      code: "document_decryption_failed",
    });
    process.env.SELLER_PII_KEY = "ab".repeat(32);
    await fs.writeFile(file.path, Buffer.alloc(5));
    await assert.rejects(readDocument(filename), {
      status: 409,
      code: "document_decryption_failed",
    });
    await assert.rejects(readDocument(filename + "-missing"), {
      status: 404,
      code: "document_missing",
    });
    process.env.SELLER_PII_KEY = "";
    await assert.rejects(readDocument(filename), { status: 503 });
  } finally {
    await fs.unlink(file.path).catch(() => {});
    delete process.env.SELLER_PII_KEY;
  }
});

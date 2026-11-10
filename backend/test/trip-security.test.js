import test from "node:test";
import assert from "node:assert/strict";
import {
  createDeliveryCode,
  readDeliveryCode,
  deliveryCodeMatches,
} from "../trip-security.js";
test("delivery codes are encrypted and authenticated; Persian digits accepted", () => {
  process.env.SELLER_PII_KEY = "ab".repeat(32);
  try {
    const c = createDeliveryCode();
    assert.match(c.code, /^\d{6}$/);
    assert.notEqual(c.code, c.encrypted);
    assert.equal(readDeliveryCode(c.encrypted), c.code);
    assert.equal(deliveryCodeMatches("000000", c.encrypted), false);
    assert.equal(
      deliveryCodeMatches(
        c.code.replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[Number(d)]),
        c.encrypted,
      ),
      true,
    );
    process.env.SELLER_PII_KEY = "cd".repeat(32);
    assert.throws(() => readDeliveryCode(c.encrypted));
  } finally {
    delete process.env.SELLER_PII_KEY;
  }
});

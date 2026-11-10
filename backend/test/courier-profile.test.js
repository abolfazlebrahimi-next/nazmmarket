import test from "node:test";
import assert from "node:assert/strict";
import { validNationalId, validateCourierProfile } from "../courier-profile.js";
import {
  encryptPrivateJSON,
  decryptPrivateJSON,
} from "../private-documents.js";
test("KYC validates national checksum and vehicle/personal fields", () => {
  assert.equal(validNationalId("۱۲۳۴۵۶۷۸۹۱"), true);
  assert.equal(validNationalId("1111111111"), false);
  assert.equal(validNationalId("1234567890"), false);
  const p = {
    nationalId: "1234567891",
    birthDate: "1990-01-01",
    brand: "test",
    model: "125",
    color: "black",
  };
  assert.equal(validateCourierProfile(p).nationalId, p.nationalId);
  for (const body of [
    { ...p, birthDate: "2990-01-01" },
    { ...p, birthDate: "1990-02-31" },
    { ...p, color: "" },
    { ...p, nationalId: "1111111111" },
  ])
    assert.throws(() => validateCourierProfile(body), { status: 400 });
});
test("personal KYC data is encrypted, authenticated and round-trips without plaintext storage", () => {
  process.env.SELLER_PII_KEY = "ab".repeat(32);
  try {
    const p = { nationalId: "1234567891", birthDate: "1990-01-01" };
    const encrypted = encryptPrivateJSON(p);
    assert.equal(encrypted.includes(p.nationalId), false);
    assert.deepEqual(decryptPrivateJSON(encrypted), p);
    process.env.SELLER_PII_KEY = "cd".repeat(32);
    assert.throws(() => decryptPrivateJSON(encrypted));
  } finally {
    delete process.env.SELLER_PII_KEY;
  }
});

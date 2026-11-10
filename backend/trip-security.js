import crypto from "node:crypto";
import { documentKey } from "./private-documents.js";
export function createDeliveryCode() {
  const code = String(crypto.randomInt(100000, 1000000));
  const iv = crypto.randomBytes(12),
    cipher = crypto.createCipheriv("aes-256-gcm", documentKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(code, "utf8"),
    cipher.final(),
  ]);
  return {
    code,
    encrypted: Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString(
      "base64",
    ),
  };
}
export function readDeliveryCode(value) {
  const buffer = Buffer.from(value, "base64");
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    documentKey(),
    buffer.subarray(0, 12),
  );
  decipher.setAuthTag(buffer.subarray(12, 28));
  return Buffer.concat([
    decipher.update(buffer.subarray(28)),
    decipher.final(),
  ]).toString("utf8");
}
export function deliveryCodeMatches(input, encrypted) {
  const code = String(input ?? "").replace(/[۰-۹]/g, (d) =>
    String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)),
  );
  if (!/^\d{6}$/.test(code)) return false;
  return crypto.timingSafeEqual(
    Buffer.from(code),
    Buffer.from(readDeliveryCode(encrypted)),
  );
}

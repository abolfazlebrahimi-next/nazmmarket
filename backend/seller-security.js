import crypto from "node:crypto";

/** Encrypt sensitive seller identity/bank data before storing it in MySQL. */
export function encryptSellerValue(value) {
  const secret = process.env.SELLER_PII_KEY ?? "";
  if (!/^[a-f\d]{64}$/i.test(secret)) {
    const error = new Error("SELLER_PII_KEY تنظیم نشده؛ قبل از ثبت اطلاعات فروشنده یک کلید ۶۴ رقمی hex بسازید.");
    error.code = "seller_encryption_not_configured";
    throw error;
  }
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", Buffer.from(secret, "hex"), iv);
  const encrypted = Buffer.concat([cipher.update(String(value), "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), encrypted].map((part) => part.toString("base64")).join(".");
}

/** Decrypt seller identity/bank data for the owner's own panel. */
export function decryptSellerValue(value) {
  const secret = process.env.SELLER_PII_KEY ?? "";
  const raw = String(value ?? "");
  if (!raw || !/^[a-f\d]{64}$/i.test(secret)) return "";
  try {
    const [iv, tag, data] = raw.split(".").map((part) => Buffer.from(part, "base64"));
    const decipher = crypto.createDecipheriv(
      "aes-256-gcm",
      Buffer.from(secret, "hex"),
      iv,
    );
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
  } catch {
    return "";
  }
}

import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { normalizeImage } from "./images.js";
import { privateDir } from "./storage-paths.js";
export { privateDir } from "./storage-paths.js";
export function documentKey() {
  const key = process.env.SELLER_PII_KEY || "";
  if (!/^[a-f\d]{64}$/i.test(key))
    throw Object.assign(new Error("کلید امنیت مدارک سفیر تنظیم نشده است."), {
      status: 503,
    });
  return Buffer.from(key, "hex");
}
export async function secureDocument(file) {
  await normalizeImage(file);
  const iv = crypto.randomBytes(12),
    cipher = crypto.createCipheriv("aes-256-gcm", documentKey(), iv),
    source = await fs.readFile(file.path);
  const encrypted = Buffer.concat([cipher.update(source), cipher.final()]);
  await fs.writeFile(
    file.path,
    Buffer.concat([iv, cipher.getAuthTag(), encrypted]),
    { mode: 0o600 },
  );
  await fs.chmod(file.path, 0o600);
}
export async function readDocument(filename) {
  const key = documentKey();
  let buffer;
  try {
    buffer = await fs.readFile(path.join(privateDir, path.basename(filename)));
  } catch (error) {
    if (error.code === "ENOENT")
      throw Object.assign(
        new Error(
          "فایل این مدرک روی سرور موجود نیست؛ نسخهٔ پشتیبان فایل‌ها را بازیابی کنید یا درخواست اصلاح مدارک بدهید.",
        ),
        { status: 404, code: "document_missing" },
      );
    throw error;
  }
  try {
    if (buffer.length < 29) throw new Error("Incomplete encrypted document");
    const decipher = crypto.createDecipheriv(
      "aes-256-gcm",
      key,
      buffer.subarray(0, 12),
    );
    decipher.setAuthTag(buffer.subarray(12, 28));
    return Buffer.concat([
      decipher.update(buffer.subarray(28)),
      decipher.final(),
    ]);
  } catch {
    throw Object.assign(
      new Error(
        "رمزگشایی مدرک ممکن نیست؛ کلید امنیتی با زمان ثبت مدرک متفاوت است یا فایل آسیب دیده. کلید قبلی را بازیابی کنید؛ در غیر این صورت درخواست اصلاح مدارک بدهید تا سفیر دوباره ارسال کند.",
      ),
      { status: 409, code: "document_decryption_failed" },
    );
  }
}

export function encryptPrivateJSON(value) {
  const iv = crypto.randomBytes(12),
    cipher = crypto.createCipheriv("aes-256-gcm", documentKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(value), "utf8"),
    cipher.final(),
  ]);
  return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString(
    "base64",
  );
}
export function decryptPrivateJSON(value) {
  const buffer = Buffer.from(value, "base64"),
    decipher = crypto.createDecipheriv(
      "aes-256-gcm",
      documentKey(),
      buffer.subarray(0, 12),
    );
  decipher.setAuthTag(buffer.subarray(12, 28));
  return JSON.parse(
    Buffer.concat([
      decipher.update(buffer.subarray(28)),
      decipher.final(),
    ]).toString("utf8"),
  );
}

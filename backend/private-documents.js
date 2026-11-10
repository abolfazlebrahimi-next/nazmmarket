import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { normalizeImage } from "./images.js";
import { privateDir } from "./storage-paths.js";
export { privateDir } from "./storage-paths.js";
export function documentKey() {
  const key = process.env.SELLER_PII_KEY || "";
  if (!/^[a-f\d]{64}$/i.test(key))
    throw Object.assign(new Error("کلید امنیت مدارک پیک تنظیم نشده است."), {
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
  const buffer = await fs.readFile(
      path.join(privateDir, path.basename(filename)),
    ),
    decipher = crypto.createDecipheriv(
      "aes-256-gcm",
      documentKey(),
      buffer.subarray(0, 12),
    );
  decipher.setAuthTag(buffer.subarray(12, 28));
  return Buffer.concat([
    decipher.update(buffer.subarray(28)),
    decipher.final(),
  ]);
}

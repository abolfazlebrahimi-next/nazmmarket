/**
 * Loads `backend/.env` no matter which directory the process was started from.
 *
 * `import "dotenv/config"` resolves `.env` against `process.cwd()`, so starting
 * the API from the repository root (or from a service manager) silently skipped
 * `backend/.env` and fell back to empty MySQL credentials — which surfaces as
 * `ER_ACCESS_DENIED_ERROR for user 'root'@'localhost' (using password: NO)`.
 * Loading the file relative to this module removes that trap; real environment
 * variables still win over the file (dotenv never overwrites).
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";
import fs from "node:fs";
import dotenv from "dotenv";

const here = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(here, ".env") });

/* کلید رمزنگاری مدارک/اطلاعات هویتی (SELLER_PII_KEY): اگر تنظیم نشده باشد،
   یک کلید تصادفی ساخته و در backend/.env ذخیره می‌شود تا «دریافت بسته»
   (کد تحویل)، ثبت‌نام فروشنده و تسویه بدون خطای ۵۰۰ کار کنند. */
(function ensurePiiKey() {
  const current = process.env.SELLER_PII_KEY || "";
  if (/^[a-f\d]{64}$/i.test(current)) return;
  const generated = crypto.randomBytes(32).toString("hex");
  process.env.SELLER_PII_KEY = generated;
  try {
    const envPath = path.join(here, ".env");
    let text = "";
    try {
      text = fs.readFileSync(envPath, "utf8");
    } catch {
      /* .env هنوز ساخته نشده؛ فقط در حافظه نگه می‌داریم. */
    }
    if (text || fs.existsSync(envPath)) {
      if (/^SELLER_PII_KEY=/m.test(text))
        text = text.replace(
          /^SELLER_PII_KEY=.*$/m,
          `SELLER_PII_KEY=${generated}`,
        );
      else
        text += `${text && !text.endsWith("\n") ? "\n" : ""}SELLER_PII_KEY=${generated}\n`;
      fs.writeFileSync(envPath, text);
      console.log("[env] SELLER_PII_KEY ساخته و در backend/.env ذخیره شد.");
    } else {
      console.warn(
        "[env] SELLER_PII_KEY تنظیم نشده بود؛ یک کلید موقت ساخته شد. برای ماندگاری، آن را در backend/.env ذخیره کنید.",
      );
    }
  } catch (e) {
    console.warn(
      "[env] ذخیرهٔ SELLER_PII_KEY در .env ممکن نشد؛ تا ری‌استارت بعدی معتبر است.",
      e?.message,
    );
  }
})();

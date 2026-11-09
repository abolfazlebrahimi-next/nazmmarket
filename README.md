# ناز مارکت

فروشگاه مشتری ناز مارکت با React/Vite و API مبتنی بر Node.js، Express و MySQL.

## اجرای محلی در Windows

1. MySQL Server را نصب و اجرا کنید و یک‌بار دیتابیس را بسازید:

   ```sql
   CREATE DATABASE nazmarket CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   ```

2. در PowerShell، از پوشه پروژه:

   ```powershell
   Copy-Item .env.example .env
   npm install
   ```

3. مقادیر `MYSQL_HOST`, `MYSQL_PORT`, `MYSQL_DATABASE`, `MYSQL_USER` و `MYSQL_PASSWORD` را در `.env` مطابق نصب خود تنظیم کنید.
4. اجرای توسعه (API و وب):

   ```powershell
   npm run dev
   ```

   یا فقط API را اجرا کنید: `npm run dev:api` (پورت پیش‌فرض ۴۰۰۰).

در اولین اجرا، API جداول را ایجاد می‌کند، کالاها/فروشگاه‌های نمونه را از `shared/catalog.json` وارد می‌کند و حساب آزمایشی را می‌سازد. حساب پیش‌فرض از `DEMO_PHONE` و `DEMO_PASSWORD` در `.env` خوانده می‌شود. پیش از انتشار عمومی، رمز آزمایشی را عوض کنید.

برای بررسی ایستا و ساخت نسخه وب: `npm run typecheck` و `npm run build`.

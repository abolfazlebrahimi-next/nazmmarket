# ناز مارکت

پروژه سه برنامهٔ مستقل دارد:

```text
nazmmarket/
├── backend/          # Node.js + Express + MySQL API
├── frontend/         # فروشگاه مشتری (React + Vite)
├── seller-frontend/  # پنل فروشنده (React + Vite)
└── README.md
```

فروشگاه‌ها و کالاهای نمایشیِ قدیمی در مسیر عمومی به‌عنوان دادهٔ واقعی ارائه نمی‌شوند. کاتالوگ عمومی از فروشگاه‌ها و کالاهایی ساخته می‌شود که فروشنده واقعاً ثبت کرده و فعال‌اند. عکس فروشگاه و کالا باید توسط فروشنده بارگذاری شود.

## پیش‌نیازها

- Node.js 22.5 یا جدیدتر
- MySQL 8+
- ایجاد دیتابیس (اگر از قبل وجود دارد دوباره نسازید):

```sql
CREATE DATABASE nazmarket CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

## پیکربندی بک‌اند

از ریشهٔ پروژه در PowerShell:

```powershell
Copy-Item backend/.env.example backend/.env
```

مقادیر `MYSQL_HOST`، `MYSQL_PORT`، `MYSQL_DATABASE`، `MYSQL_USER` و `MYSQL_PASSWORD` را در `backend/.env` با تنظیمات MySQL خود جایگزین کنید.

برای رمزگذاری کد ملی و شبا، یک کلید تصادفی ۳۲ بایتی بسازید:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

خروجی را در `SELLER_PII_KEY` داخل `backend/.env` قرار دهید. این کلید باید محرمانه، خارج از Git و در تمام دفعات اجرای همان محیط ثابت بماند؛ گم‌کردن یا تغییر آن، رمزگشایی اطلاعات هویتی ذخیره‌شده را ناممکن می‌کند. فایل واقعی `.env` و پوشهٔ عکس‌های `backend/uploads/` نباید commit شوند.

## اجرای بک‌اند

در ترمینال اول:

```powershell
cd backend
npm install
npm run dev
```

API روی پورت `4000` اجرا می‌شود. در شروع، migrationهای سازگار با داده‌های قبلی انجام می‌شود؛ دادهٔ نمونه به‌عنوان فروشگاه/کالای فعال seed نمی‌شود.

## اجرای فروشگاه مشتری

در ترمینال دوم، از ریشهٔ پروژه:

```powershell
cd frontend
npm install
npm run dev
```

Vite به‌طور پیش‌فرض روی پورت `5173` اجرا می‌شود و `/api` را از طریق proxy به بک‌اند می‌فرستد. برای API دیگری، متغیر `API_PROXY_TARGET` را پیش از اجرای Vite تنظیم کنید.

## اجرای پنل فروشنده

در ترمینال سوم، از ریشهٔ پروژه:

```powershell
cd seller-frontend
npm install
npm run dev
```

پنل فروشندگان مستقل و به‌طور پیش‌فرض روی پورت `5174` اجرا می‌شود؛ `/api/seller` از همان proxy به بک‌اند وصل می‌شود. فروشنده با موبایل و رمز عبور وارد می‌شود (بدون OTP/SMS)، و ثبت‌نام فروشگاه به عکس واقعی، اطلاعات لازم و تنظیم `SELLER_PII_KEY` نیاز دارد.

## بررسی ساخت

```powershell
cd backend
# در Node.js از بررسی syntax استفاده کنید:
Get-ChildItem *.js, routes/*.js | ForEach-Object { node --check $_.FullName }

cd ../frontend
npm run typecheck
npm run build

cd ../seller-frontend
npm run build
```

## محدودهٔ فعلی

- ثبت‌نام و ورود فروشنده، فروشگاه/کالا/تخفیف و مشاهده و تغییر وضعیت سفارش به API و MySQL متصل شده‌اند.
- مشتری برای ثبت سفارش باید وارد حساب باشد؛ سفارش و کسر موجودی در تراکنش MySQL انجام می‌شود. پرداخت فعلاً در محل ثبت می‌شود و وضعیت آن «پرداخت‌نشده» می‌ماند تا پرداخت واقعی انجام شود.
- درگاه پرداخت آنلاین، پنل پیک، اعزام و رهگیری پیک هنوز پیاده‌سازی نشده‌اند؛ ثبت سفارش به معنی پرداخت یا ارسال قطعی نیست.
- برای استفادهٔ واقعی، بک‌اند را با `.env` معتبر و MySQL قابل‌دسترسی اجرا کنید. بدون اتصال MySQL، ثبت‌نام، کاتالوگ و سفارش از API موفق نخواهند شد.

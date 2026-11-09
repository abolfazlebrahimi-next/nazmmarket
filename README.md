# ناز مارکت

ساختار پروژه به دو برنامهٔ مستقل تقسیم شده است:

```text
nazmmarket/
├── backend/    # Node.js + Express + MySQL
├── frontend/   # React + Vite
└── README.md
```

هر بخش وابستگی‌ها و دستور اجرای مستقل دارد. برای کار روزانه، دو پنجرهٔ ترمینال باز کنید و در هرکدام وارد فولدر مربوطه شوید.

## ۱) آماده‌سازی MySQL

MySQL Server را نصب و اجرا کنید و دیتابیس را یک بار بسازید:

```sql
CREATE DATABASE nazmarket CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

در PowerShell از ریشهٔ پروژه:

```powershell
Copy-Item backend/.env.example backend/.env
```

مقادیر اتصال MySQL را در `backend/.env` وارد کنید.

## ۲) اجرای بک‌اند

در ترمینال اول:

```powershell
cd backend
npm install
npm run dev
```

API روی `http://localhost:4000` اجرا می‌شود. اولین اجرا جداول را ایجاد می‌کند، کالاها/فروشگاه‌های نمونه را از `backend/shared/catalog.json` وارد می‌کند و حساب آزمایشی را می‌سازد.

## ۳) اجرای فرانت‌اند

در ترمینال دوم، از ریشهٔ پروژه:

```powershell
cd frontend
npm install
npm run dev
```

آدرس توسعهٔ Vite در ترمینال نمایش داده می‌شود (پیش‌فرض `http://localhost:5173`). درخواست‌های `/api` از طریق proxy به بک‌اند روی پورت ۴۰۰۰ می‌روند. برای آدرس API متفاوت، متغیر `API_PROXY_TARGET` را هنگام اجرای Vite تنظیم کنید.

## ساخت و بررسی

از فولدر `frontend`:

```powershell
npm run typecheck
npm run build
```

برای اجرای نسخهٔ ساخته‌شده با Vite: `npm run preview` در فولدر `frontend`.

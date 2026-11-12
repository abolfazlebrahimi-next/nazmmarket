/**
 * ناز مارکت — Node.js backend (Express + MySQL).
 *
 *   npm run dev         →  http://localhost:4000 (run inside backend/)
 */
import "dotenv/config";
import "express-async-errors";
import express from "express";
import { logApiError } from "./error-diagnostics.js";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { db } from "./db.js";
import { PORT } from "./config.js";
import authRoutes from "./routes/auth.js";
import catalogRoutes from "./routes/catalog.js";
import meRoutes from "./routes/me.js";
import orderRoutes from "./routes/orders.js";
import promoRoutes from "./routes/promos.js";
import sellerRoutes from "./routes/seller.js";
import courierRoutes from "./routes/courier.js";

import adminRoutes from "./routes/admin.js";

const app = express();
app.disable("x-powered-by");
app.use((_req, res, next) => {
  res.set("X-Content-Type-Options", "nosniff");
  next();
});
app.use("/api/admin", (_req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});
app.use(express.json({ limit: "256kb" }));

/* permissive CORS: the browser talks to the API through the Vite proxy, but a
   separate mobile/native client may hit the API directly. */
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", req.headers.origin ?? "*");
  res.header("Vary", "Origin");
  res.header(
    "Access-Control-Allow-Methods",
    "GET,POST,PUT,PATCH,DELETE,OPTIONS",
  );
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

app.get("/api/health", async (_req, res) => {
  await db.get("SELECT 1 AS ok");
  res.set("Cache-Control", "no-store");
  res.json({
    ok: true,
    apiRevision: "seller-dispatch-v2",
    capabilities: { sellerDispatch: true, sellerSelfDelivery: true },
    time: new Date().toISOString(),
  });
});

const __dirname = path.dirname(fileURLToPath(import.meta.url));
app.use(
  "/api/uploads",
  express.static(path.join(__dirname, "uploads"), {
    maxAge: "1d",
    fallthrough: false,
  }),
);
app.use("/api/admin", adminRoutes);
app.use("/api/seller", sellerRoutes);
app.use("/api/courier", courierRoutes);
app.use("/api/auth", authRoutes);
app.use("/api", catalogRoutes);
app.use("/api/me", meRoutes);
/* Before the "/api" catch-all routers: mounted after them, every
   /api/promos request is answered by whichever guard runs first. */
app.use("/api/promos", promoRoutes);
app.use("/api", orderRoutes);

app.use("/api", (_req, res) => {
  res.status(404).json({
    error: { code: "not_found", message: "این مسیر در API وجود ندارد." },
  });
});

/* error handler — always answers with a Farsi message the UI can show */
app.use((err, _req, res, _next) => {
  const requestId =
    !err.status || err.status >= 500 ? logApiError(err) : undefined;
  if (err?.code === "LIMIT_FILE_SIZE") {
    return res.status(413).json({
      error: {
        code: "file_too_large",
        message: "حجم هر تصویر حداکثر ۵ مگابایت است.",
      },
    });
  }
  if (err?.type === "entity.parse.failed") {
    return res.status(400).json({
      error: { code: "bad_json", message: "داده ارسالی معتبر نیست." },
    });
  }
  if (err?.code?.startsWith("LIMIT_"))
    return res.status(400).json({
      error: {
        code: err.code,
        message: "فایل‌ها یا تعداد مدارک ارسالی معتبر نیست.",
      },
    });
  if (err?.status && err.status >= 400 && err.status < 500)
    return res.status(err.status).json({
      error: { code: err.code || "invalid_request", message: err.message },
    });
  /* خطاهای عمدی با status (مثل 503 کلید امنیتی) پیام واقعی خود را نشان دهند. */
  if (err?.status && err.status >= 500 && err.status < 600 && err.message)
    return res.status(err.status).json({
      error: { code: err.code || "server_error", message: err.message },
    });
  res.status(500).json({
    error: {
      code: "server_error",
      requestId,
      message: "خطای غیرمنتظره در سرور؛ دوباره تلاش کنید.",
    },
  });
});

export default app;

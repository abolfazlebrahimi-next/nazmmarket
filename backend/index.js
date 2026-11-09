/**
 * ناز مارکت — Node.js backend (Express + MySQL).
 *
 *   npm run dev         →  http://localhost:4000 (run inside backend/)
 */
import "dotenv/config";
import "express-async-errors";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { db, migrate } from "./db.js";
import { PORT } from "./config.js";
import authRoutes from "./routes/auth.js";
import catalogRoutes from "./routes/catalog.js";
import meRoutes from "./routes/me.js";
import orderRoutes from "./routes/orders.js";
import promoRoutes from "./routes/promos.js";
import sellerRoutes from "./routes/seller.js";
import courierRoutes from "./routes/courier.js";

const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "256kb" }));

/* permissive CORS: the browser talks to the API through the Vite proxy, but a
   separate mobile/native client may hit the API directly. */
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", req.headers.origin ?? "*");
  res.header("Vary", "Origin");
  res.header("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

app.get("/api/health", async (_req, res) => {
  const [users, products, stores, orders] = await Promise.all([
    db.get("SELECT COUNT(*) AS n FROM users"),
    db.get("SELECT COUNT(*) AS n FROM products WHERE seller_id IS NOT NULL AND active = 1"),
    db.get("SELECT COUNT(*) AS n FROM stores WHERE seller_id IS NOT NULL AND is_active = 1"),
    db.get("SELECT COUNT(*) AS n FROM orders"),
  ]);
  res.json({ ok: true, users: Number(users.n), products: Number(products.n), stores: Number(stores.n), orders: Number(orders.n), time: new Date().toISOString() });
});

const __dirname = path.dirname(fileURLToPath(import.meta.url));
app.use("/api/uploads", express.static(path.join(__dirname, "uploads"), { maxAge: "1d", fallthrough: false }));
app.use("/api/seller", sellerRoutes);
app.use("/api/courier", courierRoutes);
app.use("/api/auth", authRoutes);
app.use("/api", catalogRoutes);
app.use("/api/me", meRoutes);
app.use("/api", orderRoutes);
app.use("/api/promos", promoRoutes);

app.use("/api", (_req, res) => {
  res.status(404).json({ error: { code: "not_found", message: "این مسیر در API وجود ندارد." } });
});

/* error handler — always answers with a Farsi message the UI can show */
app.use((err, _req, res, _next) => {
  console.error("[api]", err);
  if (err?.code === "LIMIT_FILE_SIZE") {
    return res.status(413).json({ error: { code: "file_too_large", message: "حجم هر تصویر حداکثر ۵ مگابایت است." } });
  }
  if (err?.type === "entity.parse.failed") {
    return res.status(400).json({ error: { code: "bad_json", message: "داده ارسالی معتبر نیست." } });
  }
  res.status(500).json({ error: { code: "server_error", message: "خطای غیرمنتظره در سرور؛ دوباره تلاش کنید." } });
});

async function start() {
  try {
    await migrate();
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`\n  ✅ ناز مارکت API روی http://localhost:${PORT} آماده است\n`);
    });
  } catch (error) {
    console.error("[api] MySQL startup failed:", error);
    process.exitCode = 1;
  }
}
start();

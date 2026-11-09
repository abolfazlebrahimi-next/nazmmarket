/**
 * ناز مارکت — Node.js backend (Express + SQLite).
 *
 *   npm run dev:api     →  http://localhost:4000
 *   npm run dev         →  Vite on :5173 with /api proxied to this server
 *   npm start           →  serves the built SPA from ./dist + the API
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import { db, migrate, seed } from "./db.js";
import { hashPassword } from "./auth.js";
import { PORT, DEMO_ACCOUNT } from "./config.js";
import authRoutes from "./routes/auth.js";
import catalogRoutes from "./routes/catalog.js";
import meRoutes from "./routes/me.js";
import orderRoutes from "./routes/orders.js";
import promoRoutes from "./routes/promos.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(__dirname, "..", "dist");

migrate();
seed();
seedDemoAccount();

function seedDemoAccount() {
  const exists = db.prepare("SELECT id FROM users WHERE phone = ?").get(DEMO_ACCOUNT.phone);
  if (exists) return;
  const info = db
    .prepare(
      `INSERT INTO users (phone, password_hash, first_name, last_name, wallet, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(
      DEMO_ACCOUNT.phone,
      hashPassword(DEMO_ACCOUNT.password),
      DEMO_ACCOUNT.firstName,
      DEMO_ACCOUNT.lastName,
      250000,
      new Date().toISOString(),
    );
  db.prepare(
    `INSERT INTO addresses (user_id, title, address, detail, phone, type)
     VALUES (?, 'خانه', 'نظرآباد، میرزا کوچک‌خان شمالی', 'کوچه ۱', '09935377426', 'home')`,
  ).run(Number(info.lastInsertRowid));
}

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

app.get("/api/health", (_req, res) => {
  const users = db.prepare("SELECT COUNT(*) AS n FROM users").get();
  const products = db.prepare("SELECT COUNT(*) AS n FROM products").get();
  res.json({ ok: true, users: users.n, products: products.n, time: new Date().toISOString() });
});

app.use("/api/auth", authRoutes);
app.use("/api", catalogRoutes);
app.use("/api/me", meRoutes);
app.use("/api", orderRoutes);
app.use("/api/promos", promoRoutes);

app.use("/api", (_req, res) => {
  res.status(404).json({ error: { code: "not_found", message: "این مسیر در API وجود ندارد." } });
});

/* production: serve the built single-file SPA */
if (fs.existsSync(path.join(DIST, "index.html"))) {
  app.use(express.static(DIST, { index: false, maxAge: "1h" }));
  app.get("*", (_req, res) => res.sendFile(path.join(DIST, "index.html")));
}

/* error handler — always answers with a Farsi message the UI can show */
app.use((err, _req, res, _next) => {
  console.error("[api]", err);
  if (err?.type === "entity.parse.failed") {
    return res.status(400).json({ error: { code: "bad_json", message: "داده ارسالی معتبر نیست." } });
  }
  res.status(500).json({ error: { code: "server_error", message: "خطای غیرمنتظره در سرور؛ دوباره تلاش کنید." } });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`\n  ✅ ناز مارکت API روی http://localhost:${PORT} آماده است`);
  console.log(`  👤 حساب آزمایشی: ${DEMO_ACCOUNT.phone} / ${DEMO_ACCOUNT.password}\n`);
});

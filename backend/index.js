/**
 * ناز مارکت — Node.js backend (Express + MySQL).
 *
 *   npm run dev         →  http://localhost:4000 (run inside backend/)
 */
import "dotenv/config";
import "express-async-errors";
import express from "express";
import { db, migrate, seed } from "./db.js";
import { hashPassword } from "./auth.js";
import { PORT, DEMO_ACCOUNT } from "./config.js";
import authRoutes from "./routes/auth.js";
import catalogRoutes from "./routes/catalog.js";
import meRoutes from "./routes/me.js";
import orderRoutes from "./routes/orders.js";
import promoRoutes from "./routes/promos.js";

async function seedDemoAccount() {
  const exists = await db.get("SELECT id FROM users WHERE phone = ?", [DEMO_ACCOUNT.phone]);
  if (exists) return;
  const result = await db.run(
    `INSERT INTO users (phone, password_hash, first_name, last_name, wallet, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [DEMO_ACCOUNT.phone, hashPassword(DEMO_ACCOUNT.password), DEMO_ACCOUNT.firstName, DEMO_ACCOUNT.lastName, 250000, new Date().toISOString()],
  );
  await db.run(
    `INSERT INTO addresses (user_id, title, address, detail, phone, type)
     VALUES (?, 'خانه', 'نظرآباد، میرزا کوچک‌خان شمالی', 'کوچه ۱', '09935377426', 'home')`,
    [Number(result.insertId)],
  );
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

app.get("/api/health", async (_req, res) => {
  const [users, products] = await Promise.all([db.get("SELECT COUNT(*) AS n FROM users"), db.get("SELECT COUNT(*) AS n FROM products")]);
  res.json({ ok: true, users: Number(users.n), products: Number(products.n), time: new Date().toISOString() });
});

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
  if (err?.type === "entity.parse.failed") {
    return res.status(400).json({ error: { code: "bad_json", message: "داده ارسالی معتبر نیست." } });
  }
  res.status(500).json({ error: { code: "server_error", message: "خطای غیرمنتظره در سرور؛ دوباره تلاش کنید." } });
});

async function start() {
  try {
    await migrate();
    await seed();
    await seedDemoAccount();
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`\n  ✅ ناز مارکت API روی http://localhost:${PORT} آماده است`);
      console.log(`  👤 حساب آزمایشی: ${DEMO_ACCOUNT.phone} / ${DEMO_ACCOUNT.password}\n`);
    });
  } catch (error) {
    console.error("[api] MySQL startup failed:", error);
    process.exitCode = 1;
  }
}
start();

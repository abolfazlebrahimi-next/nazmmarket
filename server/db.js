/**
 * SQLite database for nazmarket (Node.js built-in `node:sqlite`, no native deps).
 *
 * Accounts are intentionally simple, exactly as requested:
 *   phone number  →  username
 *   password      →  password (scrypt hash, never stored in plain text)
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.NAZ_DATA_DIR ?? path.join(__dirname, "data");
const DB_FILE = path.join(DATA_DIR, "nazmarket.db");

let DatabaseSync;
try {
  ({ DatabaseSync } = await import("node:sqlite"));
} catch {
  console.error(
    "\n[ناز مارکت] اجرای بک‌اند به Node.js نسخه ۲۲.۵ یا بالاتر نیاز دارد " +
      "(ماژول داخلی node:sqlite).\nنسخه فعلی: " +
      process.version +
      "\nلطفاً Node.js را به‌روزرسانی کنید.\n",
  );
  process.exit(1);
}

fs.mkdirSync(DATA_DIR, { recursive: true });

export const db = new DatabaseSync(DB_FILE);
db.exec("PRAGMA journal_mode = WAL;");
db.exec("PRAGMA foreign_keys = ON;");

const catalog = JSON.parse(
  fs.readFileSync(path.join(__dirname, "..", "shared", "catalog.json"), "utf8"),
);

/** Creates every table the customer side of the shop needs. */
export function migrate() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      phone         TEXT    NOT NULL UNIQUE,   -- phone number = username
      password_hash TEXT    NOT NULL,          -- scrypt hash of the password
      first_name    TEXT    NOT NULL DEFAULT '',
      last_name     TEXT    NOT NULL DEFAULT '',
      wallet        INTEGER NOT NULL DEFAULT 0,
      pro           INTEGER NOT NULL DEFAULT 0,
      created_at    TEXT    NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token      TEXT PRIMARY KEY,
      user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS addresses (
      id      INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title   TEXT NOT NULL,
      address TEXT NOT NULL,
      detail  TEXT NOT NULL DEFAULT '',
      phone   TEXT NOT NULL DEFAULT '',
      type    TEXT NOT NULL DEFAULT 'home',
      lat     REAL,
      lng     REAL
    );

    CREATE TABLE IF NOT EXISTS favorites (
      user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      product_id INTEGER NOT NULL,
      PRIMARY KEY (user_id, product_id)
    );

    CREATE TABLE IF NOT EXISTS carts (
      user_id    INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      store_id   INTEGER,
      items      TEXT NOT NULL DEFAULT '{}',
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS orders (
      id            TEXT PRIMARY KEY,
      user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      store_id      INTEGER,
      store_name    TEXT NOT NULL,
      items         TEXT NOT NULL,
      subtotal      INTEGER NOT NULL,
      discount      INTEGER NOT NULL DEFAULT 0,
      delivery      INTEGER NOT NULL DEFAULT 0,
      total         INTEGER NOT NULL,
      address_title TEXT NOT NULL DEFAULT '',
      address_text  TEXT NOT NULL DEFAULT '',
      slot          TEXT NOT NULL DEFAULT 'ارسال فوری',
      payment       TEXT NOT NULL DEFAULT 'online',
      promo_code    TEXT,
      status        INTEGER NOT NULL DEFAULT 1,
      time          TEXT NOT NULL,
      created_at    TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS products (
      id        INTEGER PRIMARY KEY,
      name      TEXT NOT NULL,
      category  TEXT NOT NULL,
      price     INTEGER NOT NULL,
      old_price INTEGER,
      unit      TEXT NOT NULL DEFAULT '',
      icon      TEXT NOT NULL DEFAULT 'Package',
      bg        TEXT NOT NULL DEFAULT '',
      icon_color TEXT NOT NULL DEFAULT '',
      tag       TEXT,
      frequent  INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS stores (
      id         INTEGER PRIMARY KEY,
      name       TEXT NOT NULL,
      type       TEXT NOT NULL DEFAULT 'supermarket',
      pro        INTEGER NOT NULL DEFAULT 0,
      is_new     INTEGER NOT NULL DEFAULT 0,
      rating     REAL,
      minutes    INTEGER NOT NULL DEFAULT 45,
      fee        INTEGER NOT NULL DEFAULT 35000,
      area       TEXT NOT NULL DEFAULT '',
      tags       TEXT NOT NULL DEFAULT '[]',
      off_text   TEXT,
      gradient   TEXT NOT NULL DEFAULT '',
      initial    TEXT NOT NULL DEFAULT '',
      min_basket INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS promos (
      code         TEXT PRIMARY KEY,
      title        TEXT NOT NULL,
      description  TEXT NOT NULL DEFAULT '',
      kind         TEXT NOT NULL DEFAULT 'fixed',
      amount       INTEGER NOT NULL DEFAULT 0,
      min_subtotal INTEGER NOT NULL DEFAULT 0,
      max_discount INTEGER NOT NULL DEFAULT 0,
      active       INTEGER NOT NULL DEFAULT 1
    );

    CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_addresses_user ON addresses(user_id);
  `);
}

/** Seeds catalog data (products / stores / promo codes) from shared/catalog.json. */
export function seed() {
  const product = db.prepare(`
    INSERT INTO products (id, name, category, price, old_price, unit, icon, bg, icon_color, tag, frequent, sort_order)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name, category = excluded.category, price = excluded.price,
      old_price = excluded.old_price, unit = excluded.unit, icon = excluded.icon,
      bg = excluded.bg, icon_color = excluded.icon_color, tag = excluded.tag,
      frequent = excluded.frequent, sort_order = excluded.sort_order
  `);
  catalog.products.forEach((p, i) => {
    product.run(
      p.id, p.name, p.category, p.price, p.oldPrice ?? null, p.unit ?? "", p.icon ?? "Package",
      p.bg ?? "", p.iconColor ?? "", p.tag ?? null, p.frequent ? 1 : 0, i,
    );
  });

  const store = db.prepare(`
    INSERT INTO stores (id, name, type, pro, is_new, rating, minutes, fee, area, tags, off_text, gradient, initial, min_basket)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name, type = excluded.type, pro = excluded.pro, is_new = excluded.is_new,
      rating = excluded.rating, minutes = excluded.minutes, fee = excluded.fee, area = excluded.area,
      tags = excluded.tags, off_text = excluded.off_text, gradient = excluded.gradient,
      initial = excluded.initial, min_basket = excluded.min_basket
  `);
  catalog.stores.forEach((s) => {
    store.run(
      s.id, s.name, s.type, s.pro ? 1 : 0, s.isNew ? 1 : 0, s.rating ?? null, s.minutes, s.fee,
      s.area, JSON.stringify(s.tags ?? []), s.offText ?? null, s.gradient, s.initial, s.minBasket ?? 0,
    );
  });

  const promo = db.prepare(`
    INSERT INTO promos (code, title, description, kind, amount, min_subtotal, max_discount)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(code) DO UPDATE SET
      title = excluded.title, description = excluded.description, kind = excluded.kind,
      amount = excluded.amount, min_subtotal = excluded.min_subtotal, max_discount = excluded.max_discount
  `);
  catalog.promos.forEach((p) => {
    promo.run(p.code, p.title, p.desc ?? "", p.kind, p.amount, p.minSubtotal ?? 0, p.maxDiscount ?? 0);
  });
}

/* ------------------------------------------------------------------ */
/* row → API shape mappers                                            */
/* ------------------------------------------------------------------ */

export const mapProduct = (r) => ({
  id: r.id,
  name: r.name,
  category: r.category,
  price: r.price,
  ...(r.old_price != null ? { oldPrice: r.old_price } : {}),
  unit: r.unit,
  icon: r.icon,
  bg: r.bg,
  iconColor: r.icon_color,
  ...(r.tag ? { tag: r.tag } : {}),
  ...(r.frequent ? { frequent: true } : {}),
});

export const mapStore = (r) => ({
  id: r.id,
  name: r.name,
  type: r.type,
  ...(r.pro ? { pro: true } : {}),
  ...(r.is_new ? { isNew: true } : {}),
  ...(r.rating != null ? { rating: r.rating } : {}),
  minutes: r.minutes,
  fee: r.fee,
  area: r.area,
  tags: JSON.parse(r.tags || "[]"),
  ...(r.off_text ? { offText: r.off_text } : {}),
  gradient: r.gradient,
  initial: r.initial,
  minBasket: r.min_basket,
});

export const mapPromo = (r) => ({
  code: r.code,
  title: r.title,
  desc: r.description,
  amount: r.amount,
  kind: r.kind,
  minSubtotal: r.min_subtotal,
  maxDiscount: r.max_discount,
});

export const mapUser = (r) => ({
  id: r.id,
  phone: r.phone,
  firstName: r.first_name,
  lastName: r.last_name,
  wallet: r.wallet,
  pro: Boolean(r.pro),
  createdAt: r.created_at,
});

export const mapAddress = (r) => ({
  id: r.id,
  title: r.title,
  address: r.address,
  detail: r.detail,
  phone: r.phone,
  type: r.type,
  ...(r.lat != null ? { lat: r.lat, lng: r.lng } : {}),
});

export const mapOrder = (r) => ({
  id: r.id,
  storeId: r.store_id,
  storeName: r.store_name,
  items: JSON.parse(r.items),
  subtotal: r.subtotal,
  discount: r.discount,
  delivery: r.delivery,
  total: r.total,
  addressTitle: r.address_title,
  slot: r.slot,
  payment: r.payment,
  promoCode: r.promo_code,
  status: r.status,
  time: r.time,
  createdAt: r.created_at,
});

export { catalog, DB_FILE };

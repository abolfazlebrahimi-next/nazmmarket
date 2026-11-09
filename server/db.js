/**
 * MySQL persistence for the customer storefront.
 * Configure MYSQL_HOST, MYSQL_PORT, MYSQL_DATABASE, MYSQL_USER and
 * MYSQL_PASSWORD in the environment (see .env.example).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mysql from "mysql2/promise";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const catalog = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "shared", "catalog.json"), "utf8"));

export const pool = mysql.createPool({
  host: process.env.MYSQL_HOST ?? "127.0.0.1",
  port: Number(process.env.MYSQL_PORT ?? 3306),
  database: process.env.MYSQL_DATABASE ?? "nazmarket",
  user: process.env.MYSQL_USER ?? "root",
  password: process.env.MYSQL_PASSWORD ?? "",
  waitForConnections: true,
  connectionLimit: Number(process.env.MYSQL_CONNECTION_LIMIT ?? 10),
  queueLimit: 0,
  charset: "utf8mb4",
  dateStrings: true,
});

/** A small promise-based query API shared by routes and auth helpers. */
export const db = {
  async all(sql, values = []) {
    const [rows] = await pool.execute(sql, values);
    return rows;
  },
  async get(sql, values = []) {
    const rows = await this.all(sql, values);
    return rows[0] ?? null;
  },
  async run(sql, values = []) {
    const [result] = await pool.execute(sql, values);
    return result;
  },
  async transaction(work) {
    const connection = await pool.getConnection();
    const tx = {
      all: async (sql, values = []) => (await connection.execute(sql, values))[0],
      get: async (sql, values = []) => {
        const [rows] = await connection.execute(sql, values);
        return rows[0] ?? null;
      },
      run: async (sql, values = []) => (await connection.execute(sql, values))[0],
    };
    try {
      await connection.beginTransaction();
      const result = await work(tx);
      await connection.commit();
      return result;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  },
};

/** Creates the customer-side schema. Product/catalog records are seeded below. */
export async function migrate() {
  const schema = [
    `CREATE TABLE IF NOT EXISTS users (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      phone VARCHAR(20) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      first_name VARCHAR(80) NOT NULL DEFAULT '',
      last_name VARCHAR(80) NOT NULL DEFAULT '',
      wallet BIGINT NOT NULL DEFAULT 0,
      pro TINYINT(1) NOT NULL DEFAULT 0,
      created_at VARCHAR(32) NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    `CREATE TABLE IF NOT EXISTS sessions (
      token CHAR(64) NOT NULL PRIMARY KEY,
      user_id BIGINT UNSIGNED NOT NULL,
      created_at VARCHAR(32) NOT NULL,
      KEY idx_sessions_user (user_id),
      CONSTRAINT fk_sessions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    `CREATE TABLE IF NOT EXISTS addresses (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      user_id BIGINT UNSIGNED NOT NULL,
      title VARCHAR(60) NOT NULL,
      address VARCHAR(255) NOT NULL,
      detail VARCHAR(255) NOT NULL DEFAULT '',
      phone VARCHAR(20) NOT NULL DEFAULT '',
      type VARCHAR(12) NOT NULL DEFAULT 'home',
      lat DOUBLE NULL,
      lng DOUBLE NULL,
      KEY idx_addresses_user (user_id, id),
      CONSTRAINT fk_addresses_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    `CREATE TABLE IF NOT EXISTS products (
      id INT UNSIGNED NOT NULL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      category VARCHAR(80) NOT NULL,
      price BIGINT NOT NULL,
      old_price BIGINT NULL,
      unit VARCHAR(120) NOT NULL DEFAULT '',
      icon VARCHAR(80) NOT NULL DEFAULT 'Package',
      bg VARCHAR(255) NOT NULL DEFAULT '',
      icon_color VARCHAR(80) NOT NULL DEFAULT '',
      tag VARCHAR(120) NULL,
      frequent TINYINT(1) NOT NULL DEFAULT 0,
      sort_order INT NOT NULL DEFAULT 0
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    `CREATE TABLE IF NOT EXISTS stores (
      id INT UNSIGNED NOT NULL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      type VARCHAR(60) NOT NULL DEFAULT 'supermarket',
      pro TINYINT(1) NOT NULL DEFAULT 0,
      is_new TINYINT(1) NOT NULL DEFAULT 0,
      rating DECIMAL(3,1) NULL,
      minutes INT NOT NULL DEFAULT 45,
      fee BIGINT NOT NULL DEFAULT 35000,
      area VARCHAR(180) NOT NULL DEFAULT '',
      tags TEXT NOT NULL,
      off_text VARCHAR(255) NULL,
      gradient VARCHAR(255) NOT NULL DEFAULT '',
      initial VARCHAR(80) NOT NULL DEFAULT '',
      min_basket BIGINT NOT NULL DEFAULT 0
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    `CREATE TABLE IF NOT EXISTS promos (
      code VARCHAR(40) NOT NULL PRIMARY KEY,
      title VARCHAR(180) NOT NULL,
      description VARCHAR(255) NOT NULL DEFAULT '',
      kind VARCHAR(20) NOT NULL DEFAULT 'fixed',
      amount BIGINT NOT NULL DEFAULT 0,
      min_subtotal BIGINT NOT NULL DEFAULT 0,
      max_discount BIGINT NOT NULL DEFAULT 0,
      active TINYINT(1) NOT NULL DEFAULT 1
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    `CREATE TABLE IF NOT EXISTS favorites (
      user_id BIGINT UNSIGNED NOT NULL,
      product_id INT UNSIGNED NOT NULL,
      PRIMARY KEY (user_id, product_id),
      CONSTRAINT fk_favorites_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      CONSTRAINT fk_favorites_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    `CREATE TABLE IF NOT EXISTS carts (
      user_id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
      store_id INT UNSIGNED NULL,
      items LONGTEXT NOT NULL,
      updated_at VARCHAR(32) NOT NULL,
      CONSTRAINT fk_carts_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      CONSTRAINT fk_carts_store FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    `CREATE TABLE IF NOT EXISTS orders (
      id VARCHAR(40) NOT NULL PRIMARY KEY,
      user_id BIGINT UNSIGNED NOT NULL,
      store_id INT UNSIGNED NULL,
      store_name VARCHAR(255) NOT NULL,
      items LONGTEXT NOT NULL,
      subtotal BIGINT NOT NULL,
      discount BIGINT NOT NULL DEFAULT 0,
      delivery BIGINT NOT NULL DEFAULT 0,
      total BIGINT NOT NULL,
      address_title VARCHAR(80) NOT NULL DEFAULT '',
      address_text VARCHAR(255) NOT NULL DEFAULT '',
      slot VARCHAR(80) NOT NULL DEFAULT 'ارسال فوری',
      payment VARCHAR(20) NOT NULL DEFAULT 'online',
      promo_code VARCHAR(40) NULL,
      status INT NOT NULL DEFAULT 1,
      time VARCHAR(20) NOT NULL,
      created_at VARCHAR(32) NOT NULL,
      KEY idx_orders_user (user_id, created_at, id),
      CONSTRAINT fk_orders_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      CONSTRAINT fk_orders_store FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  ];
  for (const sql of schema) await db.run(sql);
}

/** Seeds the mock customer catalog from the shared JSON source of truth. */
export async function seed() {
  for (const [sortOrder, p] of catalog.products.entries()) {
    await db.run(
      `INSERT INTO products (id, name, category, price, old_price, unit, icon, bg, icon_color, tag, frequent, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE name=VALUES(name), category=VALUES(category), price=VALUES(price),
       old_price=VALUES(old_price), unit=VALUES(unit), icon=VALUES(icon), bg=VALUES(bg),
       icon_color=VALUES(icon_color), tag=VALUES(tag), frequent=VALUES(frequent), sort_order=VALUES(sort_order)`,
      [p.id, p.name, p.category, p.price, p.oldPrice ?? null, p.unit ?? "", p.icon ?? "Package", p.bg ?? "", p.iconColor ?? "", p.tag ?? null, p.frequent ? 1 : 0, sortOrder],
    );
  }
  for (const store of catalog.stores) {
    await db.run(
      `INSERT INTO stores (id, name, type, pro, is_new, rating, minutes, fee, area, tags, off_text, gradient, initial, min_basket)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE name=VALUES(name), type=VALUES(type), pro=VALUES(pro), is_new=VALUES(is_new),
       rating=VALUES(rating), minutes=VALUES(minutes), fee=VALUES(fee), area=VALUES(area), tags=VALUES(tags),
       off_text=VALUES(off_text), gradient=VALUES(gradient), initial=VALUES(initial), min_basket=VALUES(min_basket)`,
      [store.id, store.name, store.type, store.pro ? 1 : 0, store.isNew ? 1 : 0, store.rating ?? null, store.minutes, store.fee, store.area, JSON.stringify(store.tags ?? []), store.offText ?? null, store.gradient, store.initial, store.minBasket ?? 0],
    );
  }
  for (const promo of catalog.promos) {
    await db.run(
      `INSERT INTO promos (code, title, description, kind, amount, min_subtotal, max_discount, active)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1)
       ON DUPLICATE KEY UPDATE title=VALUES(title), description=VALUES(description), kind=VALUES(kind),
       amount=VALUES(amount), min_subtotal=VALUES(min_subtotal), max_discount=VALUES(max_discount), active=1`,
      [promo.code, promo.title, promo.desc ?? "", promo.kind, promo.amount, promo.minSubtotal ?? 0, promo.maxDiscount ?? 0],
    );
  }
}

const parseJson = (value, fallback) => {
  if (value == null) return fallback;
  if (typeof value !== "string") return value;
  try { return JSON.parse(value); } catch { return fallback; }
};

export const mapProduct = (r) => ({
  id: Number(r.id), name: r.name, category: r.category, price: Number(r.price),
  ...(r.old_price != null ? { oldPrice: Number(r.old_price) } : {}),
  unit: r.unit, icon: r.icon, bg: r.bg, iconColor: r.icon_color,
  ...(r.tag ? { tag: r.tag } : {}), ...(r.frequent ? { frequent: true } : {}),
});

export const mapStore = (r) => ({
  id: Number(r.id), name: r.name, type: r.type,
  ...(r.pro ? { pro: true } : {}), ...(r.is_new ? { isNew: true } : {}),
  ...(r.rating != null ? { rating: Number(r.rating) } : {}),
  minutes: Number(r.minutes), fee: Number(r.fee), area: r.area,
  tags: parseJson(r.tags, []), ...(r.off_text ? { offText: r.off_text } : {}),
  gradient: r.gradient, initial: r.initial, minBasket: Number(r.min_basket),
});

export const mapPromo = (r) => ({
  code: r.code, title: r.title, desc: r.description, amount: Number(r.amount), kind: r.kind,
  minSubtotal: Number(r.min_subtotal), maxDiscount: Number(r.max_discount), active: Boolean(r.active),
});

export const mapUser = (r) => ({
  id: Number(r.id), phone: r.phone, firstName: r.first_name, lastName: r.last_name,
  wallet: Number(r.wallet), pro: Boolean(r.pro), createdAt: r.created_at,
});

export const mapAddress = (r) => ({
  id: Number(r.id), title: r.title, address: r.address, detail: r.detail,
  phone: r.phone, type: r.type,
  ...(r.lat != null ? { lat: Number(r.lat), lng: Number(r.lng) } : {}),
});

export const mapOrder = (r) => ({
  id: r.id, storeId: r.store_id == null ? null : Number(r.store_id), storeName: r.store_name,
  items: parseJson(r.items, []), subtotal: Number(r.subtotal), discount: Number(r.discount),
  delivery: Number(r.delivery), total: Number(r.total), addressTitle: r.address_title,
  slot: r.slot, payment: r.payment, promoCode: r.promo_code, status: Number(r.status),
  time: r.time, createdAt: r.created_at,
});

export { catalog };

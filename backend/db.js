/**
 * MySQL persistence for the customer storefront.
 * Configure MYSQL_HOST, MYSQL_PORT, MYSQL_DATABASE, MYSQL_USER and
 * MYSQL_PASSWORD in the environment (see .env.example).
 */
import "./env.js";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mysql from "mysql2/promise";
import crypto from "node:crypto";
import { normalizeImage } from "./images.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const catalog = JSON.parse(
  fs.readFileSync(path.join(__dirname, "shared", "catalog.json"), "utf8"),
);

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
      all: async (sql, values = []) =>
        (await connection.execute(sql, values))[0],
      get: async (sql, values = []) => {
        const [rows] = await connection.execute(sql, values);
        return rows[0] ?? null;
      },
      run: async (sql, values = []) =>
        (await connection.execute(sql, values))[0],
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

/** Create/upgrade the customer + seller schemas without overwriting live rows. */
async function ensureColumn(table, column, definition) {
  const found = await db.get(
    `SELECT 1 AS found FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, column],
  );
  if (!found)
    await db.run(
      `ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`,
    );
}
async function ensureIndex(table, indexName, columns, unique = false) {
  const found = await db.get(
    `SELECT 1 AS found FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?`,
    [table, indexName],
  );
  if (!found)
    await db.run(
      `CREATE ${unique ? "UNIQUE " : ""}INDEX \`${indexName}\` ON \`${table}\` (${columns})`,
    );
}

export async function migrate() {
  const schema = [
    `CREATE TABLE IF NOT EXISTS courier_notifications (id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,courier_id BIGINT UNSIGNED NOT NULL,event_key VARCHAR(180) NOT NULL,kind VARCHAR(40) NOT NULL,title VARCHAR(180) NOT NULL,body VARCHAR(500) NOT NULL,target VARCHAR(40) NOT NULL,is_read TINYINT NOT NULL DEFAULT 0,created_at VARCHAR(32) NOT NULL,UNIQUE KEY(courier_id,event_key),KEY(courier_id,is_read)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    `CREATE TABLE IF NOT EXISTS courier_offers (courier_id BIGINT UNSIGNED NOT NULL,order_id VARCHAR(40) NOT NULL,expires_at VARCHAR(32) NOT NULL,state VARCHAR(20) NOT NULL DEFAULT 'pending',PRIMARY KEY(courier_id,order_id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    `CREATE TABLE IF NOT EXISTS courier_trip_events (id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,order_id VARCHAR(40) NOT NULL,courier_id BIGINT UNSIGNED NOT NULL,stage VARCHAR(30) NOT NULL,created_at VARCHAR(32) NOT NULL,UNIQUE KEY(order_id,stage)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    `CREATE TABLE IF NOT EXISTS courier_declined_orders (courier_id BIGINT UNSIGNED NOT NULL,order_id VARCHAR(40) NOT NULL,created_at VARCHAR(32) NOT NULL,PRIMARY KEY(courier_id,order_id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    `CREATE TABLE IF NOT EXISTS platform_settings (id INT PRIMARY KEY,value_json TEXT NOT NULL) ENGINE=InnoDB`,
    `CREATE TABLE IF NOT EXISTS courier_ledger (id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,courier_id BIGINT UNSIGNED NOT NULL,order_id VARCHAR(40) NOT NULL UNIQUE,amount BIGINT NOT NULL,created_at VARCHAR(32) NOT NULL,KEY(courier_id)) ENGINE=InnoDB`,
    `CREATE TABLE IF NOT EXISTS courier_withdrawals (id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,courier_id BIGINT UNSIGNED NOT NULL,amount BIGINT NOT NULL,iban VARCHAR(26) NOT NULL,status VARCHAR(20) NOT NULL DEFAULT 'pending',reference VARCHAR(120) NOT NULL DEFAULT '',reason VARCHAR(500) NOT NULL DEFAULT '',created_at VARCHAR(32) NOT NULL,KEY(courier_id)) ENGINE=InnoDB`,
    `CREATE TABLE IF NOT EXISTS courier_tickets (id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,courier_id BIGINT UNSIGNED NOT NULL,subject VARCHAR(180) NOT NULL,status VARCHAR(20) NOT NULL DEFAULT 'open',created_at VARCHAR(32) NOT NULL,KEY(courier_id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    `CREATE TABLE IF NOT EXISTS courier_ticket_messages (id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,ticket_id BIGINT UNSIGNED NOT NULL,role VARCHAR(20) NOT NULL,body TEXT NOT NULL,created_at VARCHAR(32) NOT NULL,KEY(ticket_id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    `CREATE TABLE IF NOT EXISTS platform_expenses (id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,description VARCHAR(255) NOT NULL,amount BIGINT NOT NULL,created_at VARCHAR(32) NOT NULL) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    `CREATE TABLE IF NOT EXISTS order_events (id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, order_id VARCHAR(40) NOT NULL, status INT NOT NULL, actor_role VARCHAR(20) NOT NULL, actor_id BIGINT UNSIGNED NULL, created_at VARCHAR(32) NOT NULL, KEY idx_order_events (order_id,id)) ENGINE=InnoDB`,
    `CREATE TABLE IF NOT EXISTS first_offer_redemptions (user_id BIGINT UNSIGNED PRIMARY KEY, order_id VARCHAR(40) NOT NULL, product_id INT UNSIGNED NOT NULL, discount BIGINT NOT NULL, created_at VARCHAR(32) NOT NULL) ENGINE=InnoDB`,
    // «خرید اول» به شکل فروشگاهی: هر فروشنده چند کالا با درصد تخفیف (۲۵٪ به
    // بالا) و حداقل مبلغ سبد معرفی می‌کند؛ مشتری فقط یکی از آن‌ها را با تخفیف
    // برمی‌دارد و مابقی سبد را از همان فروشگاه با قیمت عادی می‌خرد.
    `CREATE TABLE IF NOT EXISTS store_first_offers (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      store_id INT UNSIGNED NOT NULL, seller_id BIGINT UNSIGNED NOT NULL,
      percent INT NOT NULL, min_basket BIGINT NOT NULL DEFAULT 0,
      active TINYINT(1) NOT NULL DEFAULT 1, created_at VARCHAR(32) NOT NULL,
      UNIQUE KEY uq_first_offer_store (store_id),
      CONSTRAINT fk_first_offer_store FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    `CREATE TABLE IF NOT EXISTS store_first_offer_products (
      offer_id INT UNSIGNED NOT NULL, product_id INT UNSIGNED NOT NULL,
      PRIMARY KEY (offer_id, product_id),
      CONSTRAINT fk_fop_offer FOREIGN KEY (offer_id) REFERENCES store_first_offers(id) ON DELETE CASCADE,
      CONSTRAINT fk_fop_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    `CREATE TABLE IF NOT EXISTS wallet_transactions (id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, user_id BIGINT UNSIGNED NOT NULL, order_id VARCHAR(40) NULL, kind VARCHAR(32) NOT NULL, amount BIGINT NOT NULL, note VARCHAR(255) NOT NULL DEFAULT '', created_at VARCHAR(32) NOT NULL, KEY idx_wallet_tx_user (user_id,id), UNIQUE KEY uq_wallet_tx_order_kind (order_id,kind)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    `CREATE TABLE IF NOT EXISTS admin_sessions (token CHAR(64) PRIMARY KEY, expires_at VARCHAR(32) NOT NULL) ENGINE=InnoDB`,
    `CREATE TABLE IF NOT EXISTS master_products (id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY, name VARCHAR(180) NOT NULL, category VARCHAR(80) NOT NULL, unit VARCHAR(120) NOT NULL DEFAULT '', image_url VARCHAR(512) NOT NULL, active TINYINT NOT NULL DEFAULT 1) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    `CREATE TABLE IF NOT EXISTS users (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      phone VARCHAR(20) NOT NULL UNIQUE, password_hash VARCHAR(255) NOT NULL,
      first_name VARCHAR(80) NOT NULL DEFAULT '', last_name VARCHAR(80) NOT NULL DEFAULT '',
      wallet BIGINT NOT NULL DEFAULT 0, pro TINYINT(1) NOT NULL DEFAULT 0, created_at VARCHAR(32) NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    `CREATE TABLE IF NOT EXISTS seller_accounts (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      phone VARCHAR(20) NOT NULL UNIQUE, password_hash VARCHAR(255) NOT NULL,
      owner_name VARCHAR(120) NOT NULL, national_id_enc VARCHAR(600) NOT NULL, iban_enc VARCHAR(600) NOT NULL,
      created_at VARCHAR(32) NOT NULL, active TINYINT(1) NOT NULL DEFAULT 1
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    `CREATE TABLE IF NOT EXISTS sessions (
      token CHAR(64) NOT NULL PRIMARY KEY, user_id BIGINT UNSIGNED NOT NULL, created_at VARCHAR(32) NOT NULL,
      KEY idx_sessions_user (user_id), CONSTRAINT fk_sessions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    `CREATE TABLE IF NOT EXISTS seller_sessions (
      token CHAR(64) NOT NULL PRIMARY KEY, seller_id BIGINT UNSIGNED NOT NULL, created_at VARCHAR(32) NOT NULL,
      KEY idx_seller_sessions_owner (seller_id), CONSTRAINT fk_seller_sessions_owner FOREIGN KEY (seller_id) REFERENCES seller_accounts(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    `CREATE TABLE IF NOT EXISTS courier_accounts (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY, phone VARCHAR(20) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL, full_name VARCHAR(120) NOT NULL,
      vehicle VARCHAR(40) NOT NULL DEFAULT 'motorcycle', active TINYINT(1) NOT NULL DEFAULT 0,
      created_at VARCHAR(32) NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    `CREATE TABLE IF NOT EXISTS courier_sessions (
      token CHAR(64) NOT NULL PRIMARY KEY, courier_id BIGINT UNSIGNED NOT NULL, created_at VARCHAR(32) NOT NULL,
      KEY idx_courier_sessions_owner (courier_id),
      CONSTRAINT fk_courier_sessions_owner FOREIGN KEY (courier_id) REFERENCES courier_accounts(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    `CREATE TABLE IF NOT EXISTS schema_migrations (
      migration_key VARCHAR(120) NOT NULL PRIMARY KEY, applied_at VARCHAR(32) NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    `CREATE TABLE IF NOT EXISTS addresses (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY, user_id BIGINT UNSIGNED NOT NULL,
      title VARCHAR(60) NOT NULL, address VARCHAR(255) NOT NULL, detail VARCHAR(255) NOT NULL DEFAULT '',
      phone VARCHAR(20) NOT NULL DEFAULT '', type VARCHAR(12) NOT NULL DEFAULT 'home', lat DOUBLE NULL, lng DOUBLE NULL,
      KEY idx_addresses_user (user_id, id), CONSTRAINT fk_addresses_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    `CREATE TABLE IF NOT EXISTS seller_sequences (
      seq_name VARCHAR(30) NOT NULL PRIMARY KEY, next_id BIGINT UNSIGNED NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    `CREATE TABLE IF NOT EXISTS products (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY, name VARCHAR(255) NOT NULL, category VARCHAR(80) NOT NULL,
      price BIGINT NOT NULL, old_price BIGINT NULL, unit VARCHAR(120) NOT NULL DEFAULT '',
      icon VARCHAR(80) NOT NULL DEFAULT 'Package', bg VARCHAR(255) NOT NULL DEFAULT '',
      icon_color VARCHAR(80) NOT NULL DEFAULT '', tag VARCHAR(120) NULL, frequent TINYINT(1) NOT NULL DEFAULT 0,
      sort_order INT NOT NULL DEFAULT 0, seller_id BIGINT UNSIGNED NULL, store_id INT UNSIGNED NULL,
      stock INT UNSIGNED NOT NULL DEFAULT 0, image_url VARCHAR(512) NULL, active TINYINT(1) NOT NULL DEFAULT 1,
      created_at VARCHAR(32) NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    `CREATE TABLE IF NOT EXISTS stores (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY, name VARCHAR(255) NOT NULL,
      type VARCHAR(60) NOT NULL DEFAULT 'supermarket', pro TINYINT(1) NOT NULL DEFAULT 0,
      is_new TINYINT(1) NOT NULL DEFAULT 0, rating DECIMAL(3,1) NULL, minutes INT NOT NULL DEFAULT 45,
      fee BIGINT NOT NULL DEFAULT 35000, area VARCHAR(180) NOT NULL DEFAULT '', tags TEXT NOT NULL,
      off_text VARCHAR(255) NULL, gradient VARCHAR(255) NOT NULL DEFAULT '', initial VARCHAR(80) NOT NULL DEFAULT '',
      min_basket BIGINT NOT NULL DEFAULT 0, seller_id BIGINT UNSIGNED NULL, category VARCHAR(80) NOT NULL DEFAULT 'supermarket',
      address VARCHAR(500) NOT NULL DEFAULT '', lat DOUBLE NULL, lng DOUBLE NULL,
      photo_url VARCHAR(512) NULL, logo_url VARCHAR(512) NULL, hours VARCHAR(160) NOT NULL DEFAULT '',
      is_active TINYINT(1) NOT NULL DEFAULT 0
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    `CREATE TABLE IF NOT EXISTS promos (
      code VARCHAR(40) NOT NULL PRIMARY KEY, title VARCHAR(180) NOT NULL,
      description VARCHAR(255) NOT NULL DEFAULT '', kind VARCHAR(20) NOT NULL DEFAULT 'fixed',
      amount BIGINT NOT NULL DEFAULT 0, min_subtotal BIGINT NOT NULL DEFAULT 0,
      max_discount BIGINT NOT NULL DEFAULT 0, active TINYINT(1) NOT NULL DEFAULT 1
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    `CREATE TABLE IF NOT EXISTS seller_promos (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY, seller_id BIGINT UNSIGNED NOT NULL,
      store_id INT UNSIGNED NOT NULL, code VARCHAR(40) NOT NULL, title VARCHAR(180) NOT NULL,
      description VARCHAR(255) NOT NULL DEFAULT '', kind VARCHAR(20) NOT NULL,
      amount BIGINT NOT NULL, min_subtotal BIGINT NOT NULL DEFAULT 0, max_discount BIGINT NOT NULL DEFAULT 0,
      active TINYINT(1) NOT NULL DEFAULT 1, starts_at VARCHAR(32) NULL, expires_at VARCHAR(32) NULL,
      created_at VARCHAR(32) NOT NULL, UNIQUE KEY uq_seller_promo_store_code (store_id, code),
      KEY idx_seller_promos (seller_id, active),
      CONSTRAINT fk_seller_promos_owner FOREIGN KEY (seller_id) REFERENCES seller_accounts(id) ON DELETE CASCADE,
      CONSTRAINT fk_seller_promos_store FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    `CREATE TABLE IF NOT EXISTS favorites (
      user_id BIGINT UNSIGNED NOT NULL, product_id INT UNSIGNED NOT NULL, PRIMARY KEY (user_id, product_id),
      CONSTRAINT fk_favorites_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      CONSTRAINT fk_favorites_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    `CREATE TABLE IF NOT EXISTS carts (
      user_id BIGINT UNSIGNED NOT NULL PRIMARY KEY, store_id INT UNSIGNED NULL, items LONGTEXT NOT NULL,
      updated_at VARCHAR(32) NOT NULL,
      CONSTRAINT fk_carts_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      CONSTRAINT fk_carts_store FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    `CREATE TABLE IF NOT EXISTS orders (
      id VARCHAR(40) NOT NULL PRIMARY KEY, user_id BIGINT UNSIGNED NOT NULL, store_id INT UNSIGNED NULL,
      store_name VARCHAR(255) NOT NULL, items LONGTEXT NOT NULL, subtotal BIGINT NOT NULL,
      discount BIGINT NOT NULL DEFAULT 0, delivery BIGINT NOT NULL DEFAULT 0, total BIGINT NOT NULL,
      address_title VARCHAR(80) NOT NULL DEFAULT '', address_text VARCHAR(255) NOT NULL DEFAULT '',
      slot VARCHAR(80) NOT NULL DEFAULT 'ارسال فوری', payment VARCHAR(20) NOT NULL DEFAULT 'cash',
      promo_code VARCHAR(40) NULL, status INT NOT NULL DEFAULT 1, time VARCHAR(20) NOT NULL,
      created_at VARCHAR(32) NOT NULL, KEY idx_orders_user (user_id, created_at, id),
      KEY idx_orders_store (store_id, created_at),
      CONSTRAINT fk_orders_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      CONSTRAINT fk_orders_store FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    `CREATE TABLE IF NOT EXISTS order_deliveries (
      order_id VARCHAR(40) NOT NULL PRIMARY KEY, courier_id BIGINT UNSIGNED NOT NULL,
      claimed_at VARCHAR(32) NOT NULL, completed_at VARCHAR(32) NULL, KEY idx_order_deliveries_courier (courier_id),
      CONSTRAINT fk_order_deliveries_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
      CONSTRAINT fk_order_deliveries_owner FOREIGN KEY (courier_id) REFERENCES courier_accounts(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    `CREATE TABLE IF NOT EXISTS platform_promos (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      code VARCHAR(40) NOT NULL, title VARCHAR(180) NOT NULL,
      description VARCHAR(255) NOT NULL DEFAULT '', kind VARCHAR(20) NOT NULL,
      amount BIGINT NOT NULL, min_subtotal BIGINT NOT NULL DEFAULT 0, max_discount BIGINT NOT NULL DEFAULT 0,
      audience VARCHAR(20) NOT NULL DEFAULT 'all', active TINYINT(1) NOT NULL DEFAULT 1,
      max_uses INT NOT NULL DEFAULT 0, usage_count INT NOT NULL DEFAULT 0,
      starts_at VARCHAR(32) NULL, expires_at VARCHAR(32) NULL, created_at VARCHAR(32) NOT NULL,
      UNIQUE KEY uq_platform_promo_code (code), KEY idx_platform_promos_active (active, expires_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    `CREATE TABLE IF NOT EXISTS platform_promo_users (
      promo_id BIGINT UNSIGNED NOT NULL, user_id BIGINT UNSIGNED NOT NULL, created_at VARCHAR(32) NOT NULL,
      PRIMARY KEY (promo_id, user_id),
      CONSTRAINT fk_platform_promo_users_promo FOREIGN KEY (promo_id) REFERENCES platform_promos(id) ON DELETE CASCADE,
      CONSTRAINT fk_platform_promo_users_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    `CREATE TABLE IF NOT EXISTS promo_redemptions (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      scope VARCHAR(10) NOT NULL, promo_id BIGINT UNSIGNED NOT NULL, user_id BIGINT UNSIGNED NOT NULL,
      order_id VARCHAR(40) NOT NULL, discount BIGINT NOT NULL DEFAULT 0, created_at VARCHAR(32) NOT NULL,
      UNIQUE KEY uq_promo_redemption (scope, promo_id, user_id), KEY idx_promo_redemptions_order (order_id),
      CONSTRAINT fk_promo_redemptions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  ];
  for (const sql of schema) await db.run(sql);

  // The previous app used status 3 for completed orders; preserve those records as completed before reusing 3 for courier handoff.
  await db.transaction(async (tx) => {
    const marker = await tx.run(
      "INSERT IGNORE INTO schema_migrations (migration_key, applied_at) VALUES (?, ?)",
      ["order-status-courier-handoff-v1", new Date().toISOString()],
    );
    if (marker.affectedRows)
      await tx.run("UPDATE orders SET status=4 WHERE status=3");
  });

  await db.transaction(async (tx) => {
    const marker = await tx.run(
      "INSERT IGNORE INTO schema_migrations (migration_key,applied_at) VALUES ('order-five-stages-v1',?)",
      [new Date().toISOString()],
    );
    if (marker.affectedRows) {
      await tx.run("UPDATE orders SET status=5 WHERE status=4");
      await tx.run(
        "UPDATE orders o JOIN order_deliveries d ON d.order_id=o.id SET o.status=4 WHERE o.status=3 AND d.completed_at IS NULL",
      );
      await tx.run(
        "INSERT INTO order_events (order_id,status,actor_role,actor_id,created_at) SELECT id,status,'migration',NULL,created_at FROM orders",
      );
    }
  });
  // Upgrade databases created by earlier versions in-place; all existing data remains untouched.
  for (const [column, definition] of [
    ["seller_id", "BIGINT UNSIGNED NULL"],
    ["category", "VARCHAR(80) NOT NULL DEFAULT 'supermarket'"],
    ["address", "VARCHAR(500) NOT NULL DEFAULT ''"],
    ["lat", "DOUBLE NULL"],
    ["lng", "DOUBLE NULL"],
    ["photo_url", "VARCHAR(512) NULL"],
    ["logo_url", "VARCHAR(512) NULL"],
    ["hours", "VARCHAR(160) NOT NULL DEFAULT ''"],
    ["is_active", "TINYINT(1) NOT NULL DEFAULT 0"],
    // Sellers can close their shop for new orders («بسته‌ایم»); closed stores
    // are skipped when unconfirmed orders are reassigned.
    ["is_open", "TINYINT(1) NOT NULL DEFAULT 1"],
  ])
    await ensureColumn("stores", column, definition);
  for (const [column, definition] of [
    ["seller_id", "BIGINT UNSIGNED NULL"],
    ["store_id", "INT UNSIGNED NULL"],
    ["stock", "INT UNSIGNED NOT NULL DEFAULT 0"],
    ["image_url", "VARCHAR(512) NULL"],
    ["active", "TINYINT(1) NOT NULL DEFAULT 1"],
    ["created_at", "VARCHAR(32) NULL"],
  ])
    await ensureColumn("products", column, definition);
  await ensureColumn("products", "master_product_id", "INT UNSIGNED NULL");
  await ensureIndex(
    "products",
    "uq_store_master",
    "store_id, master_product_id",
    true,
  );
  for (const [column, definition] of Object.entries({
    plate: "VARCHAR(40) NULL",
    motor_photo: "VARCHAR(255) NULL",
    national_photo: "VARCHAR(255) NULL",
    license_photo: "VARCHAR(255) NULL",
    plate_photo: "VARCHAR(255) NULL",
    vehicle_info: "VARCHAR(255) NOT NULL DEFAULT ''",
    verification_status: "VARCHAR(20) NOT NULL DEFAULT 'unsubmitted'",
    rejection_reason: "VARCHAR(500) NOT NULL DEFAULT ''",
  }))
    await ensureColumn("courier_accounts", column, definition);
  for (const [column, definition] of Object.entries({
    description: "TEXT NULL",
    base_price: "BIGINT NOT NULL DEFAULT 0",
    stock: "INT UNSIGNED NOT NULL DEFAULT 0",
    max_discount: "INT NOT NULL DEFAULT 90",
    image_normalized: "TINYINT NOT NULL DEFAULT 0",
  }))
    await ensureColumn("master_products", column, definition);
  await ensureColumn(
    "master_products",
    "weight_kg",
    "DECIMAL(8,3) NOT NULL DEFAULT 0.5",
  );
  for (const [column, definition] of Object.entries({
    online: "TINYINT NOT NULL DEFAULT 0",
    lat: "DOUBLE NULL",
    lng: "DOUBLE NULL",
    location_updated_at: "VARCHAR(32) NULL",
    motor_photos: "TEXT NULL",
    personal_details: "TEXT NULL",
    portrait_photo: "VARCHAR(255) NULL",
    vehicle_document_photo: "VARCHAR(255) NULL",
  }))
    await ensureColumn("courier_accounts", column, definition);
  for (const [column, definition] of Object.entries({
    trip_status: "VARCHAR(30) NOT NULL DEFAULT 'in_transit'",
    arrived_at: "VARCHAR(32) NULL",
    picked_up_at: "VARCHAR(32) NULL",
    delivery_otp: "TEXT NULL",
    otp_attempts: "INT NOT NULL DEFAULT 0",
    otp_expires_at: "VARCHAR(32) NULL",
  }))
    await ensureColumn("order_deliveries", column, definition);
  for (const [column, definition] of Object.entries({
    gross_amount: "BIGINT NULL",
    commission_amount: "BIGINT NOT NULL DEFAULT 0",
  }))
    await ensureColumn("courier_ledger", column, definition);
  await ensureColumn(
    "courier_tickets",
    "category",
    "VARCHAR(40) NOT NULL DEFAULT 'other'",
  );
  for (const [column, definition] of Object.entries({
    delivery_mode: "VARCHAR(20) NOT NULL DEFAULT 'courier'",
    dispatch_started_at: "VARCHAR(32) NULL",
    dispatch_paused: "TINYINT(1) NOT NULL DEFAULT 0",
    destination_lat: "DOUBLE NULL",
    destination_lng: "DOUBLE NULL",
    fare_details: "TEXT NULL",
    courier_fee: "BIGINT NULL",
    courier_commission_rate: "DECIMAL(5,2) NOT NULL DEFAULT 0",
    platform_commission: "BIGINT NOT NULL DEFAULT 0",
    first_offer_discount: "BIGINT NOT NULL DEFAULT 0",
    seller_discount: "BIGINT NOT NULL DEFAULT 0",
    platform_discount: "BIGINT NOT NULL DEFAULT 0",
    // A store saying "not today" is not the same event as a customer cancelling,
    // and the order card has to tell them apart.
    rejected_by: "VARCHAR(20) NULL",
    reject_reason: "VARCHAR(255) NULL",
    // Auto-reassignment: while an order waits in status 1, a store has ten
    // minutes to confirm it. When the clock runs out the order moves to
    // another store carrying the same master products — and again every ten
    // minutes after that until someone confirms.
    reassign_started_at: "VARCHAR(32) NULL",
    reassign_count: "INT NOT NULL DEFAULT 0",
    reassign_history: "TEXT NULL",
  }))
    await ensureColumn("orders", column, definition);
  await db.run(
    `UPDATE orders o SET dispatch_started_at=COALESCE((SELECT MIN(e.created_at) FROM order_events e WHERE e.order_id COLLATE utf8mb4_unicode_ci=o.id COLLATE utf8mb4_unicode_ci AND e.status=3),o.created_at) WHERE o.status=3 AND o.dispatch_started_at IS NULL`,
  );
  // Preserve real existing products in the central bank once, without importing demo rows.
  await db.transaction(async (tx) => {
    const rows = await tx.all(
      "SELECT id,name,category,unit,image_url,stock,price,active FROM products WHERE seller_id IS NOT NULL AND master_product_id IS NULL AND image_url IS NOT NULL FOR UPDATE",
    );
    for (const p of rows) {
      const result = await tx.run(
        "INSERT INTO master_products (name,category,unit,image_url,active,base_price,stock) VALUES (?,?,?,?,?,?,?)",
        [p.name, p.category, p.unit, p.image_url, p.active, p.price, p.stock],
      );
      await tx.run("UPDATE products SET master_product_id=? WHERE id=?", [
        result.insertId,
        p.id,
      ]);
    }
  });
  const oldImages = await db.all(
    "SELECT id,image_url FROM master_products WHERE image_normalized=0",
  );
  for (const product of oldImages) {
    if (!product.image_url.startsWith("/api/uploads/")) continue;
    const filename = crypto.randomUUID() + ".jpg",
      destination = path.join(__dirname, "uploads", filename);
    try {
      await fs.promises.copyFile(
        path.join(__dirname, "uploads", path.basename(product.image_url)),
        destination,
      );
      await normalizeImage({ path: destination }, true);
      await db.transaction(async (tx) => {
        await tx.run(
          "UPDATE master_products SET image_url=?,image_normalized=1 WHERE id=?",
          [`/api/uploads/${filename}`, product.id],
        );
        await tx.run(
          "UPDATE products SET image_url=? WHERE master_product_id=?",
          [`/api/uploads/${filename}`, product.id],
        );
      });
    } catch (error) {
      await fs.promises.unlink(destination).catch(() => {});
      console.warn(
        "[migration] Cannot normalize existing product image",
        product.id,
        error.code || "invalid image",
      );
    }
  }
  await ensureColumn(
    "orders",
    "payment_status",
    "VARCHAR(20) NOT NULL DEFAULT 'unpaid'",
  );
  // Discount codes: total capacity + consumption counter for store codes too.
  await ensureColumn(
    "seller_promos",
    "max_uses",
    "INT NOT NULL DEFAULT 0",
  );
  await ensureColumn(
    "seller_promos",
    "usage_count",
    "INT NOT NULL DEFAULT 0",
  );
  await ensureColumn(
    "seller_promos",
    "starts_at",
    "VARCHAR(32) NULL",
  );
  await ensureIndex("stores", "uq_stores_seller", "seller_id", true);
  await ensureIndex(
    "products",
    "idx_products_seller_store",
    "seller_id, store_id, active",
  );
  for (const [name, table] of [
    ["store", "stores"],
    ["product", "products"],
  ]) {
    const maximum = await db.get(
      `SELECT COALESCE(MAX(id), 0) AS n FROM \`${table}\``,
    );
    await db.run(
      `INSERT INTO seller_sequences (seq_name, next_id) VALUES (?, ?)
       ON DUPLICATE KEY UPDATE next_id = GREATEST(next_id, VALUES(next_id))`,
      [name, Number(maximum.n) + 1],
    );
  }
}

export async function allocateId(tx, name) {
  const row = await tx.get(
    "SELECT next_id FROM seller_sequences WHERE seq_name = ? FOR UPDATE",
    [name],
  );
  if (!row)
    throw new Error(
      `Missing ${name} id sequence; restart the API to migrate the database.`,
    );
  const id = Number(row.next_id);
  await tx.run(
    "UPDATE seller_sequences SET next_id = next_id + 1 WHERE seq_name = ?",
    [name],
  );
  return id;
}

const parseJson = (value, fallback) => {
  if (value == null) return fallback;
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

export const mapProduct = (r) => ({
  id: Number(r.id),
  masterId:
    r.master_product_id == null ? undefined : Number(r.master_product_id),
  name: r.name,
  category: r.category,
  price: Number(r.price),
  ...(r.old_price != null ? { oldPrice: Number(r.old_price) } : {}),
  description: r.description ?? "",
  unit: r.unit,
  icon: r.icon,
  bg: r.bg,
  iconColor: r.icon_color,
  ...(r.tag ? { tag: r.tag } : {}),
  ...(r.frequent ? { frequent: true } : {}),
  ...(r.store_id != null ? { storeId: Number(r.store_id) } : {}),
  ...(r.image_url ? { imageUrl: r.image_url } : {}),
  stock: Number(r.stock ?? 0),
  active: Boolean(r.active),
});

export const mapStore = (r) => ({
  id: Number(r.id),
  name: r.name,
  type: r.type,
  category: r.category ?? r.type,
  ...(r.pro ? { pro: true } : {}),
  ...(r.is_new ? { isNew: true } : {}),
  ...(r.rating != null ? { rating: Number(r.rating) } : {}),
  minutes: Number(r.minutes),
  fee: Number(r.fee),
  area: r.area,
  tags: parseJson(r.tags, []),
  ...(r.off_text ? { offText: r.off_text } : {}),
  gradient: r.gradient,
  initial: r.initial,
  minBasket: Number(r.min_basket),
  ...(r.logo_url ? { logoUrl: r.logo_url } : {}),
  ...(r.photo_url ? { photoUrl: r.photo_url } : {}),
  address: r.address ?? r.area,
  ...(r.lat != null ? { lat: Number(r.lat), lng: Number(r.lng) } : {}),
  hours: r.hours ?? "",
  isActive: Boolean(r.is_active),
  isOpen: Boolean(r.is_open ?? 1),
});

export const mapPromo = (r) => ({
  ...(r.id != null ? { id: Number(r.id) } : {}),
  code: r.code,
  title: r.title,
  desc: r.description,
  amount: Number(r.amount),
  kind: r.kind,
  minSubtotal: Number(r.min_subtotal),
  maxDiscount: Number(r.max_discount),
  active: Boolean(r.active),
  ...(r.expires_at ? { expiresAt: r.expires_at } : {}),
  scope: r.scope ?? "store",
  maxUses: Number(r.max_uses ?? 0),
  usageCount: Number(r.usage_count ?? 0),
  ...(r.audience ? { audience: r.audience } : {}),
});

export const mapUser = (r) => ({
  id: Number(r.id),
  phone: r.phone,
  firstName: r.first_name,
  lastName: r.last_name,
  wallet: Number(r.wallet),
  pro: Boolean(r.pro),
  createdAt: r.created_at,
});

export const mapWalletTx = (r) => ({
  id: Number(r.id),
  orderId: r.order_id ?? null,
  kind: r.kind,
  amount: Number(r.amount),
  note: r.note,
  createdAt: r.created_at,
});

/**
 * Records one wallet movement inside an existing transaction. Positive
 * `amount` credits the wallet (refunds), negative debits it (order payment).
 * The `(order_id, kind)` unique key keeps refunds idempotent — replaying the
 * same refund returns false and leaves the wallet untouched. The ledger row is
 * written first so a duplicate can never credit twice.
 */
export async function walletMovement(
  tx,
  { userId, orderId = null, kind, amount, note = "" },
) {
  if (!Number.isSafeInteger(amount) || amount === 0) return false;
  try {
    await tx.run(
      "INSERT INTO wallet_transactions (user_id, order_id, kind, amount, note, created_at) VALUES (?,?,?,?,?,?)",
      [userId, orderId, kind, amount, note, new Date().toISOString()],
    );
  } catch (error) {
    if (error?.code === "ER_DUP_ENTRY") return false;
    throw error;
  }
  await tx.run("UPDATE users SET wallet = wallet + ? WHERE id = ?", [
    amount,
    userId,
  ]);
  return true;
}

export const mapAddress = (r) => ({
  id: Number(r.id),
  title: r.title,
  address: r.address,
  detail: r.detail,
  phone: r.phone,
  type: r.type,
  ...(r.lat != null ? { lat: Number(r.lat), lng: Number(r.lng) } : {}),
});

export const mapOrder = (r) => ({
  id: r.id,
  storeId: r.store_id == null ? null : Number(r.store_id),
  storeName: r.store_name,
  items: parseJson(r.items, []),
  subtotal: Number(r.subtotal),
  discount: Number(r.discount),
  delivery: Number(r.delivery),
  total: Number(r.total),
  addressTitle: r.address_title,
  slot: r.slot,
  payment: r.payment,
  promoCode: r.promo_code,
  status: Number(r.status),
  deliveryMode: r.delivery_mode || "courier",
  dispatchStartedAt: r.dispatch_started_at || null,
  dispatchPaused: Boolean(r.dispatch_paused),
  time: r.time,
  createdAt: r.created_at,
  paymentStatus: r.payment_status ?? "unpaid",
  platformDiscount: Number(r.platform_discount ?? 0),
  // The receipt has to say who funded the discount, and those two columns are
  // the only place that split is recorded. Rows written before the columns
  // existed report 0, so the UI shows the split only when it is there.
  sellerDiscount: Number(r.seller_discount ?? 0),
  firstOfferDiscount: Number(r.first_offer_discount ?? 0),
  rejectedBy: r.rejected_by ?? null,
  rejectReason: r.reject_reason ?? null,
  reassignCount: Number(r.reassign_count ?? 0),
  reassignStartedAt: r.reassign_started_at ?? null,
  reassignHistory: parseJson(r.reassign_history, []),
});

export { catalog };

import "./env.js";
import app from "./app.js";
import { migrate } from "./db.js";
import { PORT } from "./config.js";
import { reassignSweep } from "./reassign.js";
try {
  await migrate();
  app.listen(PORT, "0.0.0.0", () => console.log(`API listening on ${PORT}`));
  // Unconfirmed orders (status 1) hop to another store every ten minutes.
  await reassignSweep();
  setInterval(() => void reassignSweep(), 60 * 1000);
} catch (error) {
  console.error("[api] MySQL startup failed:", error);
  // Turn the two most common setup failures into a recipe instead of a stack
  // trace — especially ER_ACCESS_DENIED_ERROR ("using password: NO"), which
  // simply means backend/.env does not carry the credentials of a MySQL
  // account that actually exists.
  if (error?.code === "ER_ACCESS_DENIED_ERROR" || error?.errno === 1045) {
    console.error(`
[api] MySQL rejected the configured credentials (error 1045).
  1. Copy backend/.env.example to backend/.env if you have not yet.
  2. In backend/.env set MYSQL_USER / MYSQL_PASSWORD to a MySQL account that
     exists on your server (the file is read from the backend folder no matter
     where you start the process from).
  3. For the MySQL root account you can set a password with:
       ALTER USER 'root'@'localhost' IDENTIFIED BY 'your-strong-password';
     or create a dedicated account:
       CREATE USER 'nazmarket'@'localhost' IDENTIFIED BY 'your-strong-password';
       GRANT ALL PRIVILEGES ON nazmarket.* TO 'nazmarket'@'localhost';
       FLUSH PRIVILEGES;
  4. Restart the backend (npm run dev inside backend/).
`);
  } else if (error?.code === "ER_BAD_DB_ERROR" || error?.errno === 1049) {
    console.error(`
[api] The configured database does not exist (error 1049).
  Create it once in MySQL:
    CREATE DATABASE nazmarket CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
  then restart the backend.
`);
  } else if (
    ["ECONNREFUSED", "ENOTFOUND", "ETIMEDOUT", "PROTOCOL_CONNECTION_LOST"].includes(
      error?.code,
    )
  ) {
    console.error(`
[api] Cannot reach the MySQL server at MYSQL_HOST:MYSQL_PORT.
  Make sure MySQL 8+ is running and that MYSQL_HOST / MYSQL_PORT in
  backend/.env point at it (defaults: 127.0.0.1:3306).
`);
  }
  process.exitCode = 1;
}

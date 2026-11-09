import "dotenv/config";
import app from "./app.js";
import { migrate } from "./db.js";
import { PORT } from "./config.js";
try {
  await migrate();
  app.listen(PORT, "0.0.0.0", () => console.log(`API listening on ${PORT}`));
} catch (error) {
  console.error("[api] MySQL startup failed:", error);
  process.exitCode = 1;
}

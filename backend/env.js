/**
 * Loads `backend/.env` no matter which directory the process was started from.
 *
 * `import "dotenv/config"` resolves `.env` against `process.cwd()`, so starting
 * the API from the repository root (or from a service manager) silently skipped
 * `backend/.env` and fell back to empty MySQL credentials — which surfaces as
 * `ER_ACCESS_DENIED_ERROR for user 'root'@'localhost' (using password: NO)`.
 * Loading the file relative to this module removes that trap; real environment
 * variables still win over the file (dotenv never overwrites).
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const here = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(here, ".env") });

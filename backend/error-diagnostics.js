import { randomUUID } from "node:crypto";

// Never log Error.message, SQL, request bodies or headers: database errors can
// embed passwords, identity data and entire statements. Keep only stack frames.
export function logApiError(error, log = console.error) {
  const requestId = randomUUID();
  const code = /^[A-Z][A-Z0-9_]{0,63}$/.test(String(error?.code))
    ? error.code
    : "server_error";
  const frames = String(error?.stack || "")
    .split("\n")
    .filter((line) => /^\s+at\s/.test(line))
    .slice(0, 6)
    .join("\n");
  log(`[api] ${requestId} ${code}${frames ? "\n" + frames : ""}`);
  return requestId;
}

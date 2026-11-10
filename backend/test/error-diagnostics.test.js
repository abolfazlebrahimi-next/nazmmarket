import test from "node:test";
import assert from "node:assert/strict";
import { logApiError } from "../error-diagnostics.js";
import fs from "node:fs/promises";
test("API diagnostics correlate failures without logging credentials or SQL", () => {
  const error = new Error("secret-password SELECT * FROM private_data");
  error.code = "ER_BAD_FIELD_ERROR";
  let output;
  const id = logApiError(error, (line) => (output = line));
  assert.match(id, /^[a-f0-9-]{36}$/);
  assert.ok(output.includes(id));
  assert.ok(output.includes("ER_BAD_FIELD_ERROR"));
  assert.ok(output.includes("error-diagnostics.test.js"));
  assert.ok(!output.includes("secret-password"));
  assert.ok(!output.includes("SELECT"));
});
test("development API does not restart on document writes", async () => {
  const pkg = JSON.parse(
    await fs.readFile(new URL("../package.json", import.meta.url), "utf8"),
  );
  assert.equal(pkg.scripts.dev, "node index.js");
});

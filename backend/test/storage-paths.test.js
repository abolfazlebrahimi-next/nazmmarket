import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { uploadDir, privateDir } from "../storage-paths.js";

test("media paths are native absolute paths relative to the backend, not cwd", async () => {
  const backend = fileURLToPath(new URL("../", import.meta.url));
  for (const [directory, name] of [
    [uploadDir, "uploads"],
    [privateDir, "private-uploads"],
  ]) {
    assert.ok(path.isAbsolute(directory));
    assert.equal(
      path.normalize(directory),
      path.join(backend, name) + path.sep,
    );
    if (process.platform === "win32") {
      assert.match(directory, /^[A-Za-z]:\\/);
      assert.doesNotMatch(directory, /^[\\/][A-Za-z]:/);
    }
    await fs.mkdir(directory, { recursive: true });
    assert.ok((await fs.stat(directory)).isDirectory());
  }
});

import test from "node:test";
import assert from "node:assert/strict";
import { PassThrough, Writable } from "node:stream";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { readAdminPassword } from "../admin-password-input.js";
import { verifyPassword } from "../auth.js";

test("interactive password finishes on Enter without waiting for EOF and never echoes", async () => {
  const input = new PassThrough();
  let shown = "";
  const output = new Writable({
    write(chunk, _enc, done) {
      shown += chunk.toString();
      done();
    },
  });
  const pending = readAdminPassword(input, output, true);
  input.write("test-secret-12345\r");
  const password = await pending;
  assert.equal(password, "test-secret-12345");
  assert.equal(input.readableEnded, false, "EOF was not necessary");
  assert.match(shown, /press Enter/);
  assert.ok(!shown.includes(password));
  input.destroy();
});

test("piped input reads one line instead of concatenating duplicate passwords", async () => {
  const input = new PassThrough();
  const pending = readAdminPassword(input, process.stderr, false);
  input.end("first-test-password\r\nsecond-test-password\r\n");
  assert.equal(await pending, "first-test-password");
});

test("empty stdin fails with a useful message", async () => {
  const input = new PassThrough();
  const pending = readAdminPassword(input, process.stderr, false);
  input.end();
  await assert.rejects(pending, /No password entered/);
});

test("CLI keeps bare-hash pipe compatibility and rejects short input", () => {
  const script = fileURLToPath(
    new URL("../hash-admin-password.js", import.meta.url),
  );
  const result = spawnSync(process.execPath, [script], {
    input: "test-password-12345\r\n",
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /^scrypt\$/);
  assert.equal(
    verifyPassword("test-password-12345", result.stdout.trim()),
    true,
  );
  const invalid = spawnSync(process.execPath, [script], {
    input: "short\n",
    encoding: "utf8",
  });
  assert.equal(invalid.status, 1);
  assert.equal(invalid.stdout, "");
  assert.match(invalid.stderr, /at least 12 characters/);
});

// Watch only source directories, not uploads/private documents. This is also
// supported on Windows: no recursive watcher or platform-only --watch-path.
import { shouldRestart } from "./dev-watch.js";
import { watch } from "node:fs";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL(".", import.meta.url));
let child,
  stopping = false,
  restart = false,
  timer;
function start() {
  restart = false;
  console.log(
    "[dev] Starting current backend sources (seller dispatch/self-delivery enabled).",
  );
  child = spawn(process.execPath, ["index.js"], {
    cwd: root,
    stdio: "inherit",
    env: process.env,
  });
  child.on("error", (err) =>
    console.error("[dev] Could not start API:", err.message),
  );
  child.on("exit", (code) => {
    child = null;
    if (stopping) process.exit(0);
    if (restart) start();
    else
      console.log(
        `[dev] API stopped (${code ?? "signal"}). Check the error above; save a source file to retry or restart this command. If port 4000 is already in use, stop the old backend terminal first.`,
      );
  });
}
function changed(_event, filename) {
  if (!shouldRestart(filename)) return;
  clearTimeout(timer);
  timer = setTimeout(() => {
    if (stopping) return;
    restart = true;
    if (child) {
      console.log(
        "[dev] Source changed; restarting API after the previous process exits.",
      );
      child.kill();
    } else start();
  }, 250);
}
const watchers = [
  watch(root, changed),
  watch(new URL("./routes/", import.meta.url), changed),
];
function stop() {
  if (stopping) return;
  stopping = true;
  clearTimeout(timer);
  watchers.forEach((w) => w.close());
  if (child) child.kill();
  else process.exit(0);
}
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
start();

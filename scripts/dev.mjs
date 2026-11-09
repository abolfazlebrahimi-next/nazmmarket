/**
 * Runs the API (:4000) and the Vite dev server (:5173) together.
 * Vite proxies /api → the API, so the browser only ever talks to one origin.
 */
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
const children = [];

function run(name, args, color) {
  const child = spawn(process.execPath, args, {
    cwd: root,
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, FORCE_COLOR: "1" },
  });
  const tag = `\x1b[${color}m[${name}]\x1b[0m`;
  const pipe = (stream) =>
    stream.on("data", (chunk) => {
      String(chunk)
        .split("\n")
        .filter((line) => line.trim().length > 0)
        .forEach((line) => console.log(`${tag} ${line}`));
    });
  pipe(child.stdout);
  pipe(child.stderr);
  child.on("exit", (code) => {
    console.log(`${tag} exited with code ${code ?? 0}`);
    shutdown();
  });
  children.push(child);
  return child;
}

let closing = false;
function shutdown() {
  if (closing) return;
  closing = true;
  children.forEach((child) => child.kill("SIGTERM"));
  setTimeout(() => process.exit(0), 250);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

run("api", ["--watch", "server/index.js"], "33");
run("web", [path.join(root, "node_modules", "vite", "bin", "vite.js")], "36");

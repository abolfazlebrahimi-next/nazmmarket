// Used with non-recursive watchers on backend/ and backend/routes/ only.
export function shouldRestart(filename) {
  const name = filename?.toString() || "";
  return !/[\\/]/.test(name) && (name.endsWith(".js") || name === ".env");
}

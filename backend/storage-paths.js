import { fileURLToPath } from "node:url";

// URL.pathname is not a filesystem path on Windows (/C:/...) and leaves
// escaped spaces/unicode intact. Always decode file URLs with Node's helper.
export const uploadDir = fileURLToPath(new URL("./uploads/", import.meta.url));
export const privateDir = fileURLToPath(
  new URL("./private-uploads/", import.meta.url),
);

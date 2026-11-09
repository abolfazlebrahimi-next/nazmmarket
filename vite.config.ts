import path from "path";
import { fileURLToPath } from "url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const API_TARGET = process.env.API_PROXY_TARGET ?? "http://localhost:4000";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), viteSingleFile()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  server: {
    host: true,
    port: 5173,
    strictPort: false,
    // the preview host (*.e2b.app) must be allowed to load the dev server
    allowedHosts: true,
    proxy: {
      "/api": { target: API_TARGET, changeOrigin: true },
    },
  },
  preview: {
    host: true,
    allowedHosts: true,
    proxy: {
      "/api": { target: API_TARGET, changeOrigin: true },
    },
  },
});

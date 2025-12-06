import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig } from "vite";
import topLevelAwait from "vite-plugin-top-level-await";
import wasm from "vite-plugin-wasm";

export default defineConfig({
  plugins: [react(), tailwindcss(), wasm(), topLevelAwait()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@air-jam/sdk": path.resolve(__dirname, "../../packages/sdk/src"),
    },
  },
  server: {
    host: true,
    port: 5173,
    headers: {
      // Allow this app to be embedded in iframes from any origin
      // Note: X-Frame-Options doesn't support wildcards, so we use CSP instead
      "Content-Security-Policy": "frame-ancestors *;",
    },
    cors: true,
  },
  preview: {
    host: true,
    port: 5173,
    headers: {
      "Content-Security-Policy": "frame-ancestors *;",
    },
    cors: true,
  },
});

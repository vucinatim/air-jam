import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { createAirJamViteConfig } from "create-airjam/runtime/vite-config.mjs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const airJamVite = createAirJamViteConfig();

export default defineConfig({
  ...airJamVite,
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});

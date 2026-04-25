import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { createAirJamViteConfig } from "create-airjam/runtime/vite-config.mjs";
import path from "node:path";
import { defineConfig } from "vite";
import wasm from "vite-plugin-wasm";

const airJamVite = createAirJamViteConfig({ profile: "three" });

export default defineConfig({
  ...airJamVite,
  plugins: [react(), tailwindcss(), wasm()],
  resolve: {
    alias: {
      "@": path.resolve("./src"),
    },
  },
  build: {
    ...airJamVite.build,
    target: "esnext",
  },
});

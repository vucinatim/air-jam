import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { createAirJamViteConfig } from "create-airjam/runtime/vite-config.mjs";
import path from "node:path";
import { defineConfig } from "vite";
import topLevelAwait from "vite-plugin-top-level-await";
import wasm from "vite-plugin-wasm";

const airJamVite = createAirJamViteConfig({ profile: "three" });

export default defineConfig({
  ...airJamVite,
  plugins: [react(), tailwindcss(), wasm(), topLevelAwait()],
  resolve: {
    alias: {
      "@": path.resolve("./src"),
      "@air-jam/sdk": path.resolve("./../../packages/sdk/src"),
    },
  },
  build: {
    ...airJamVite.build,
    target: "esnext",
  },
});

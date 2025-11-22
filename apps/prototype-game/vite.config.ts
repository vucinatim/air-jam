import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@/*": path.resolve(__dirname, "./src"),
      "@air-jam/sdk": path.resolve(__dirname, "../../packages/sdk/src"),
    },
  },
  server: {
    host: true,
    port: 5173,
  },
});

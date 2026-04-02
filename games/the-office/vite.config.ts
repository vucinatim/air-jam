import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.VITE_PORT || 5173);

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    host: true,
    allowedHosts: true,
    port,
    proxy: {
      "/socket.io": {
        target: "http://127.0.0.1:4000",
        ws: true,
        changeOrigin: true,
      },
    },
    headers: {
      // Required for embedding in Air Jam platform iframe
      "Content-Security-Policy": "frame-ancestors *;",
    },
    cors: true,
  },
  preview: {
    host: true,
    allowedHosts: true,
    port,
    headers: {
      "Content-Security-Policy": "frame-ancestors *;",
    },
    cors: true,
  },
});

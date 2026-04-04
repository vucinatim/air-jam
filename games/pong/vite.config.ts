import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import {
  getAirJamDevProxyOptions,
  getAirJamHttpsServerOptions,
} from "create-airjam/runtime/vite-https.mjs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.VITE_PORT || 5173);
const https = getAirJamHttpsServerOptions();
const proxy = getAirJamDevProxyOptions();

const resolveManualChunk = (id: string): string | undefined => {
  if (!id.includes("node_modules")) {
    return undefined;
  }

  if (
    id.includes("/react/") ||
    id.includes("react-router-dom") ||
    id.includes("/zustand/") ||
    id.includes("/howler/") ||
    id.includes("/socket.io-client/") ||
    id.includes("/qrcode/") ||
    id.includes("/zod/")
  ) {
    return "vendor-runtime";
  }

  return undefined;
};

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: resolveManualChunk,
      },
    },
  },
  server: {
    host: true,
    allowedHosts: true,
    https,
    port,
    strictPort: true,
    proxy,
    headers: {
      // Required for embedding in Air Jam platform iframe
      "Content-Security-Policy": "frame-ancestors *;",
    },
    cors: true,
  },
  preview: {
    host: true,
    allowedHosts: true,
    https,
    port,
    strictPort: true,
    headers: {
      "Content-Security-Policy": "frame-ancestors *;",
    },
    cors: true,
  },
});

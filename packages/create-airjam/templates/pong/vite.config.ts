import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const resolveManualChunk = (id: string): string | undefined => {
  if (!id.includes("node_modules")) {
    return undefined;
  }

  if (
    id.includes("/react/") ||
    id.includes("/react-dom/") ||
    id.includes("react-router-dom")
  ) {
    return "react-runtime";
  }

  if (
    id.includes("/zustand/") ||
    id.includes("/howler/") ||
    id.includes("/socket.io-client/") ||
    id.includes("/qrcode/") ||
    id.includes("/zod/")
  ) {
    return "app-runtime";
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
    port: 5173,
    strictPort: true,
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
    port: 5173,
    strictPort: true,
    headers: {
      "Content-Security-Policy": "frame-ancestors *;",
    },
    cors: true,
  },
});

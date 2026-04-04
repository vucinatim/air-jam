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
  if (
    id.includes("/packages/sdk/") ||
    id.includes("/@air-jam/sdk/")
  ) {
    return "airjam-sdk";
  }

  if (!id.includes("node_modules")) {
    return undefined;
  }

  if (
    id.includes("/react/") ||
    id.includes("/react-dom/") ||
    id.includes("react-router-dom") ||
    id.includes("/zod/")
  ) {
    return "vendor-runtime";
  }

  if (
    id.includes("/framer-motion/") ||
    id.includes("/motion/") ||
    id.includes("/@lottiefiles/")
  ) {
    return "motion-runtime";
  }

  if (
    id.includes("/radix-ui/") ||
    id.includes("/lucide-react/") ||
    id.includes("/lucide-animated/") ||
    id.includes("/class-variance-authority/") ||
    id.includes("/clsx/") ||
    id.includes("/tailwind-merge/") ||
    id.includes("/tw-animate-css/") ||
    id.includes("/shadcn/")
  ) {
    return "ui-runtime";
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

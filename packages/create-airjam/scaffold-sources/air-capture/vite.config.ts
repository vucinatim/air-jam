import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig } from "vite";
import topLevelAwait from "vite-plugin-top-level-await";
import wasm from "vite-plugin-wasm";

const resolveManualChunk = (id: string): string | undefined => {
  if (id.includes("node_modules")) {
    if (
      id.includes("@dimforge/rapier3d-compat") ||
      id.includes("@react-three/rapier")
    ) {
      return "rapier-runtime";
    }

    if (
      id.includes("@react-three/drei") ||
      id.includes("three-stdlib") ||
      id.includes("@use-gesture") ||
      id.includes("@react-spring")
    ) {
      return "drei-runtime";
    }

    if (id.includes("@react-three/fiber")) {
      return "fiber-runtime";
    }

    if (id.includes("/three/")) {
      return "three-core";
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
  }

  if (id.includes("/packages/sdk/src/")) {
    return "airjam-sdk";
  }

  return undefined;
};

export default defineConfig({
  plugins: [react(), tailwindcss(), wasm(), topLevelAwait()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@air-jam/sdk": path.resolve(__dirname, "../../packages/sdk/src"),
    },
  },
  build: {
    target: "esnext",
    rollupOptions: {
      output: {
        manualChunks: resolveManualChunk,
      },
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

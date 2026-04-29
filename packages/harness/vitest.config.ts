import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@air-jam/sdk": path.resolve(__dirname, "../sdk/src/index.ts"),
    },
  },
  test: {
    include: ["tests/**/*.test.{ts,tsx}"],
    environment: "jsdom",
    globals: true,
    testTimeout: 10_000,
    fileParallelism: false,
  },
});

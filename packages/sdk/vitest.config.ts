import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
    globals: true,
    testTimeout: 10_000,
    /** Avoid parallel test file pollution of shared jsdom globals (e.g. window.history). */
    fileParallelism: false,
  },
});

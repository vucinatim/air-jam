import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: [
      {
        find: /^@air-jam\/sdk\/(.+)$/,
        replacement: path.resolve(__dirname, "../sdk/src/$1.ts"),
      },
      {
        find: "@air-jam/sdk",
        replacement: path.resolve(__dirname, "../sdk/src/index.ts"),
      },
      {
        find: "@air-jam/harness/dev-control",
        replacement: path.resolve(
          __dirname,
          "../harness/src/core/dev-control.ts",
        ),
      },
      {
        find: "@air-jam/harness",
        replacement: path.resolve(__dirname, "../harness/src/index.ts"),
      },
      {
        find: "@air-jam/devtools-core",
        replacement: path.resolve(__dirname, "../devtools-core/src/index.ts"),
      },
    ],
  },
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
    globals: true,
    testTimeout: 10_000,
    fileParallelism: false,
  },
});

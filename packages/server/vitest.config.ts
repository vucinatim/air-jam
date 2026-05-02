import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const sdkSrcRoot = fileURLToPath(new URL("../sdk/src", import.meta.url));

export default defineConfig({
  resolve: {
    alias: [
      {
        find: /^@air-jam\/sdk$/,
        replacement: `${sdkSrcRoot}/index.ts`,
      },
      {
        find: /^@air-jam\/sdk\/(.*)$/,
        replacement: `${sdkSrcRoot}/$1`,
      },
    ],
  },
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
    globals: true,
    testTimeout: 10_000,
    hookTimeout: 10_000,
  },
});

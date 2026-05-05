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
        replacement: path.resolve(__dirname, "../devtools-core/dist/index.js"),
      },
      {
        find: "@air-jam/devtools-core/agent",
        replacement: path.resolve(__dirname, "../devtools-core/dist/agent.js"),
      },
      {
        find: "@air-jam/devtools-core/context",
        replacement: path.resolve(__dirname, "../devtools-core/dist/context.js"),
      },
      {
        find: "@air-jam/devtools-core/dev",
        replacement: path.resolve(__dirname, "../devtools-core/dist/dev.js"),
      },
      {
        find: "@air-jam/devtools-core/game-session",
        replacement: path.resolve(
          __dirname,
          "../devtools-core/dist/game-session.js",
        ),
      },
      {
        find: "@air-jam/devtools-core/games",
        replacement: path.resolve(__dirname, "../devtools-core/dist/games.js"),
      },
      {
        find: "@air-jam/devtools-core/logs",
        replacement: path.resolve(__dirname, "../devtools-core/dist/logs.js"),
      },
      {
        find: "@air-jam/devtools-core/platform-auth",
        replacement: path.resolve(
          __dirname,
          "../devtools-core/dist/platform-auth.js",
        ),
      },
      {
        find: "@air-jam/devtools-core/quality",
        replacement: path.resolve(
          __dirname,
          "../devtools-core/dist/quality.js",
        ),
      },
      {
        find: "@air-jam/devtools-core/release",
        replacement: path.resolve(
          __dirname,
          "../devtools-core/dist/release.js",
        ),
      },
      {
        find: "@air-jam/devtools-core/visual",
        replacement: path.resolve(__dirname, "../devtools-core/dist/visual.js"),
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

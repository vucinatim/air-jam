import { defineConfig } from "tsup";

export default defineConfig({
  entry: [
    "src/index.ts",
    "src/auth-profile.ts",
    "src/game-media.ts",
    "src/game-app-id.ts",
    "src/game-analytics.ts",
    "src/scaffold.ts",
    "src/ai-pack.ts",
    "src/development.ts",
    "src/documentation.ts",
  ],
  format: ["esm"],
  dts: true,
  clean: true,
  shims: true,
  sourcemap: true,
  platform: "node",
  target: "es2022",
  noExternal: ["@air-jam/env"],
});

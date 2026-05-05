import { defineConfig } from "tsup";

export default defineConfig({
  entry: [
    "src/index.ts",
    "src/agent.ts",
    "src/context.ts",
    "src/dev.ts",
    "src/game-session.ts",
    "src/games.ts",
    "src/logs.ts",
    "src/platform-auth.ts",
    "src/platform-game-media.ts",
    "src/platform-games.ts",
    "src/quality.ts",
    "src/release.ts",
    "src/visual.ts",
  ],
  format: ["esm"],
  dts: true,
  sourcemap: true,
  clean: true,
  target: "es2022",
});

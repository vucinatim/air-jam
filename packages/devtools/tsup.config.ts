import { copyFile } from "node:fs/promises";
import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    "harness/visual": "src/harness/visual.ts",
    "mcp-config": "src/mcp-config.ts",
    agent: "src/agent.ts",
    context: "src/context.ts",
    controller: "src/controller.ts",
    dev: "src/dev.ts",
    "game-session": "src/game-session.ts",
    "game-session-broker": "src/game-session-broker.ts",
    games: "src/games.ts",
    logs: "src/logs.ts",
    "platform-auth": "src/platform-auth.ts",
    "platform-game-media": "src/platform-game-media.ts",
    "platform-games": "src/platform-games.ts",
    quality: "src/quality.ts",
    release: "src/release.ts",
    visual: "src/visual.ts",
    testing: "src/testing.ts",
    dependencies: "src/dependencies.ts",
    "game-runs": "src/game-run-protocol.ts",
    "game-builds": "src/game-build-protocol.ts",
    "source-tree-contract": "src/source-tree-contract.ts",
    "tooling/describe-game": "src/tooling/describe-game.ts",
    "tooling/declaration-hook": "src/tooling/declaration-hook.ts",
    "tooling/hold-runtime-host": "src/tooling/hold-runtime-host.ts",
    "tooling/list-visual-scenarios": "src/tooling/list-visual-scenarios.ts",
    "tooling/managed-dev-supervisor": "src/tooling/managed-dev-supervisor.ts",
    "tooling/game-session-broker": "src/tooling/game-session-broker.ts",
    "tooling/run-visual-capture": "src/tooling/run-visual-capture.ts",
    "tooling/run-test-profile": "src/tooling/run-test-profile.ts",
    "tooling/run-headless-room": "src/tooling/run-headless-room.ts",
    "tooling/process-scope-guard": "src/tooling/process-scope-guard.ts",
    "tooling/seal-game-build": "src/tooling/seal-game-build.ts",
  },
  format: ["esm"],
  dts: true,
  sourcemap: true,
  clean: true,
  target: "es2022",
  platform: "node",
  onSuccess: async () => {
    await copyFile(
      "src/tooling/process-scope-windows.ps1",
      "dist/tooling/process-scope-windows.ps1",
    );
    await copyFile(
      "src/tooling/process-scope-bootstrap.mjs",
      "dist/tooling/process-scope-bootstrap.mjs",
    );
  },
});

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "..",
);

const games = [
  {
    id: "air-capture",
    store: "src/game/stores/match/match-store.ts",
    storeExport: "usePrototypeMatchStore",
  },
  {
    id: "code-review",
    store: "src/game/stores/code-review-store.ts",
    storeExport: "useGameStore",
  },
  {
    id: "last-band-standing",
    store: "src/game/stores/create-store.ts",
    storeExport: "useGameStore",
  },
  {
    id: "minimal",
    store: "src/game/store.ts",
    storeExport: "useMinimalStore",
  },
  {
    id: "pong",
    store: "src/game/stores/pong-store.ts",
    storeExport: "usePongStore",
  },
  {
    id: "the-office",
    store: "src/game/stores/space-store.ts",
    storeExport: "useSpaceStore",
  },
];

test("all scaffoldable games conform to their semantic agent contracts", () => {
  for (const game of games) {
    const gameDir = path.join(repoRoot, "games", game.id);
    const stdout = execFileSync(
      "pnpm",
      [
        "exec",
        "tsx",
        "--tsconfig",
        path.join(gameDir, "tsconfig.json"),
        path.join(
          repoRoot,
          "scripts",
          "repo",
          "runtime",
          "semantic-agent-contract-runner.mts",
        ),
        "--game-id",
        game.id,
        "--game-dir",
        gameDir,
        "--contract",
        "src/game/contracts/agent.ts",
        "--store",
        game.store,
        "--store-export",
        game.storeExport,
      ],
      { cwd: repoRoot, encoding: "utf8" },
    );
    const report = JSON.parse(stdout);
    assert.equal(report.gameId, game.id);
    assert.equal(report.ok, true, JSON.stringify(report.issues, null, 2));
    assert.equal(report.storeDomains.length, 1);
    assert.ok(report.actionNames.length > 0);
  }
});

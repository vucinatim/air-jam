import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { findGamesWithoutPlayerContracts } from "../commands/standards.mjs";

test("every first-party game offers a decision-model player unless explicitly pending", () => {
  assert.deepEqual(findGamesWithoutPlayerContracts(), []);
  const root = mkdtempSync(path.join(os.tmpdir(), "airjam-contract-guard-"));
  try {
    const game = (id, config, profiles) => {
      const dir = path.join(root, "games", id);
      mkdirSync(path.join(dir, "src/testing"), { recursive: true });
      writeFileSync(
        path.join(dir, "airjam-template.json"),
        JSON.stringify({
          id,
          name: id,
          description: id,
          category: "demo",
          status: "maintained",
          scaffold: true,
        }),
      );
      writeFileSync(path.join(dir, "src/airjam.config.ts"), config);
      if (profiles)
        writeFileSync(path.join(dir, "src/testing/profiles.ts"), profiles);
    };
    const declared = 'testing: "./testing/profiles.ts",';
    game("covered", declared, "createAirJamPlayerPolicy(player)");
    game("untested", "agent: agentContract,");
    game("codeonly", declared, "code: policy");
    game("waiting", "agent: agentContract,");
    game("stale", declared, "createAirJamPlayerPolicy(player)");
    assert.deepEqual(
      findGamesWithoutPlayerContracts({
        root,
        pending: { waiting: "reason", stale: "reason" },
      }),
      [
        { game: "codeonly", problem: "offers no decision-model player policy" },
        {
          game: "stale",
          problem:
            "already offers a decision-model player; remove it from the pending list",
        },
        { game: "untested", problem: "declares no test profiles" },
      ],
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

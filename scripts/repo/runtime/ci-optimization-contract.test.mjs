import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import YAML from "yaml";

import {
  buildPerfSanityArgs,
  perfProfiles,
} from "../lib/perf-plan.mjs";
import { findCanonicalViolations } from "../commands/standards.mjs";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
);

test("CI preserves every confidence lane behind one stable required check", () => {
  const source = fs.readFileSync(
    path.join(repoRoot, ".github/workflows/ci.yml"),
    "utf8",
  );
  const workflow = YAML.parse(source);
  const lanes = workflow.jobs.validate.strategy.matrix.include;

  assert.deepEqual(
    lanes.map((lane) => lane.name),
    [
      "Static contracts",
      "Type safety",
      "Tests",
      "Workspace build",
      "Standalone deployment",
      "Performance smoke",
    ],
  );
  assert.match(lanes[0].command, /platform generated check/u);
  assert.match(lanes[0].command, /pnpm lint/u);
  assert.match(lanes[0].command, /pnpm guard:canonical/u);
  assert.equal(lanes[1].command, "pnpm typecheck");
  assert.equal(lanes[2].command, "pnpm test");
  assert.equal(lanes[3].command, "pnpm build");
  assert.equal(lanes[4].command, "pnpm check:platform:deploy");
  assert.match(lanes[5].command, /perf sanity --profile ci/u);
  assert.deepEqual(
    lanes.map((lane) => lane.history),
    [1, 1, 0, 1, 1, 1],
  );
  assert.equal(workflow.jobs.validate.strategy["fail-fast"], false);
  assert.equal(workflow.jobs.checks.name, "checks");
  assert.equal(workflow.jobs.checks.needs, "validate");
});

test("CI runs once at the protected PR boundary and cancels stale revisions", () => {
  const source = fs.readFileSync(
    path.join(repoRoot, ".github/workflows/ci.yml"),
    "utf8",
  );
  const workflow = YAML.parse(source);

  assert.ok(workflow.on.pull_request !== undefined);
  assert.ok(workflow.on.workflow_dispatch !== undefined);
  assert.equal(workflow.on.push, undefined);
  assert.equal(workflow.concurrency["cancel-in-progress"], true);
});

test("named performance profiles make PR smoke strict and release proof full", () => {
  assert.equal(perfProfiles.ci.durationMs, 15_000);
  assert.equal(perfProfiles.ci.strict, true);
  assert.deepEqual(perfProfiles.release, { strict: true });

  assert.deepEqual(buildPerfSanityArgs({ profile: "ci" }), [
    "--filter",
    "server",
    "perf:sanity",
    "--",
    "--durationMs=15000",
    "--warmupMs=1000",
    "--reconnectCycles=5",
    "--strict",
  ]);
  assert.deepEqual(buildPerfSanityArgs({ profile: "release" }), [
    "--filter",
    "server",
    "perf:sanity",
    "--",
    "--strict",
  ]);
  assert.throws(
    () => buildPerfSanityArgs({ profile: "unknown" }),
    /Unknown performance profile/u,
  );
});

test("the canonical guard has no external ripgrep runtime dependency", () => {
  const source = fs.readFileSync(
    path.join(repoRoot, "scripts/repo/commands/standards.mjs"),
    "utf8",
  );
  const workflow = fs.readFileSync(
    path.join(repoRoot, ".github/workflows/ci.yml"),
    "utf8",
  );

  assert.doesNotMatch(source, /runCommandResult\("rg"/u);
  assert.doesNotMatch(workflow, /Install ripgrep|apt-get install -y ripgrep/u);
});

test("the self-contained canonical scanner preserves multiline rule matching", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "airjam-canonical-"));
  try {
    fs.mkdirSync(path.join(root, "src"));
    fs.writeFileSync(
      path.join(root, "src/example.ts"),
      'import {\n  AirJamProvider,\n} from "@air-jam/sdk";\n',
    );

    assert.deepEqual(
      findCanonicalViolations({
        root,
        rules: [
          {
            label: "forbidden provider",
            pattern:
              "import\\s*{[^}]*\\bAirJamProvider\\b[^}]*}\\s*from\\s*[\"\\']@air-jam/sdk[\"\\']",
            paths: ["src"],
          },
        ],
      }),
      [
        {
          file: "src/example.ts",
          label: "forbidden provider",
          line: 1,
          excerpt: 'import { AirJamProvider, } from "@air-jam/sdk"',
        },
      ],
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

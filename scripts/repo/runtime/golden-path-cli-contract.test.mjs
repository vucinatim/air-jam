import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  defaultGoldenPathManifestPath,
  readGoldenPathProgram,
  validateGoldenPathProgram,
} from "../lib/golden-path-program.mjs";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
);
const cliPath = path.join(repoRoot, "scripts", "repo", "cli.mjs");

const runJson = (...args) =>
  JSON.parse(
    execFileSync(process.execPath, [cliPath, ...args, "--json"], {
      cwd: repoRoot,
      encoding: "utf8",
    }),
  );

test("golden path is a discoverable machine-readable repo CLI surface", () => {
  const rootHelp = execFileSync(process.execPath, [cliPath, "--help"], {
    cwd: repoRoot,
    encoding: "utf8",
  });
  const help = execFileSync(
    process.execPath,
    [cliPath, "golden-path", "--help"],
    {
      cwd: repoRoot,
      encoding: "utf8",
    },
  );

  assert.match(rootHelp, /golden-path/);
  assert.match(help, /spec/);
  assert.match(help, /validate/);
  assert.match(help, /bootstrap/);
  assert.match(help, /run-primary/);
});

test("canonical golden-path program validates its clients, stages, and evidence contract", () => {
  const program = readGoldenPathProgram(defaultGoldenPathManifestPath);
  const spec = runJson("golden-path", "spec");
  const validation = runJson("golden-path", "validate");

  assert.equal(spec.id, program.id);
  assert.equal(spec.clients.primary.profile, "codex");
  assert.equal(spec.clients.secondary.profile, "claude-desktop");
  assert.equal(spec.publication.productionAllowed, false);
  assert.equal(spec.stages[0].id, "preflight");
  assert.equal(spec.stages.at(-1).id, "verify");
  assert.deepEqual(validation, {
    ok: true,
    id: program.id,
    manifest: "scripts/repo/programs/v1-external-agent-golden-path.json",
    stages: program.stages.length,
    evidenceFormat: "air-jam-golden-path-evidence/v1",
  });
});

test("golden-path validation rejects unsafe publication and malformed stage order", () => {
  const source = readGoldenPathProgram(defaultGoldenPathManifestPath);
  const productionProgram = structuredClone(source);
  productionProgram.publication.productionAllowed = true;
  assert.throws(
    () =>
      validateGoldenPathProgram(productionProgram, {
        validateReferencedFiles: false,
      }),
    /productionAllowed must be false/,
  );

  const malformedProgram = structuredClone(source);
  malformedProgram.stages[0].id = "bootstrap";
  assert.throws(
    () =>
      validateGoldenPathProgram(malformedProgram, {
        validateReferencedFiles: false,
      }),
    /Golden-path stages must be exactly/,
  );
});

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  buildCodexPermissionArgs,
  buildGoldenPathCommandEnv,
} from "../lib/golden-path-primary-run.mjs";
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

test("primary-run isolation permits only run-owned writes and declared network targets", () => {
  const runRoot = "/tmp/airjam-golden-path-contract-run";
  const stagingUrl = "https://air-jam-platform-pr-123.example.test";
  const permissions = buildCodexPermissionArgs({ runRoot, stagingUrl });
  const joinedArgs = permissions.args.join("\n");

  assert.match(joinedArgs, /network_proxy/);
  assert.match(joinedArgs, /approval_policy="never"/);
  assert.doesNotMatch(joinedArgs, /approve-for-me/);
  assert.match(joinedArgs, /allow_local_binding=true/);
  assert.match(joinedArgs, /air-jam-platform-pr-123\.example\.test/);
  assert.match(joinedArgs, /127\.0\.0\.1/);
  assert.match(joinedArgs, /localhost/);
  assert.deepEqual(permissions.profile.deniedReadRoots, ["<repo>"]);
  assert.equal(permissions.profile.network.managedProxy, true);
  assert.equal(permissions.profile.network.allowLocalBinding, true);
  assert.equal(permissions.profile.loginShellAllowed, false);
  assert.deepEqual(permissions.profile.writableRoots, [
    "<run>/evidence",
    "<run>/state",
    "<run>/cache",
    "<run>/npm-cache",
    "<run>/pnpm-store",
  ]);
});

test("primary-run child environment drops inherited credentials and isolates caches", () => {
  const runRoot = "/tmp/airjam-golden-path-contract-run";
  const environment = buildGoldenPathCommandEnv({
    stagingUrl: "https://air-jam-platform-pr-123.example.test",
    runRoot,
    registryUrl: "http://127.0.0.1:4873",
    sourceEnv: {
      PATH: process.env.PATH,
      USER: "external-agent",
      OPENAI_API_KEY: "must-not-cross-boundary",
      RAILWAY_TOKEN: "must-not-cross-boundary",
    },
  });

  assert.equal(environment.OPENAI_API_KEY, undefined);
  assert.equal(environment.RAILWAY_TOKEN, undefined);
  assert.equal(environment.AIRJAM_STATE_DIR, `${runRoot}/state`);
  assert.equal(environment.XDG_CACHE_HOME, `${runRoot}/cache`);
  assert.equal(environment.npm_config_cache, `${runRoot}/npm-cache`);
  assert.equal(environment.pnpm_config_store_dir, `${runRoot}/pnpm-store`);
});

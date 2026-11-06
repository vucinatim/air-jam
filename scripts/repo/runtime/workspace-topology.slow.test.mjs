import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const cliPath = fileURLToPath(new URL("../cli.mjs", import.meta.url));

const createWorkspace = (context) => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "airjam-topology-"));
  context.after(() => fs.rmSync(rootDir, { recursive: true, force: true }));
  const gameDir = path.join(rootDir, "games/pong");
  fs.mkdirSync(gameDir, { recursive: true });
  fs.mkdirSync(path.join(rootDir, "games/not-a-game"));
  fs.writeFileSync(path.join(rootDir, "games/file"), "");
  fs.writeFileSync(path.join(gameDir, "airjam-template.json"), "{}");
  fs.writeFileSync(
    path.join(gameDir, ".env"),
    "VITE_AIR_JAM_PUBLIC_HOST=https://game.example.test\nVITE_AIR_JAM_SERVER_URL=https://server.example.test\n",
  );
  const preloadPath = path.join(rootDir, "no-subprocesses.mjs");
  fs.writeFileSync(
    preloadPath,
    `import childProcess from "node:child_process";
import { syncBuiltinESMExports } from "node:module";
for (const name of ["spawn", "spawnSync", "execFile", "execFileSync"]) {
  childProcess[name] = () => { throw new Error("Topology must not spawn builds or game loaders."); };
}
syncBuiltinESMExports();
`,
  );
  return (gameId, mode, extraArgs = []) =>
    spawnSync(
      process.execPath,
      [
        "--import",
        preloadPath,
        cliPath,
        "workspace",
        "topology",
        `--game=${gameId}`,
        `--mode=${mode}`,
        ...extraArgs,
      ],
      { cwd: rootDir, env: {}, encoding: "utf8", timeout: 5_000 },
    );
};

for (const mode of [
  "standalone-dev",
  "self-hosted-production",
  "hosted-release",
]) {
  test(`repo topology resolves ${mode} from game environment without builds or a declaration loader`, (context) => {
    const run = createWorkspace(context);
    const result = run("pong", mode);
    assert.equal(result.status, 0, result.stderr);
    const topology = JSON.parse(result.stdout);
    assert.equal(topology.mode, mode);
    assert.equal(topology.secure, false);
    assert.equal(topology.surfaces.host.appOrigin, "https://game.example.test");
    assert.equal(
      topology.surfaces.controller.backendOrigin,
      "https://server.example.test",
    );
  });
}

test("repo topology rejects unknown game directories and path traversal", (context) => {
  const run = createWorkspace(context);
  for (const gameId of [
    "missing",
    "not-a-game",
    "file",
    "../pong",
    "pong/..",
    ".",
  ]) {
    const result = run(gameId, "standalone-dev");
    assert.equal(result.status, 1, result.stderr);
    assert.match(result.stderr, /Unknown game/);
    assert.equal(result.stdout, "");
  }
});

test("repo topology forwards secure mode restrictions to the runtime resolver", (context) => {
  const run = createWorkspace(context);
  const result = run("pong", "hosted-release", ["--secure"]);
  assert.equal(result.status, 1, result.stderr);
  assert.match(
    result.stderr,
    /--secure is only supported with --mode=standalone-dev/,
  );
});

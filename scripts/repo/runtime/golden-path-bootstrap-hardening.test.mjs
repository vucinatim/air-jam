import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { acquireWorkspaceBuildLock } from "../../ensure-workspace-package-build.mjs";
import { verifyMcpStdioHandshake } from "../../lib/mcp-stdio-handshake.mjs";
import {
  assertInstalledCandidateIntegrity,
  resolveGoldenPathTemporaryRoot,
} from "../lib/golden-path-bootstrap.mjs";

const candidateIntegrity = `sha512-${Buffer.from("candidate").toString("base64")}`;
const lockSource = `
lockfileVersion: '9.0'
importers:
  .:
    dependencies:
      '@air-jam/sdk':
        specifier: ^0.9.2
        version: 0.9.2
packages:
  '@air-jam/sdk@0.9.2':
    resolution:
      integrity: ${candidateIntegrity}
`;

test("candidate provenance requires the exact packed integrity", () => {
  assert.doesNotThrow(() =>
    assertInstalledCandidateIntegrity({
      lockSource,
      packageArtifacts: [
        {
          name: "@air-jam/sdk",
          version: "0.9.2",
          integrity: candidateIntegrity,
        },
      ],
    }),
  );

  assert.throws(
    () =>
      assertInstalledCandidateIntegrity({
        lockSource,
        packageArtifacts: [
          {
            name: "@air-jam/sdk",
            version: "0.9.2",
            integrity: "sha512-not-the-candidate",
          },
        ],
      }),
    /does not match the packed candidate/u,
  );
});

test("golden-path temporary roots prefer explicit and runner-owned paths", () => {
  const fixtureRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), "airjam-golden-path-temp-root-test-"),
  );
  const explicitRoot = path.join(fixtureRoot, "explicit");
  const runnerRoot = path.join(fixtureRoot, "runner");

  try {
    assert.equal(
      resolveGoldenPathTemporaryRoot({
        environment: {
          AIRJAM_GOLDEN_PATH_TEMP_ROOT: explicitRoot,
          RUNNER_TEMP: runnerRoot,
        },
      }),
      fs.realpathSync.native(explicitRoot),
    );
    assert.equal(
      resolveGoldenPathTemporaryRoot({
        environment: { RUNNER_TEMP: runnerRoot },
      }),
      fs.realpathSync.native(runnerRoot),
    );
  } finally {
    fs.rmSync(fixtureRoot, { recursive: true, force: true });
  }
});

test("MCP protocol probe rejects non-JSON stdout without crashing", async () => {
  const fakeServer = [
    'process.stdin.once("data", () => {',
    '  process.stdout.write("not-json\\n");',
    "});",
    "setInterval(() => {}, 1_000);",
  ].join("\n");

  await assert.rejects(
    verifyMcpStdioHandshake({
      cwd: process.cwd(),
      env: process.env,
      command: process.execPath,
      args: ["--input-type=module", "--eval", fakeServer],
      clientInfo: { name: "test-client", version: "1.0.0" },
      label: "Fake MCP server",
      requestTimeoutMs: 1_000,
      shutdownTimeoutMs: 100,
    }),
    /emitted non-JSON stdout/u,
  );
});

test("MCP protocol probe preserves bounded stderr when a candidate exits", async () => {
  const fakeServer = [
    'process.stderr.write("candidate startup diagnostic\\n");',
    "process.exit(7);",
  ].join("\n");

  await assert.rejects(
    verifyMcpStdioHandshake({
      cwd: process.cwd(),
      env: process.env,
      command: process.execPath,
      args: ["--input-type=module", "--eval", fakeServer],
      clientInfo: { name: "test-client", version: "1.0.0" },
      label: "Fake MCP server",
      requestTimeoutMs: 1_000,
      shutdownTimeoutMs: 100,
    }),
    /exited unexpectedly with code 7\.\ncandidate startup diagnostic/u,
  );
});

test("workspace package build lock wait is bounded", async () => {
  const runRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), "airjam-workspace-build-lock-test-"),
  );
  const lockDir = path.join(runRoot, "held.lock");
  fs.mkdirSync(lockDir);

  try {
    await assert.rejects(
      acquireWorkspaceBuildLock(lockDir, {
        timeoutMs: 25,
        pollIntervalMs: 5,
      }),
      /Timed out after 25ms/u,
    );
  } finally {
    fs.rmSync(runRoot, { recursive: true, force: true });
  }
});

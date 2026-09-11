import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { startSharedWorkspaceProcesses } from "../../../packages/devtools-core/runtime/workspace-dev-commands.mjs";
import { createWorkspaceProcessGroup } from "../../../packages/devtools-core/runtime/workspace-stack.mjs";

const createTestGroup = (context) => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "airjam-readiness-"));
  const listeners = new Map(
    ["SIGINT", "SIGTERM"].map((signal) => [signal, process.listeners(signal)]),
  );
  const previousCwd = process.cwd();
  let group;
  try {
    // The existing workspace log sink resolves its file from the working dir.
    process.chdir(rootDir);
    group = createWorkspaceProcessGroup({ rootDir, exitOnShutdown: false });
  } finally {
    process.chdir(previousCwd);
  }
  context.after(async () => {
    await group.shutdown();
    for (const [signal, previous] of listeners) {
      for (const listener of process.listeners(signal)) {
        if (!previous.includes(listener)) process.off(signal, listener);
      }
    }
    fs.rmSync(rootDir, { recursive: true, force: true });
  });
  return group;
};

test("workspace consumers start only after the SDK generation is ready", async () => {
  const calls = [];
  let finishSdkBuild;
  const sdkReady = new Promise((resolve) => {
    finishSdkBuild = resolve;
  });
  const processGroup = {
    run: (...args) => {
      calls.push(args);
      return args[0] === "sdk" ? sdkReady : Promise.resolve();
    },
  };
  const starting = startSharedWorkspaceProcesses({
    processGroup,
    activeGame: { id: "pong", dir: "games/pong" },
    includePlatform: true,
    gameArgs: ["--web-only"],
  });
  assert.deepEqual(
    calls.map(([name]) => name),
    ["sdk"],
  );
  assert.equal(calls[0][3].readyMarker, "AIR_JAM_SDK_BUILD_READY");
  finishSdkBuild();
  await starting;
  assert.deepEqual(
    calls.map(([name]) => name),
    ["sdk", "server", "platform", "pong"],
  );
});

test("failed SDK readiness never starts dependent services", async () => {
  const calls = [];
  await assert.rejects(
    startSharedWorkspaceProcesses({
      processGroup: {
        run: (name) => {
          calls.push(name);
          return Promise.reject(new Error("SDK build failed"));
        },
      },
      activeGame: { id: "pong", dir: "games/pong" },
      includePlatform: false,
      gameArgs: [],
    }),
    /SDK build failed/,
  );
  assert.deepEqual(calls, ["sdk"]);
});

test(
  "readiness waits for a complete marker even across stdout chunks",
  { timeout: 5_000 },
  async (context) => {
    const group = createTestGroup(context);
    await group.run(
      "sdk-fixture",
      process.execPath,
      [
        "-e",
        `
    process.stdout.write("starting\\nAIR_JAM_SDK_");
    setTimeout(() => process.stdout.write("BUILD_READY\\n"), 40);
    setInterval(() => {}, 1000);
  `,
      ],
      { readyMarker: "AIR_JAM_SDK_BUILD_READY" },
    );
  },
);

test(
  "exit before readiness rejects instead of hanging",
  { timeout: 5_000 },
  async (context) => {
    const group = createTestGroup(context);
    await assert.rejects(
      group.run("failed-sdk", process.execPath, ["-e", "process.exit(2)"], {
        readyMarker: "AIR_JAM_SDK_BUILD_READY",
      }),
      /failed-sdk exited before becoming ready \(2\)/,
    );
  },
);

test(
  "spawn failure rejects readiness and shuts down cleanly",
  { timeout: 5_000 },
  async (context) => {
    const group = createTestGroup(context);
    await assert.rejects(
      group.run("missing-sdk", "airjam-test-executable-does-not-exist", [], {
        readyMarker: "AIR_JAM_SDK_BUILD_READY",
      }),
      /ENOENT/,
    );
  },
);

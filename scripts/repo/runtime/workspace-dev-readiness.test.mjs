import assert from "node:assert/strict";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { startSharedWorkspaceProcesses } from "../../workspace/commands/dev.mjs";
import {
  assertWorkspacePortsAvailable,
  createWorkspaceProcessGroup,
} from "../../workspace/lib/workspace-stack.mjs";

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
    gameArgs: ["--web-only"],
    serverPort: 4311,
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
    ["sdk", "server", "pong"],
  );
  assert.deepEqual(calls[1][3].env, { PORT: "4311" });
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
      gameArgs: [],
      serverPort: 4311,
    }),
    /SDK build failed/,
  );
  assert.deepEqual(calls, ["sdk"]);
});

test("a conflicting port is rejected without stopping its owner", async (context) => {
  const server = net.createServer((socket) =>
    socket.end("owner remains alive"),
  );
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  context.after(() => new Promise((resolve) => server.close(resolve)));
  await assert.rejects(
    assertWorkspacePortsAvailable({ ports: [server.address().port] }),
    /unavailable/,
  );
  assert.equal(server.listening, true);
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

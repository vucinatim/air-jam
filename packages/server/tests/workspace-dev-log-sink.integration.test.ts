import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

describe("workspace dev log sink", () => {
  let tempDir = "";

  afterEach(async () => {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
      tempDir = "";
    }
  });

  it("emits normalized workspace events and suppresses duplicated structured server output", async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), "air-jam-workspace-log-sink-"));
    const logFilePath = path.join(tempDir, "dev-latest.ndjson");
    const modulePath = fileURLToPath(
      new URL("../../../scripts/workspace/lib/workspace-dev-log-sink.mjs", import.meta.url),
    );
    const { createWorkspaceDevLogSink } = await import(pathToFileURL(modulePath).href);

    const sink = createWorkspaceDevLogSink({ logFilePath });

    sink.recordStart({
      processName: "server",
      tool: "pnpm",
      command: "pnpm --filter @air-jam/server dev",
      cwd: "/repo",
      pid: 4321,
    });
    sink.captureChunk({
      processName: "server",
      stream: "stdout",
      chunk:
        '{"level":"info","msg":"Host bootstrap verified","event":"host.bootstrap.verified"}\n',
      tool: "pnpm",
      command: "pnpm --filter @air-jam/server dev",
      cwd: "/repo",
      suppressStructuredServerLogs: true,
    });
    sink.captureChunk({
      processName: "server",
      stream: "stderr",
      chunk: "Raw server stderr failure\n",
      tool: "pnpm",
      command: "pnpm --filter @air-jam/server dev",
      cwd: "/repo",
      suppressStructuredServerLogs: true,
    });
    sink.captureChunk({
      processName: "platform",
      stream: "stderr",
      chunk: "Failed to compile route\n",
      tool: "pnpm",
      command: "pnpm --filter platform dev",
      cwd: "/repo",
    });
    sink.flush({
      processName: "server",
      tool: "pnpm",
      command: "pnpm --filter @air-jam/server dev",
      cwd: "/repo",
    });
    sink.flush({
      processName: "platform",
      tool: "pnpm",
      command: "pnpm --filter platform dev",
      cwd: "/repo",
    });
    sink.recordExit({
      processName: "server",
      tool: "pnpm",
      command: "pnpm --filter @air-jam/server dev",
      cwd: "/repo",
      pid: 4321,
      code: 1,
      signal: null,
    });

    const events = (await readFile(logFilePath, "utf8"))
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line) as Record<string, unknown>);

    expect(events.map((event) => event.event)).toEqual([
      "workspace.process.started",
      "workspace.process.output",
      "workspace.process.output",
      "workspace.process.exit",
    ]);
    expect(events[0]).toMatchObject({
      source: "workspace",
      event: "workspace.process.started",
      processName: "server",
      tool: "pnpm",
      command: "pnpm --filter @air-jam/server dev",
      cwd: "/repo",
      data: { pid: 4321 },
    });
    expect(events[1]).toMatchObject({
      event: "workspace.process.output",
      processName: "server",
      stream: "stderr",
      level: "warn",
      msg: "Raw server stderr failure",
    });
    expect(events[2]).toMatchObject({
      event: "workspace.process.output",
      processName: "platform",
      stream: "stderr",
      level: "error",
      msg: "Failed to compile route",
    });
    expect(events[3]).toMatchObject({
      event: "workspace.process.exit",
      processName: "server",
      level: "error",
      data: { pid: 4321, code: 1, signal: null },
    });
    expect(events.some((event) => event.msg === "Host bootstrap verified")).toBe(false);
  });
});

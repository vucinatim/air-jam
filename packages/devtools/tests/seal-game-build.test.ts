import type { ChildProcess } from "node:child_process";
import { createHash } from "node:crypto";
import { EventEmitter } from "node:events";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { PassThrough } from "node:stream";
import { afterEach, expect, it, vi } from "vitest";
import { sealGameBuild } from "../src/game-build.js";
import { MAXIMUM_GAME_RUN_BUILD_LOG_BYTES } from "../src/game-run-protocol.js";
import { closeAfterProcessFailure } from "../src/managed-process-scope.js";

const processes = vi.hoisted(() => ({ spawn: vi.fn(), close: vi.fn() }));
vi.mock("../src/managed-process-scope.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../src/managed-process-scope.js")>()),
  spawnScopedProcess: processes.spawn,
  closeScopedProcess: processes.close,
}));
const directories: string[] = [];
afterEach(async () => {
  vi.resetAllMocks();
  await Promise.all(
    directories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});
async function fixture() {
  const directory = await mkdtemp(
    path.join(os.tmpdir(), "airjam-build-diagnostics-"),
  );
  directories.push(directory);
  const child = Object.assign(new EventEmitter(), {
    stdout: new PassThrough(),
    stderr: new PassThrough(),
  }) as unknown as ChildProcess;
  processes.spawn.mockResolvedValue(child);
  processes.close.mockImplementation(async () => {
    child.stdout?.emit(
      "data",
      Buffer.from("final diagnostic delivered after tree cleanup\n"),
    );
    child.stdout?.push(null);
    child.stderr?.push(null);
  });
  const receipt = vi.fn();
  const onScope = vi.fn();
  const pending = sealGameBuild({
    projectDir: directory,
    configRelative: "airjam.config.ts",
    runDirectory: directory,
    signal: new AbortController().signal,
    onBuildLog: receipt,
    onScope,
  });
  await vi.waitFor(() => expect(child.listenerCount("message")).toBe(1));
  return { directory, child, receipt, onScope, pending };
}
it("retains bounded original compiler diagnostics even when no build can be sealed", async () => {
  const f = await fixture();
  const rejected = expect(f.pending).rejects.toThrow("compiler failed");
  const output = Buffer.from(
    "TypeScript: compiler failed\n" +
      "x".repeat(MAXIMUM_GAME_RUN_BUILD_LOG_BYTES),
  );
  f.child.stderr?.emit("data", output);
  f.child.emit("message", {
    type: "air-jam-game-build/v1",
    ok: false,
    error: "compiler failed",
  });
  await rejected;
  const bytes = await readFile(path.join(f.directory, "build.log"));
  expect(bytes).toEqual(output.subarray(0, MAXIMUM_GAME_RUN_BUILD_LOG_BYTES));
  expect(f.receipt).toHaveBeenCalledExactlyOnceWith({
    bytes: bytes.length,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    truncated: true,
  });
  expect(processes.spawn.mock.calls[0]?.[1].onScope).toBe(f.onScope);
  expect(processes.close).toHaveBeenCalledExactlyOnceWith(f.child);
});
it("keeps the compiler failure and unconfirmed process cleanup together", async () => {
  const f = await fixture();
  const cleanup = new Error("guardian unavailable");
  processes.close.mockRejectedValue(cleanup);
  const rejected = expect(f.pending).rejects.toMatchObject({
    errors: [expect.objectContaining({ message: "compiler failed" }), cleanup],
  });
  f.child.stderr?.emit("data", Buffer.from("original compiler output"));
  f.child.emit("message", {
    type: "air-jam-game-build/v1",
    ok: false,
    error: "compiler failed",
  });
  await rejected;
  expect(await readFile(path.join(f.directory, "build.log"), "utf8")).toBe(
    "original compiler output",
  );
  expect(f.receipt).toHaveBeenCalledOnce();
});
it("does not replace a startup error when process cleanup succeeds", async () => {
  const primary = new Error("startup failed");
  await expect(closeAfterProcessFailure(async () => {}, primary)).rejects.toBe(
    primary,
  );
});

it("drains the final compiler pipe bytes after process cleanup before signing diagnostics", async () => {
  const f = await fixture();
  processes.close.mockImplementation(async () => {
    setImmediate(() => {
      f.child.stderr?.emit("data", Buffer.from("delayed final diagnostic"));
      f.child.stdout?.push(null);
      f.child.stderr?.push(null);
    });
  });
  const rejected = expect(f.pending).rejects.toThrow("compiler failed");
  f.child.emit("message", {
    type: "air-jam-game-build/v1",
    ok: false,
    error: "compiler failed",
  });
  await rejected;
  expect(await readFile(path.join(f.directory, "build.log"), "utf8")).toBe(
    "delayed final diagnostic",
  );
  expect(f.receipt).toHaveBeenCalledExactlyOnceWith(
    expect.objectContaining({
      bytes: Buffer.byteLength("delayed final diagnostic"),
    }),
  );
});

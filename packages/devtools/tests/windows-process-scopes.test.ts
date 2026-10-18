import { ChildProcess, spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { PassThrough } from "node:stream";
import { afterEach, expect, it, vi } from "vitest";
import { spawnScopedProcess } from "../src/managed-process-scope.js";
import { WindowsProcessScopes } from "../src/windows-process-scopes.js";

vi.mock("node:child_process", async (importOriginal) => ({
  ...(await importOriginal<typeof import("node:child_process")>()),
  spawn: vi.fn(),
}));

const streams: PassThrough[] = [];
afterEach(() => {
  for (const stream of streams.splice(0)) stream.destroy();
  vi.restoreAllMocks();
  vi.clearAllMocks();
  vi.useRealTimers();
});

function guardian() {
  const child = new ChildProcess();
  const input = new PassThrough();
  const output = new PassThrough();
  const errors = new PassThrough();
  streams.push(input, output, errors);
  Object.defineProperties(child, {
    stdin: { value: input },
    stdout: { value: output },
    stderr: { value: errors },
  });
  const kill = vi.spyOn(child, "kill").mockImplementation(() => {
    queueMicrotask(() => child.emit("exit", 1, null));
    return true;
  });
  vi.mocked(spawn).mockReturnValue(child);
  return { child, output, errors, kill };
}

it("rejects malformed startup immediately and closes the Windows job owner", async () => {
  const process = guardian();
  const opening = WindowsProcessScopes.open();
  process.errors.write("helper phase: compiled");
  process.output.write('\uFEFF{"kind":"ready"}\n');
  await expect(opening).rejects.toThrow(
    /Invalid Windows guardian response.*stdout prefix efbbbf.*compiled/,
  );
  expect(process.kill).toHaveBeenCalledTimes(1);
});

it("fails closed when an established guardian breaks its protocol", async () => {
  const process = guardian();
  const opening = WindowsProcessScopes.open();
  process.output.write('{"kind":"ready"}\n');
  const owner = await opening;
  process.output.write("not a protocol response\n");
  await expect(owner.create(randomUUID())).rejects.toThrow(
    "Invalid Windows guardian response",
  );
  expect(process.kill).toHaveBeenCalledTimes(1);
});

it("explains the Windows prerequisite when pwsh is missing", async () => {
  const process = guardian();
  const opening = WindowsProcessScopes.open();
  process.child.emit("error", new Error("spawn pwsh.exe ENOENT"));
  await expect(opening).rejects.toThrow("winget install Microsoft.PowerShell");
  expect(vi.mocked(spawn).mock.calls.at(-1)?.[0]).toBe("pwsh.exe");
});

it("propagates startup failure before admitting any authored helper", async () => {
  const process = guardian();
  const opening = spawnScopedProcess(["unused.mjs"], { cwd: "." });
  process.child.emit("message", {
    kind: "startup-error",
    message: "fixture prerequisite is missing",
  });
  await expect(opening).rejects.toThrow("fixture prerequisite is missing");
  expect(spawn).toHaveBeenCalledTimes(1);
});

it("terminates a Windows helper that never becomes ready", async () => {
  vi.useFakeTimers();
  const process = guardian();
  const opening = WindowsProcessScopes.open(50);
  const rejected = expect(opening).rejects.toThrow(
    "Windows job guardian startup timed out",
  );
  await vi.advanceTimersByTimeAsync(50);
  await rejected;
  expect(process.kill).toHaveBeenCalledTimes(1);
});

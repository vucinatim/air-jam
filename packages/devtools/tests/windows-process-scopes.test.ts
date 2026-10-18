import { ChildProcess, spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { PassThrough } from "node:stream";
import { afterEach, expect, it, vi } from "vitest";
import { WindowsProcessScopes } from "../src/windows-process-scopes.js";

vi.mock("node:child_process", async (importOriginal) => ({
  ...(await importOriginal<typeof import("node:child_process")>()),
  spawn: vi.fn(),
}));

const streams: PassThrough[] = [];
afterEach(() => {
  for (const stream of streams.splice(0)) stream.destroy();
  vi.restoreAllMocks();
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

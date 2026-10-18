import { ChildProcess, spawn } from "node:child_process";
import { afterEach, expect, it, vi } from "vitest";

vi.mock("node:child_process", async (importOriginal) => ({
  ...(await importOriginal<typeof import("node:child_process")>()),
  spawn: vi.fn(),
}));
afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

it("cancels one preparation waiter without poisoning another caller", async () => {
  vi.resetModules();
  const { prepareProcessScopes, assertProcessScopesConfirmed } =
    await import("../src/managed-process-scope.js");
  const child = new ChildProcess();
  vi.mocked(spawn).mockReturnValue(child);
  const cancellation = new AbortController();
  const reason = new Error("caller stopped");
  const canceled = prepareProcessScopes(cancellation.signal);
  const continuing = prepareProcessScopes();
  const rejected = expect(canceled).rejects.toBe(reason);
  cancellation.abort(reason);
  await rejected;
  child.emit("message", { kind: "ready" });
  await continuing;
  expect(assertProcessScopesConfirmed).not.toThrow();
  expect(spawn).toHaveBeenCalledTimes(1);
});

it("does not start a guardian for an already canceled caller", async () => {
  vi.resetModules();
  const { prepareProcessScopes } =
    await import("../src/managed-process-scope.js");
  const cancellation = new AbortController();
  const reason = new Error("caller stopped");
  cancellation.abort(reason);
  await expect(prepareProcessScopes(cancellation.signal)).rejects.toBe(reason);
  expect(spawn).not.toHaveBeenCalled();
});

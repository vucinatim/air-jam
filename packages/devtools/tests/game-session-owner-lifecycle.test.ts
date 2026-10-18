import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  readGameSessionBrokerState,
  requestGameSessionBroker,
  runGameSessionBroker,
} from "../src/game-session-broker.js";

const runtime = vi.hoisted(() => ({
  openGameSession: vi.fn(),
  closeGameSession: vi.fn(),
  readGameSession: vi.fn(),
  observeGameSession: vi.fn(),
  sendGameSessionInput: vi.fn(),
  invokeGameSessionAction: vi.fn(),
  captureGameSessionVisuals: vi.fn(),
}));
vi.mock("../src/game-session-runtime.js", () => ({
  createGameSessionRuntime: () => runtime,
}));
beforeEach(() => {
  vi.clearAllMocks();
  runtime.closeGameSession.mockResolvedValue({ closed: true });
});
afterEach(() => vi.useRealTimers());

async function owner() {
  const projectDir = await mkdtemp(
    path.join(os.tmpdir(), "airjam-owner-lifecycle-"),
  );
  const running = runGameSessionBroker({ projectDir });
  const deadline = Date.now() + 5000;
  let state = await readGameSessionBrokerState(projectDir);
  while (!state && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 10));
    state = await readGameSessionBrokerState(projectDir);
  }
  if (!state) throw new Error("Owner discovery timed out.");
  return {
    state,
    running,
    async cleanup() {
      await rm(projectDir, { recursive: true, force: true });
    },
  };
}

it("shutdown drains an in-progress open and disconnects the late player instead of leaking it", async () => {
  const broker = await owner();
  const id = randomUUID();
  let complete: ((value: { gameSessionId: string }) => void) | undefined;
  runtime.openGameSession.mockImplementation(
    () =>
      new Promise((resolve) => {
        complete = resolve;
      }),
  );
  const opening = requestGameSessionBroker({
    state: broker.state,
    request: { operation: "open", input: {} },
  }).then(
    (result) => ({ result }),
    (error) => ({ error }),
  );
  await vi.waitFor(() =>
    expect(runtime.openGameSession).toHaveBeenCalledOnce(),
  );
  const shutdown = requestGameSessionBroker({
    state: broker.state,
    request: { operation: "shutdown" },
  });
  await vi.waitFor(async () =>
    expect(
      await requestGameSessionBroker({
        state: broker.state,
        request: { operation: "health" },
      }),
    ).toMatchObject({ draining: true }),
  );
  expect(complete).toBeTypeOf("function");
  if (!complete) throw new Error("Open completion was not registered.");
  complete({ gameSessionId: id });
  const outcome = await opening;
  expect(outcome).toHaveProperty("error");
  expect(runtime.closeGameSession).toHaveBeenCalledExactlyOnceWith({
    gameSessionId: id,
  });
  await shutdown;
  await broker.running;
  await broker.cleanup();
});

it("expires a quiet session before accepting another input and disconnects its controller", async () => {
  const broker = await owner();
  const id = randomUUID();
  runtime.openGameSession.mockResolvedValue({ gameSessionId: id });
  try {
    await requestGameSessionBroker({
      state: broker.state,
      request: { operation: "open", input: {} },
    });
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(Date.now() + 16 * 60_000);
    await expect(
      requestGameSessionBroker({
        state: broker.state,
        request: {
          operation: "input",
          input: { gameSessionId: id, input: { direction: 1 } },
        },
      }),
    ).rejects.toThrow("session_expired");
    expect(runtime.sendGameSessionInput).not.toHaveBeenCalled();
    expect(runtime.closeGameSession).toHaveBeenCalledExactlyOnceWith({
      gameSessionId: id,
    });
  } finally {
    vi.useRealTimers();
    await requestGameSessionBroker({
      state: broker.state,
      request: { operation: "shutdown" },
    });
    await broker.running;
    await broker.cleanup();
  }
});

it("contains an expiry cleanup failure to that session and keeps a newer manual session usable", async () => {
  const broker = await owner();
  const first = randomUUID();
  const second = randomUUID();
  const diagnostic = vi
    .spyOn(console, "error")
    .mockImplementation(() => undefined);
  try {
    runtime.openGameSession
      .mockResolvedValueOnce({ gameSessionId: first })
      .mockResolvedValueOnce({ gameSessionId: second });
    await requestGameSessionBroker({
      state: broker.state,
      request: { operation: "open", input: {} },
    });
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(Date.now() + 10 * 60_000);
    await requestGameSessionBroker({
      state: broker.state,
      request: { operation: "open", input: {} },
    });
    runtime.closeGameSession.mockImplementation(async ({ gameSessionId }) => {
      if (gameSessionId === first)
        throw new Error("one runtime failed to close");
      return { closed: true };
    });
    vi.setSystemTime(Date.now() + 6 * 60_000);
    await vi.waitFor(
      async () =>
        expect(
          await requestGameSessionBroker({
            state: broker.state,
            request: { operation: "health" },
          }),
        ).toMatchObject({
          draining: false,
          cleanupFailures: [
            { gameSessionId: first, message: "one runtime failed to close" },
          ],
        }),
      { timeout: 2500 },
    );
    expect(runtime.closeGameSession).not.toHaveBeenCalledWith({
      gameSessionId: second,
    });
    runtime.readGameSession.mockResolvedValue({ connected: true });
    expect(
      await requestGameSessionBroker({
        state: broker.state,
        request: { operation: "read", input: { gameSessionId: second } },
      }),
    ).toEqual({ connected: true });
  } finally {
    runtime.closeGameSession.mockResolvedValue({ closed: true });
    await requestGameSessionBroker({
      state: broker.state,
      request: { operation: "shutdown" },
    });
    await broker.running;
    await broker.cleanup();
    diagnostic.mockRestore();
  }
});

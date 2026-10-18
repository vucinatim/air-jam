import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { expect, it, vi } from "vitest";
import type { GameRunOwner } from "../src/game-run-owner.js";
import {
  readGameSessionBrokerState,
  requestGameSessionBroker,
  runGameSessionBroker,
} from "../src/game-session-broker.js";
import * as runtimeModule from "../src/game-session-runtime.js";

type OwnerOptions = ConstructorParameters<typeof GameRunOwner>[0];
const owner = vi.hoisted(() => ({
  options: undefined as OwnerOptions | undefined,
  read: vi.fn(),
  closeSession: vi.fn(),
}));
vi.mock("../src/game-run-owner.js", () => ({
  GameRunOwner: class {
    constructor(options: OwnerOptions) {
      owner.options = options;
    }
    read = owner.read;
    closeSession = owner.closeSession;
    async stop(runId: string) {
      return owner.closeSession(runId, "stopped");
    }
    async drain() {}
  },
}));

it("reserves run-owned session termination for run control and internal expiry", async () => {
  const projectDir = await mkdtemp(
    path.join(os.tmpdir(), "airjam-broker-authority-"),
  );
  const runtime = runtimeModule.createGameSessionRuntime(randomUUID());
  const openRun = vi.spyOn(runtime, "openRunSession");
  const openManual = vi.spyOn(runtime, "openGameSession");
  const closeManual = vi
    .spyOn(runtime, "closeGameSession")
    .mockResolvedValue({ closed: true } as Awaited<
      ReturnType<typeof runtime.closeGameSession>
    >);
  vi.spyOn(runtimeModule, "createGameSessionRuntime").mockReturnValue(runtime);
  const sessions = new Map<string, string>();
  const active = new Set<string>();
  owner.read.mockImplementation(async (runId: string) => ({
    runId,
    phase: active.has(runId) ? "playing" : "ended",
  }));
  owner.closeSession.mockImplementation(async (runId: string) => {
    active.delete(runId);
    const sessionId = sessions.get(runId);
    if (!sessionId || !owner.options)
      throw new Error("Missing owned session fixture.");
    owner.options.sessionClosed(sessionId);
    return { closed: true };
  });
  const running = runGameSessionBroker({ projectDir });
  let state = await readGameSessionBrokerState(projectDir);
  while (!state) {
    await new Promise((resolve) => setTimeout(resolve, 10));
    state = await readGameSessionBrokerState(projectDir);
  }
  const request = (
    operation: Parameters<typeof requestGameSessionBroker>[0]["request"],
  ) => requestGameSessionBroker({ state, request: operation });
  const openOwned = async () => {
    const runId = randomUUID();
    const gameSessionId = randomUUID();
    openRun.mockResolvedValueOnce({ summary: { gameSessionId } } as Awaited<
      ReturnType<typeof runtime.openRunSession>
    >);
    if (!owner.options)
      throw new Error("The broker did not create its run owner.");
    sessions.set(runId, gameSessionId);
    active.add(runId);
    await owner.options.openSession({
      runId,
      nickname: "Agent",
      onScope: () => {},
    });
    return { runId, gameSessionId };
  };
  try {
    const first = await openOwned();
    await expect(
      request({
        operation: "close",
        input: { gameSessionId: first.gameSessionId },
      }),
    ).rejects.toThrow("session_owned_by_run");
    expect(owner.closeSession).not.toHaveBeenCalled();
    expect(
      await request({ operation: "run.read", input: { runId: first.runId } }),
    ).toMatchObject({ phase: "playing" });
    await request({ operation: "run.stop", input: { runId: first.runId } });
    expect(owner.closeSession).toHaveBeenCalledExactlyOnceWith(
      first.runId,
      "stopped",
    );

    const second = await openOwned();
    const clock = vi
      .spyOn(Date, "now")
      .mockReturnValue(Date.now() + 61 * 60_000);
    try {
      await expect(
        request({
          operation: "read",
          input: { gameSessionId: second.gameSessionId },
        }),
      ).rejects.toThrow("session_expired");
      expect(owner.closeSession).toHaveBeenLastCalledWith(
        second.runId,
        "session_expired",
      );
      expect(active.has(second.runId)).toBe(false);
    } finally {
      clock.mockRestore();
    }

    const manualId = randomUUID();
    openManual.mockResolvedValue({ gameSessionId: manualId } as Awaited<
      ReturnType<typeof runtime.openGameSession>
    >);
    await request({ operation: "open", input: {} });
    await request({ operation: "close", input: { gameSessionId: manualId } });
    expect(closeManual).toHaveBeenCalledExactlyOnceWith({
      gameSessionId: manualId,
    });
  } finally {
    await request({ operation: "shutdown" });
    await running;
    vi.restoreAllMocks();
    owner.read.mockReset();
    owner.closeSession.mockReset();
    owner.options = undefined;
    await rm(projectDir, { recursive: true, force: true });
  }
});

import { randomUUID } from "node:crypto";
import { mkdtemp, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  readGameSessionBrokerState,
  requestGameSessionBroker,
  resolveGameSessionBrokerStatePath,
  runGameSessionBroker,
} from "../src/game-session-broker";

import { GameRunOwner } from "../src/game-run-owner.js";
import * as runtimeModule from "../src/game-session-runtime.js";
import * as processScopes from "../src/managed-process-scope.js";
import type {
  AirJamGameSessionSummary,
  CloseGameSessionResult,
} from "../src/types.js";

const tempRoots: string[] = [];

const createTempRoot = async (): Promise<string> => {
  const root = await mkdtemp(path.join(os.tmpdir(), "airjam-session-broker-"));
  tempRoots.push(root);
  return root;
};

const waitForState = async (projectDir: string) => {
  const startedAt = Date.now();
  while (Date.now() - startedAt < 5_000) {
    const state = await readGameSessionBrokerState(projectDir);
    if (state) return state;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error("Timed out waiting for game session broker state.");
};

afterEach(async () => {
  await Promise.all(
    tempRoots
      .splice(0)
      .map((root) => rm(root, { recursive: true, force: true })),
  );
});

describe("game session broker", () => {
  it("publishes authenticated health, protects credentials, and shuts down cleanly", async () => {
    const projectDir = await createTempRoot();
    const running = runGameSessionBroker({ projectDir });
    const state = await waitForState(projectDir);

    const health = await requestGameSessionBroker({
      state,
      request: { operation: "health" },
    });
    expect(health).toMatchObject({
      ok: true,
      instanceId: state.instanceId,
      projectDir,
      activeSessionCount: 0,
    });

    const stateMode =
      (await stat(resolveGameSessionBrokerStatePath(projectDir))).mode & 0o777;
    expect(stateMode).toBe(0o600);

    await expect(
      requestGameSessionBroker({
        state: { ...state, secret: "incorrect" },
        request: { operation: "health" },
      }),
    ).rejects.toThrow("Invalid game session broker credentials");

    await expect(
      requestGameSessionBroker({
        state: { ...state, instanceId: randomUUID() },
        request: { operation: "health" },
      }),
    ).rejects.toThrow("owner_replaced");
    const invalid = await fetch(`${state.origin}/v1/game-session`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${state.secret}`,
        "x-airjam-owner": state.instanceId,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        operation: "open",
        input: { executable: "arbitrary" },
      }),
    });
    expect(invalid.status).toBe(400);

    await requestGameSessionBroker({
      state,
      request: { operation: "shutdown" },
    });
    await running;
    expect(await readGameSessionBrokerState(projectDir)).toBeNull();
  });

  it("admits only one owner under simultaneous startup and never overwrites its discovery", async () => {
    const projectDir = await createTempRoot();
    const competitors = [
      runGameSessionBroker({ projectDir }),
      runGameSessionBroker({ projectDir }),
    ].map((running) =>
      running.then(
        () => null,
        (error) => error,
      ),
    );
    const state = await waitForState(projectDir);
    const health = await requestGameSessionBroker({
      state,
      request: { operation: "health" },
    });
    expect(health).toMatchObject({
      instanceId: state.instanceId,
      activeSessionCount: 0,
    });
    await requestGameSessionBroker({
      state,
      request: { operation: "shutdown" },
    });
    const results = await Promise.all(competitors);
    expect(results.filter((result) => result === null)).toHaveLength(1);
    expect(results.filter((result) => result?.code === "EEXIST")).toHaveLength(
      1,
    );
    expect(await readGameSessionBrokerState(projectDir)).toBeNull();
  });
});

it("refuses to attest broker shutdown when an owned process scope is unconfirmed", async () => {
  const projectDir = await createTempRoot();
  const drain = vi
    .spyOn(GameRunOwner.prototype, "drain")
    .mockRejectedValue(
      new Error("run_cleanup_unconfirmed: process scope remains unconfirmed"),
    );
  const running = runGameSessionBroker({ projectDir }).then(
    () => null,
    (error) => error,
  );
  try {
    const state = await waitForState(projectDir);
    await expect(
      requestGameSessionBroker({ state, request: { operation: "shutdown" } }),
    ).rejects.toThrow("run_cleanup_unconfirmed");
    expect(await running).toBeInstanceOf(Error);
    expect(await readGameSessionBrokerState(projectDir)).toBeNull();
  } finally {
    drain.mockRestore();
  }
});

it("still closes manual sessions when run teardown has failed", async () => {
  const projectDir = await createTempRoot();
  const gameSessionId = randomUUID();
  const runtime = runtimeModule.createGameSessionRuntime(randomUUID());
  const open = vi
    .spyOn(runtime, "openGameSession")
    .mockResolvedValue({ gameSessionId } as AirJamGameSessionSummary);
  const close = vi
    .spyOn(runtime, "closeGameSession")
    .mockResolvedValue({ closed: true } as CloseGameSessionResult);
  const factory = vi
    .spyOn(runtimeModule, "createGameSessionRuntime")
    .mockReturnValue(runtime);
  const drain = vi
    .spyOn(GameRunOwner.prototype, "drain")
    .mockRejectedValue(
      new Error("run_cleanup_unconfirmed: process scope remains unconfirmed"),
    );
  const running = runGameSessionBroker({ projectDir }).then(
    () => null,
    (error) => error,
  );
  try {
    const state = await waitForState(projectDir);
    await requestGameSessionBroker({
      state,
      request: { operation: "open", input: {} },
    });
    expect(open).toHaveBeenCalledOnce();
    await expect(
      requestGameSessionBroker({ state, request: { operation: "shutdown" } }),
    ).rejects.toThrow("run_cleanup_unconfirmed");
    expect(await running).toBeInstanceOf(Error);
    expect(close).toHaveBeenCalledExactlyOnceWith({ gameSessionId });
  } finally {
    drain.mockRestore();
    factory.mockRestore();
    open.mockRestore();
    close.mockRestore();
  }
});

it("exposes unconfirmed process ownership in health instead of implying an empty broker is clean", async () => {
  const projectDir = await createTempRoot();
  const running = runGameSessionBroker({ projectDir });
  const state = await waitForState(projectDir);
  const status = vi
    .spyOn(processScopes, "assertProcessScopesConfirmed")
    .mockImplementation(() => {
      throw new Error("process_tree_unconfirmed: discovery scope");
    });
  try {
    const health = await requestGameSessionBroker({
      state,
      request: { operation: "health" },
    });
    expect(health).toMatchObject({
      activeSessionCount: 0,
      processScopeError: "process_tree_unconfirmed: discovery scope",
    });
  } finally {
    status.mockRestore();
    await requestGameSessionBroker({
      state,
      request: { operation: "shutdown" },
    });
    await running;
  }
});

it("streams a watched surface and closes only that producer when its viewer disconnects", async () => {
  const { watchGameSessionBroker } =
    await import("../src/game-session-broker.js");
  const projectDir = await createTempRoot();
  const runId = randomUUID();
  let closed = false;
  const watching = vi
    .spyOn(GameRunOwner.prototype, "watch")
    .mockImplementation(async (_input, onEvent, signal) => {
      onEvent({
        type: "ready",
        runId,
        surface: { kind: "host" },
        width: 320,
        height: 180,
      });
      onEvent({ type: "frame", seq: 0, capturedAt: 100, data: "image" });
      await new Promise<void>((resolve) =>
        signal.addEventListener(
          "abort",
          () => {
            closed = true;
            resolve();
          },
          { once: true },
        ),
      );
    });
  const running = runGameSessionBroker({ projectDir });
  const state = await waitForState(projectDir);
  try {
    const cancellation = new AbortController();
    await expect(
      watchGameSessionBroker({
        state,
        input: { runId, surface: { kind: "host" } },
        signal: cancellation.signal,
        onEvent: (event) => {
          if (event.type === "frame") cancellation.abort();
        },
      }),
    ).rejects.toThrow();
    await vi.waitFor(() => expect(closed).toBe(true));
    expect(
      await requestGameSessionBroker({
        state,
        request: { operation: "health" },
      }),
    ).toMatchObject({
      activeSessionCount: 0,
      draining: false,
      gameRunProtocolVersion: 5,
    });
  } finally {
    watching.mockRestore();
    await requestGameSessionBroker({
      state,
      request: { operation: "shutdown" },
    });
    await running;
  }
});

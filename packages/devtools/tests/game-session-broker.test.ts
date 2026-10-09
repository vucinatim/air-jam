import { mkdtemp, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  readGameSessionBrokerState,
  requestGameSessionBroker,
  resolveGameSessionBrokerStatePath,
  runGameSessionBroker,
} from "../src/game-session-broker";

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

    await requestGameSessionBroker({
      state,
      request: { operation: "shutdown" },
    });
    await running;
    expect(await readGameSessionBrokerState(projectDir)).toBeNull();
  });
});

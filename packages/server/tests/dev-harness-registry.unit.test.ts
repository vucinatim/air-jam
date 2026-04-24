import { describe, expect, it } from "vitest";
import { DevHarnessRegistry } from "../src/services/dev-harness-registry.js";

describe("DevHarnessRegistry", () => {
  it("registers sessions, resolves by room, and completes invocations", async () => {
    const registry = new DevHarnessRegistry();

    registry.register({
      sessionId: "session-1",
      gameId: "pong",
      role: "host",
      roomId: "ROOM1",
      origin: "http://127.0.0.1:5173",
      href: "http://127.0.0.1:5173/?room=ROOM1",
      title: "Pong",
      actions: [
        {
          name: "endMatch",
          description: "End the current match.",
          payload: {
            kind: "none",
            description: null,
          },
          resultDescription: "The host transitions to the end state.",
        },
      ],
      snapshot: {
        roomId: "ROOM1",
        controllerJoinUrl: "http://127.0.0.1:5173/controller?room=ROOM1",
        matchPhase: "lobby",
        runtimeState: "playing",
        updatedAt: new Date().toISOString(),
      },
    });

    const invocationPromise = registry.invoke({
      roomId: "ROOM1",
      actionName: "endMatch",
      timeoutMs: 1000,
    });

    const command = await registry.awaitNextCommand("session-1", 50);
    expect(command).toMatchObject({
      actionName: "endMatch",
    });

    registry.completeCommand({
      commandId: command!.commandId,
      result: {
        sessionId: "session-1",
        roomId: "ROOM1",
        gameId: "pong",
        actionName: "endMatch",
        result: { ok: true },
        snapshotBefore: {
          roomId: "ROOM1",
          controllerJoinUrl: "http://127.0.0.1:5173/controller?room=ROOM1",
          matchPhase: "lobby",
          runtimeState: "playing",
          updatedAt: new Date().toISOString(),
        },
        snapshotAfter: {
          roomId: "ROOM1",
          controllerJoinUrl: "http://127.0.0.1:5173/controller?room=ROOM1",
          matchPhase: "ended",
          runtimeState: "playing",
          updatedAt: new Date().toISOString(),
        },
      },
    });

    await expect(invocationPromise).resolves.toMatchObject({
      session: {
        sessionId: "session-1",
        roomId: "ROOM1",
      },
      invocation: {
        actionName: "endMatch",
        result: { ok: true },
      },
    });
  });
});

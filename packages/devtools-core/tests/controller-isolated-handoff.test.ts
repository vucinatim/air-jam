import type { ChildProcess } from "node:child_process";
import { EventEmitter } from "node:events";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const joinAttempts: string[] = [];
const spawnedOwners: FakeChildProcess[] = [];

class MockSocket {
  public connected = false;
  private readonly events = new EventEmitter();

  on(event: string, listener: (...args: unknown[]) => void): this {
    this.events.on(event, listener);
    return this;
  }

  once(event: string, listener: (...args: unknown[]) => void): this {
    this.events.once(event, listener);
    return this;
  }

  off(event: string, listener: (...args: unknown[]) => void): this {
    this.events.off(event, listener);
    return this;
  }

  emit(event: string, ...args: unknown[]): boolean {
    if (event === "controller:join") {
      const payload = args[0] as { roomId: string; controllerId: string };
      const callback = args[1] as
        | ((ack: {
            ok: boolean;
            roomId?: string;
            controllerId?: string;
            message?: string;
          }) => void)
        | undefined;
      joinAttempts.push(payload.roomId);
      if (payload.roomId === "ROOM2") {
        callback?.({
          ok: true,
          roomId: payload.roomId,
          controllerId: payload.controllerId,
        });
        queueMicrotask(() => {
          this.serverEmit("server:welcome", {
            controllerId: payload.controllerId,
            roomId: payload.roomId,
            player: {
              id: payload.controllerId,
              label: payload.controllerId,
            },
            players: [
              {
                id: payload.controllerId,
                label: payload.controllerId,
              },
            ],
          });
          this.serverEmit("server:state", {
            roomId: payload.roomId,
            state: {
              runtimeState: "playing",
            },
          });
        });
        return true;
      }

      callback?.({
        ok: false,
        message: "Room not found",
      });
      return true;
    }

    if (event === "controller:leave") {
      const payload = args[0] as { controllerId: string };
      const callback = args[1] as ((ack: { ok: boolean }) => void) | undefined;
      this.serverEmit("server:controllerLeft", {
        controllerId: payload.controllerId,
      });
      callback?.({ ok: true });
      return true;
    }

    return true;
  }

  disconnect(): void {
    this.connected = false;
    this.serverEmit("disconnect", "io client disconnect");
  }

  serverEmit(event: string, ...args: unknown[]): void {
    this.events.emit(event, ...args);
  }
}

class FakeChildProcess extends EventEmitter {
  public readonly stdout = new EventEmitter();
  public readonly stderr = new EventEmitter();
  public killed = false;
  public exitCode: number | null = null;

  kill(): boolean {
    this.killed = true;
    this.exitCode = 0;
    this.emit("exit", 0, null);
    return true;
  }
}

vi.mock("../src/context.js", () => ({
  detectProjectContext: vi.fn(async () => ({
    rootDir: "/tmp/solo",
    mode: "standalone-game",
    workspaceRoot: null,
    packageJsonPath: "/tmp/solo/package.json",
    packageJson: { name: "solo-fixture" },
    packageManager: "pnpm",
    reasons: ["fixture"],
  })),
}));

vi.mock("../src/dev.js", () => ({
  getTopology: vi.fn(async () => ({
    projectMode: "standalone-game",
    mode: "standalone-dev",
    topologyMode: "standalone-dev",
    gameId: "solo-fixture",
    secure: false,
    surfaces: {
      controller: {
        appOrigin: "http://127.0.0.1:7777",
      },
    },
    urls: {
      appOrigin: "http://127.0.0.1:7777",
      hostUrl: "http://127.0.0.1:7777",
      controllerBaseUrl: "http://127.0.0.1:7777/controller",
      publicHost: "http://127.0.0.1:7777",
      localBuildUrl: null,
      browserBuildUrl: null,
    },
    process: null,
  })),
}));

vi.mock("../src/visual.js", () => ({
  readHarnessSnapshot: vi.fn(async () => ({
    gameId: "solo-fixture",
    projectMode: "standalone-game",
    mode: "standalone-dev",
    topologyMode: "standalone-dev",
    secure: false,
    roomId: "ROOM1",
    sessionId: null,
    controlSurface: "isolated-session",
    process: null,
    actions: [],
    availableActions: [],
    urls: {
      appOrigin: "http://127.0.0.1:7777",
      hostUrl: "http://127.0.0.1:7777",
      controllerBaseUrl: "http://127.0.0.1:7777/controller",
      publicHost: "http://127.0.0.1:7777",
      localBuildUrl: null,
      browserBuildUrl: null,
      controllerJoinUrl:
        "http://127.0.0.1:7777/controller?room=ROOM1&aj_controller_cap=dead",
    },
    snapshot: {
      roomId: "ROOM1",
      controllerJoinUrl:
        "http://127.0.0.1:7777/controller?room=ROOM1&aj_controller_cap=dead",
    },
  })),
}));

vi.mock("node:child_process", async () => {
  const actual =
    await vi.importActual<typeof import("node:child_process")>(
      "node:child_process",
    );

  return {
    ...actual,
    spawn: vi.fn(() => {
      const child = new FakeChildProcess();
      spawnedOwners.push(child);
      queueMicrotask(() => {
        child.stdout.emit(
          "data",
          JSON.stringify(
            {
              roomId: "ROOM2",
              controllerJoinUrl:
                "http://127.0.0.1:7777/controller?room=ROOM2&aj_controller_cap=held",
              snapshot: {
                roomId: "ROOM2",
                controllerJoinUrl:
                  "http://127.0.0.1:7777/controller?room=ROOM2&aj_controller_cap=held",
                matchPhase: "lobby",
              },
            },
            null,
            2,
          ),
        );
      });
      return child as unknown as ChildProcess;
    }),
  };
});

vi.mock("socket.io-client", () => ({
  io: vi.fn(() => {
    const socket = new MockSocket();
    queueMicrotask(() => {
      socket.connected = true;
      socket.serverEmit("connect");
    });
    return socket;
  }),
}));

describe("isolated harness controller handoff", () => {
  beforeEach(() => {
    joinAttempts.length = 0;
    spawnedOwners.length = 0;
  });

  afterEach(async () => {
    vi.clearAllMocks();
    for (const owner of spawnedOwners.splice(0)) {
      if (!owner.killed) {
        owner.kill();
      }
    }
  });

  it("keeps an isolated host alive when joining from an isolated harness snapshot", async () => {
    const { connectController, disconnectController } =
      await import("../src/controller.js");

    const session = await connectController({
      cwd: "/tmp/solo",
      timeoutMs: 1_000,
    });

    expect(joinAttempts).toEqual(["ROOM2"]);
    expect(session.roomId).toBe("ROOM2");
    expect(session.controllerJoinUrl).toContain("room=ROOM2");
    expect(spawnedOwners).toHaveLength(1);

    await disconnectController({
      controllerSessionId: session.controllerSessionId,
    });

    expect(spawnedOwners[0]?.killed).toBe(true);
  });

  it("retries with an owned isolated host when an explicit join URL points at a dead room", async () => {
    const { connectController, disconnectController } =
      await import("../src/controller.js");

    const session = await connectController({
      cwd: "/tmp/solo",
      controllerJoinUrl:
        "http://127.0.0.1:7777/controller?room=ROOM1&aj_controller_cap=dead",
      gameId: "solo-fixture",
      timeoutMs: 1_000,
    });

    expect(joinAttempts).toEqual(["ROOM1", "ROOM2"]);
    expect(session.roomId).toBe("ROOM2");
    expect(spawnedOwners).toHaveLength(1);

    await disconnectController({
      controllerSessionId: session.controllerSessionId,
    });

    expect(spawnedOwners[0]?.killed).toBe(true);
  });

  it("falls back to an owned isolated host when a registered harness session points at a stale room", async () => {
    const { readHarnessSnapshot } = await import("../src/visual.js");
    vi.mocked(readHarnessSnapshot).mockResolvedValueOnce({
      gameId: "solo-fixture",
      projectMode: "standalone-game",
      mode: "standalone-dev",
      topologyMode: "standalone-dev",
      secure: false,
      roomId: "ROOM1",
      sessionId: "registered-room",
      controlSurface: "registered-session",
      process: null,
      actions: [],
      availableActions: [],
      urls: {
        appOrigin: "http://127.0.0.1:7777",
        hostUrl: "http://127.0.0.1:7777",
        controllerBaseUrl: "http://127.0.0.1:7777/controller",
        publicHost: "http://127.0.0.1:7777",
        localBuildUrl: null,
        browserBuildUrl: null,
        controllerJoinUrl:
          "http://127.0.0.1:7777/controller?room=ROOM1&aj_controller_cap=dead",
      },
      snapshot: {
        roomId: "ROOM1",
        controllerJoinUrl:
          "http://127.0.0.1:7777/controller?room=ROOM1&aj_controller_cap=dead",
      },
    });

    const { connectController, disconnectController } =
      await import("../src/controller.js");

    const session = await connectController({
      cwd: "/tmp/solo",
      timeoutMs: 1_000,
    });

    expect(joinAttempts).toEqual(["ROOM1", "ROOM2"]);
    expect(session.roomId).toBe("ROOM2");
    expect(spawnedOwners).toHaveLength(1);

    await disconnectController({
      controllerSessionId: session.controllerSessionId,
    });

    expect(spawnedOwners[0]?.killed).toBe(true);
  });
});

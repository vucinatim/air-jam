import {
  ABNORMAL_CLOSE_CODE,
  AIRJAM_PRESENTATION_CHANNEL,
  type RoomConnector,
} from "@air-jam/sdk/room-protocol";
import {
  createLoopbackConnector,
  createWebSocketConnector,
  HostRoomSession,
} from "@air-jam/sdk/room-session";
import { runtimeTopologyToQueryParams } from "@air-jam/sdk/runtime-topology";
import { createOpenRoomGate, MemoryRoomHost } from "@air-jam/server/room";
import type { ChildProcess } from "node:child_process";
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getTopology } from "../src/dev.js";
import { closeScopedProcess } from "../src/managed-process-scope.js";
import {
  AIR_JAM_RUNTIME_OWNER_ACTION_REQUEST,
  AIR_JAM_RUNTIME_OWNER_ACTION_RESULT,
  type AirJamRuntimeOwnerActionRequest,
  type AirJamRuntimeOwnerCaptureRequest,
} from "../src/runtime-owner-protocol.js";

const joinAttempts: string[] = [];
const spawnedOwners: FakeChildProcess[] = [];
let actionResponse: "accept" | "reject" | "exit" | "timeout" = "accept";
const ownedActions: AirJamRuntimeOwnerActionRequest[] = [];
let disconnectDuringCapture = false;
const defaultOwnedJoinUrl = "http://127.0.0.1:7777/controller?room=ROOM2";
let ownedJoinUrl = defaultOwnedJoinUrl;

/**
 * One room, ROOM2, with a game host in it, reached by every phone the
 * controller opens whatever origin it dials; other codes are not found.
 */
let roomHost: HostRoomSession;
let dropPhones: () => void = () => {};
const openRoomFixture = async () => {
  const rooms = new MemoryRoomHost({
    gate: createOpenRoomGate(),
    codesMayBeAsked: true,
  });
  const loopback = createLoopbackConnector(rooms);
  const phones = new Set<() => void>();
  dropPhones = () => {
    for (const drop of phones) drop();
  };
  phoneConnector = (address, handlers) => {
    if (address.role === "phone") joinAttempts.push(address.code);
    const link = loopback(address, handlers);
    const drop = () => {
      link.close();
      handlers.close(ABNORMAL_CLOSE_CODE);
    };
    phones.add(drop);
    return {
      send: (data) => link.send(data),
      buffered: () => link.buffered(),
      close: () => {
        phones.delete(drop);
        link.close();
      },
    };
  };
  roomHost = new HostRoomSession({
    connector: loopback,
    key: "fixture-host-key-01",
    code: "ROOM2",
    seats: 4,
    deviceWakeEvents: null,
  });
  roomHost.publish(AIRJAM_PRESENTATION_CHANNEL, { runtimeState: "playing" });
  await vi.waitFor(() => expect(roomHost.status.phase).toBe("open"));
};
let phoneConnector: RoomConnector;

class FakeChildProcess extends EventEmitter {
  public readonly stdout = new PassThrough();
  public readonly stderr = new EventEmitter();
  public connected = true;
  public killed = false;
  public exitCode: number | null = null;

  send(
    message: AirJamRuntimeOwnerActionRequest | AirJamRuntimeOwnerCaptureRequest,
    callback?: (error: Error | null) => void,
  ): boolean {
    callback?.(null);
    if (message.type === AIR_JAM_RUNTIME_OWNER_ACTION_REQUEST) {
      ownedActions.push(message);
      queueMicrotask(() => {
        // An unrelated response must never settle this invocation.
        this.emit("message", {
          type: AIR_JAM_RUNTIME_OWNER_ACTION_RESULT,
          requestId: "unrelated",
          acknowledgement: {
            ok: true,
            status: "accepted",
            source: "host",
            result: "wrong",
          },
        });
        if (actionResponse === "exit") this.kill();
        else if (actionResponse !== "timeout")
          this.emit("message", {
            type: AIR_JAM_RUNTIME_OWNER_ACTION_RESULT,
            requestId: message.requestId,
            acknowledgement:
              actionResponse === "accept"
                ? {
                    ok: true,
                    status: "accepted",
                    source: "host",
                    result: { changed: true },
                  }
                : {
                    ok: false,
                    status: "rejected",
                    source: "host",
                    reason: "not_ready",
                    message: "The fixture host is not ready.",
                  },
          });
      });
      return true;
    }
    if (disconnectDuringCapture) {
      dropPhones();
      return true;
    }
    queueMicrotask(() => {
      this.emit("message", {
        type: "air-jam-runtime-owner.capture-visuals-result/v1",
        requestId: message.requestId,
        ok: true,
        capturedAt: "2026-09-09T00:00:00.000Z",
        screenshots: [
          {
            surface: "host",
            width: 1440,
            height: 1024,
            relativePath: `${message.relativeDir}/host-desktop.png`,
          },
          {
            surface: "controller",
            width: 390,
            height: 844,
            relativePath: `${message.relativeDir}/controller-phone.png`,
          },
        ],
        error: null,
      });
    });
    return true;
  }

  kill(): boolean {
    this.killed = true;
    if (disconnectDuringCapture) {
      queueMicrotask(() => this.emit("exit", 0, null));
      return true;
    }
    this.exitCode = 0;
    this.emit("exit", 0, null);
    return true;
  }
}

vi.mock("../src/games.js", () => ({
  inspectGame: vi.fn(async () => ({ id: "solo-fixture" })),
}));

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
  startDev: vi.fn(async () => {
    throw new Error("An explicit room must not start development processes");
  }),
  stopDev: vi.fn(),
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

vi.mock("../src/managed-process-scope.js", () => ({
  closeScopedProcess: vi.fn(async (child: ChildProcess | null) => {
    child?.kill();
  }),
  spawnScopedProcess: vi.fn(async () => {
    const child = new FakeChildProcess();
    spawnedOwners.push(child);
    setTimeout(() => {
      child.emit("message", {
        type: "air-jam-runtime-owner.ready/v1",
        roomId: "ROOM2",
        controllerJoinUrl: ownedJoinUrl,
        inspection: {
          role: "host",
          roomId: "ROOM2",
          joinUrl: ownedJoinUrl,
          localControllerUrl: ownedJoinUrl,
          joinUrlStatus: "ready",
          connectionStatus: "connected",
          players: [],
          controllers: [],
          mode: "standalone",
          runtimeState: "playing",
        },
      });
    }, 0);
    return child as unknown as ChildProcess;
  }),
}));

vi.mock("@air-jam/sdk/room-session", async (importActual) => ({
  ...(await importActual<typeof import("@air-jam/sdk/room-session")>()),
  createWebSocketConnector: vi.fn(
    (): RoomConnector => (address, handlers) =>
      phoneConnector(address, handlers),
  ),
}));

describe("isolated runtime controller handoff", () => {
  beforeEach(async () => {
    await openRoomFixture();
    joinAttempts.length = 0;
    spawnedOwners.length = 0;
    actionResponse = "accept";
    disconnectDuringCapture = false;
    ownedJoinUrl = defaultOwnedJoinUrl;
    vi.mocked(closeScopedProcess).mockImplementation(async (child) => {
      child?.kill();
    });
    ownedActions.length = 0;
  });

  afterEach(async () => {
    roomHost.close();
    vi.clearAllMocks();
    for (const owner of spawnedOwners.splice(0)) {
      if (!owner.killed) {
        owner.kill();
      }
    }
  });

  it.each(["http://localhost:62984", "https://preview.example.com"])(
    "uses the explicit join origin instead of local inferred topology: %s",
    async (origin) => {
      const { connectController, disconnectController } =
        await import("../src/controller.js");
      const { startDev } = await import("../src/dev.js");
      const session = await connectController({
        cwd: "/tmp/solo",
        controllerJoinUrl: `${origin}/controller?room=ROOM2`,
        timeoutMs: 1_000,
      });
      expect(createWebSocketConnector).toHaveBeenCalledWith(origin);
      expect(session.socketOrigin).toBe(origin);
      expect(startDev).not.toHaveBeenCalled();
      expect(spawnedOwners).toHaveLength(0);
      await disconnectController({
        controllerSessionId: session.controllerSessionId,
      });
    },
  );

  it("keeps an isolated runtime host alive while its controller is connected", async () => {
    const {
      captureControllerSessionVisuals,
      connectController,
      disconnectController,
    } = await import("../src/controller.js");

    const session = await connectController({
      cwd: "/tmp/solo",
      timeoutMs: 1_000,
    });

    expect(joinAttempts).toEqual(["ROOM2"]);
    expect(session.roomId).toBe("ROOM2");
    expect(session.controllerJoinUrl).toContain("room=ROOM2");
    expect(spawnedOwners).toHaveLength(1);

    const capture = await captureControllerSessionVisuals({
      controllerSessionId: session.controllerSessionId,
      relativeDir: ".airjam/artifacts/session-visuals/capture-1",
    });
    expect(capture.screenshots).toEqual([
      expect.objectContaining({
        surface: "host",
        relativePath:
          ".airjam/artifacts/session-visuals/capture-1/host-desktop.png",
      }),
      expect.objectContaining({
        surface: "controller",
        relativePath:
          ".airjam/artifacts/session-visuals/capture-1/controller-phone.png",
      }),
    ]);

    await disconnectController({
      controllerSessionId: session.controllerSessionId,
    });

    expect(spawnedOwners[0]?.killed).toBe(true);
  });

  it("waits for the scope cleanup receipt even when its root has already exited", async () => {
    const { connectController, disconnectController } =
      await import("../src/controller.js");
    const session = await connectController({
      cwd: "/tmp/solo",
      timeoutMs: 1000,
    });
    let confirm: () => void = () => {
      throw new Error("Cleanup confirmation is not pending.");
    };
    const confirmation = new Promise<void>((resolve) => {
      confirm = resolve;
    });
    vi.mocked(closeScopedProcess).mockImplementation(async () => {
      await confirmation;
    });
    spawnedOwners[0]?.kill();
    let finished = false;
    const pending = disconnectController({
      controllerSessionId: session.controllerSessionId,
    }).then(() => {
      finished = true;
    });
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(finished).toBe(false);
    confirm();
    await pending;
    expect(closeScopedProcess).toHaveBeenCalledWith(spawnedOwners[0]);
  });

  it("reports a controller whose link dropped as not connected while it reconnects", async () => {
    const { connectController, disconnectController, readRuntimeSnapshot } =
      await import("../src/controller.js");
    const session = await connectController({
      cwd: "/tmp/solo",
      controllerJoinUrl: defaultOwnedJoinUrl,
      timeoutMs: 1000,
    });
    expect(session.connected).toBe(true);
    dropPhones();
    const dropped = await readRuntimeSnapshot({
      controllerSessionId: session.controllerSessionId,
    });
    expect(dropped.connected).toBe(false);
    await disconnectController({
      controllerSessionId: session.controllerSessionId,
    });
  });

  it("fails capture when its acting controller disconnects instead of returning stale images", async () => {
    const {
      captureControllerSessionVisuals,
      connectController,
      disconnectController,
    } = await import("../src/controller.js");
    const session = await connectController({
      cwd: "/tmp/solo",
      gameId: "solo-fixture",
      timeoutMs: 1000,
    });
    disconnectDuringCapture = true;
    await expect(
      captureControllerSessionVisuals({
        controllerSessionId: session.controllerSessionId,
        relativeDir: ".airjam/artifacts/disconnected-capture",
        timeoutMs: 1000,
      }),
    ).rejects.toThrow(
      "Acting controller disconnected before visual capture completed",
    );
    await disconnectController({
      controllerSessionId: session.controllerSessionId,
    });
  });

  it.each([
    { roomId: "ROOM1" },
    {
      controllerJoinUrl: "http://127.0.0.1:7777/controller?room=ROOM1",
    },
  ])(
    "rejects a missing explicit target without creating another host: %j",
    async (target) => {
      const { createGameSessionRuntime } =
        await import("../src/game-session-runtime.js");
      const { openGameSession } = createGameSessionRuntime();
      const { startDev, stopDev } = await import("../src/dev.js");

      await expect(
        openGameSession({
          cwd: "/tmp/solo",
          ...target,
          gameId: "solo-fixture",
          timeoutMs: 1_000,
        }),
      ).rejects.toThrow("Controller join was refused (not-found).");

      expect(joinAttempts).toEqual(["ROOM1"]);
      expect(spawnedOwners).toHaveLength(0);
      expect(startDev).not.toHaveBeenCalled();
      expect(stopDev).not.toHaveBeenCalled();
    },
  );

  it("attaches a controller to an existing room without acquiring host ownership", async () => {
    const { connectController, disconnectController, invokeHostAction } =
      await import("../src/controller.js");
    const session = await connectController({
      cwd: "/tmp/solo",
      roomId: "ROOM2",
      timeoutMs: 1_000,
    });

    expect(session.roomId).toBe("ROOM2");
    expect(joinAttempts).toEqual(["ROOM2"]);
    expect(spawnedOwners).toHaveLength(0);

    const invocation = await invokeHostAction({
      controllerSessionId: session.controllerSessionId,
      actionName: "finishMatch",
      storeDomain: "default",
    });
    expect(invocation.acknowledgement).toMatchObject({
      ok: false,
      reason: "host_runtime_not_owned",
    });
    expect(ownedActions).toHaveLength(0);

    await disconnectController({
      controllerSessionId: session.controllerSessionId,
    });

    expect(spawnedOwners).toHaveLength(0);
  });

  it.each(["standalone-dev", "arcade-dev"] as const)(
    "invokes the actual owned host through correlated IPC (%s)",
    async (mode) => {
      const { connectController, disconnectController, invokeHostAction } =
        await import("../src/controller.js");
      const session = await connectController({
        cwd: "/tmp/solo",
        gameId: "solo-fixture",
        mode,
        timeoutMs: 1000,
      });
      try {
        const storeDomain =
          mode === "arcade-dev" ? "aj.embedded.game:solo-fixture" : "default";
        const invocation = await invokeHostAction({
          controllerSessionId: session.controllerSessionId,
          actionName: "finishMatch",
          storeDomain,
          payload: { score: 2 },
          timeoutMs: 100,
        });
        expect(invocation.acknowledgement).toEqual({
          ok: true,
          status: "accepted",
          source: "host",
          result: { changed: true },
        });
        expect(ownedActions).toHaveLength(1);
        expect(ownedActions[0]?.action).toEqual({
          roomId: "ROOM2",
          storeDomain,
          actionName: "finishMatch",
          payload: { score: 2 },
        });
        expect(spawnedOwners[0]?.listenerCount("message")).toBe(0);
      } finally {
        await disconnectController({
          controllerSessionId: session.controllerSessionId,
        });
      }
    },
  );

  it.each(["reject", "exit", "timeout"] as const)(
    "settles owned host %s and removes pending IPC listeners",
    async (response) => {
      actionResponse = response;
      const { connectController, disconnectController, invokeHostAction } =
        await import("../src/controller.js");
      const session = await connectController({
        cwd: "/tmp/solo",
        timeoutMs: 1000,
      });
      try {
        const invocation = await invokeHostAction({
          controllerSessionId: session.controllerSessionId,
          actionName: "finishMatch",
          storeDomain: "default",
          timeoutMs: 20,
        });
        expect(invocation.acknowledgement).toMatchObject({
          ok: false,
          reason:
            response === "reject"
              ? "not_ready"
              : response === "exit"
                ? "host_ack_missing"
                : "host_ack_timeout",
        });
        expect(spawnedOwners[0]?.listenerCount("message")).toBe(0);
      } finally {
        await disconnectController({
          controllerSessionId: session.controllerSessionId,
        });
      }
    },
  );

  it.each(["monorepo", "standalone-game"] as const)(
    "keeps source project identity separate from Arcade store identity (%s)",
    async (projectMode) => {
      const { detectProjectContext } = await import("../src/context.js");
      const originalContext = await detectProjectContext({ cwd: "/tmp/solo" });
      vi.mocked(detectProjectContext).mockResolvedValueOnce({
        ...originalContext,
        mode: projectMode,
      });
      roomHost.publish("arcade.surface", {
        epoch: 7,
        kind: "game",
        gameId: "local-reference-pong",
        controllerUrl: "http://localhost:5173/controller",
        orientation: "landscape",
        overlay: "hidden",
      });
      const {
        connectController,
        resolveControllerSessionGameRuntime,
        disconnectController,
      } = await import("../src/controller.js");
      const session = await connectController({
        cwd: "/tmp/solo",
        roomId: "ROOM2",
        gameId: "wrong-requested-game",
        mode: "arcade-dev",
        timeoutMs: 1_000,
      });
      try {
        const runtime = await resolveControllerSessionGameRuntime({
          controllerSessionId: session.controllerSessionId,
          timeoutMs: 1_000,
        });
        expect(runtime).toEqual({
          gameId: projectMode === "monorepo" ? "pong" : "solo-fixture",
          defaultStoreDomain: "aj.embedded.game:local-reference-pong",
        });
      } finally {
        await disconnectController({
          controllerSessionId: session.controllerSessionId,
        });
      }
    },
  );
  it("connects to the actual owned relay even when inferred local development topology differs", async () => {
    const origin = "http://127.0.0.1:46127";
    const url = new URL("/controller?room=ROOM2", origin);
    for (const [key, value] of Object.entries(
      runtimeTopologyToQueryParams({
        runtimeMode: "self-hosted-production",
        surfaceRole: "controller",
        appOrigin: origin,
        backendOrigin: origin,
        publicHost: origin,
      }),
    ))
      url.searchParams.set(key, value);
    ownedJoinUrl = url.toString();
    const { connectController, disconnectController } =
      await import("../src/controller.js");
    const session = await connectController({
      cwd: "/tmp/solo",
      timeoutMs: 1000,
    });
    expect(session.socketOrigin).toBe(origin);
    expect(createWebSocketConnector).toHaveBeenCalledWith(origin);
    await disconnectController({
      controllerSessionId: session.controllerSessionId,
    });
  });
});

it("joins a complete explicit room without topology discovery", async () => {
  await openRoomFixture();
  const { connectController, disconnectController } =
    await import("../src/controller.js");
  vi.mocked(getTopology).mockClear();
  const session = await connectController({
    cwd: "/tmp/solo",
    gameId: "solo-fixture",
    controllerJoinUrl: defaultOwnedJoinUrl,
  });
  try {
    expect(session.roomId).toBe("ROOM2");
    expect(getTopology).not.toHaveBeenCalled();
    expect(spawnedOwners).toHaveLength(0);
  } finally {
    await disconnectController({
      controllerSessionId: session.controllerSessionId,
    });
    roomHost.close();
  }
});

// @vitest-environment jsdom

import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resolveRuntimeTopology } from "@air-jam/runtime-topology";
import { onAirJamDiagnostic } from "../src/diagnostics";
import { useAirJamController } from "../src/hooks/use-air-jam-controller";
import { useAirJamHost } from "../src/hooks/use-air-jam-host";
import { resetControllerRealtimeClientForTests } from "../src/runtime/controller-realtime-client";
import { resetHostRealtimeClientForTests } from "../src/runtime/host-realtime-client";
import {
  AirJamControllerRuntime,
  AirJamHostRuntime,
} from "../src/runtime/session-runtimes";
import { createAirJamStore } from "../src/state/connection-store";

const mocked = vi.hoisted(() => ({
  createMockSocket: () => {
    type Listener = (...args: unknown[]) => void;
    const listeners = new Map<string, Set<Listener>>();

    const socket = {
      connected: true,
      on: vi.fn((event: string, handler: Listener) => {
        const current = listeners.get(event) ?? new Set<Listener>();
        current.add(handler);
        listeners.set(event, current);
        return socket;
      }),
      off: vi.fn((event: string, handler: Listener) => {
        const current = listeners.get(event);
        if (!current) {
          return socket;
        }
        current.delete(handler);
        if (current.size === 0) {
          listeners.delete(event);
        }
        return socket;
      }),
      emit: vi.fn(),
      connect: vi.fn(() => socket),
      disconnect: vi.fn(() => {
        socket.connected = false;
        return socket;
      }),
    };

    return socket;
  },
  store: null as ReturnType<typeof createAirJamStore> | null,
  controllerSocket: null as any,
  hostSocket: null as any,
  useAirJamContext: vi.fn(),
  useAssertSessionScope: vi.fn(),
  useClaimSessionRuntimeOwner: vi.fn(),
}));

vi.mock("../src/context/air-jam-context", async () => {
  const actual = await vi.importActual<
    typeof import("../src/context/air-jam-context")
  >("../src/context/air-jam-context");

  return {
    ...actual,
    useAirJamContext: mocked.useAirJamContext,
  };
});

vi.mock("../src/context/session-scope", async () => {
  const actual = await vi.importActual<
    typeof import("../src/context/session-scope")
  >("../src/context/session-scope");

  return {
    ...actual,
    useAssertSessionScope: mocked.useAssertSessionScope,
    useClaimSessionRuntimeOwner: mocked.useClaimSessionRuntimeOwner,
  };
});

const PROVIDER_CONFIG = {
  topology: resolveRuntimeTopology({
    runtimeMode: "self-hosted-production",
    surfaceRole: "host",
    appOrigin: "http://localhost:3000",
    backendOrigin: "http://localhost:3001",
    publicHost: "http://localhost:3000",
  }),
  appId: "test_app_id",
};

const createHostWrapper =
  () =>
  ({ children }: { children: ReactNode }) =>
    React.createElement(AirJamHostRuntime, {
      ...PROVIDER_CONFIG,
      children,
    });

const createControllerWrapper =
  (options: {
    roomId?: string;
    controllerId?: string;
    nickname?: string;
    avatarId?: string;
  } = {}) =>
  ({ children }: { children: ReactNode }) =>
    React.createElement(
      AirJamControllerRuntime,
      {
        ...PROVIDER_CONFIG,
        ...options,
        children,
      },
    );

describe("session reconnect behavior", () => {
  beforeEach(() => {
    window.history.replaceState({}, "", "/");
    mocked.store = createAirJamStore();
    mocked.controllerSocket = mocked.createMockSocket();
    mocked.hostSocket = mocked.createMockSocket();
    vi.stubGlobal("fetch", vi.fn());

    mocked.useAirJamContext.mockReturnValue({
      config: {
        appId: undefined,
        hostSessionKind: "game",
        maxPlayers: 8,
        publicHost: "http://localhost:3000",
        resolveEnv: true,
        serverUrl: "http://localhost:3001",
      },
      store: mocked.store,
      getSocket: (role: "host" | "controller") =>
        role === "controller" ? mocked.controllerSocket : mocked.hostSocket,
      disconnectSocket: vi.fn(),
      inputManager: null,
    });
  });

  afterEach(() => {
    window.history.replaceState({}, "", "/");
    mocked.store = null;
    resetControllerRealtimeClientForTests();
    resetHostRealtimeClientForTests();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("recovers controller status when the cached socket is already connected", async () => {
    const { result } = renderHook(() => useAirJamController(), {
      wrapper: createControllerWrapper({
        roomId: "ROOM1",
        controllerId: "ctrl_1",
      }),
    });

    await waitFor(() => {
      expect(result.current.connectionStatus).toBe("connected");
    });

    expect(mocked.controllerSocket.connect).not.toHaveBeenCalled();
    expect(mocked.controllerSocket.emit).toHaveBeenCalledWith(
      "controller:join",
      expect.objectContaining({
        roomId: "ROOM1",
        controllerId: "ctrl_1",
        nickname: undefined,
      }),
      expect.any(Function),
    );
  });

  it("resets controller game state to paused on disconnect", async () => {
    const { result } = renderHook(() => useAirJamController(), {
      wrapper: createControllerWrapper({
        roomId: "ROOM1",
        controllerId: "ctrl_1",
      }),
    });

    await waitFor(() => {
      expect(result.current.connectionStatus).toBe("connected");
    });

    const stateHandler = mocked.controllerSocket.on.mock.calls.find(
      ([event]: [string]) => event === "server:state",
    )?.[1] as ((payload: { roomId: string; state: { runtimeState?: "paused" | "playing" } }) => void) | undefined;
    expect(stateHandler).toBeDefined();

    act(() => {
      stateHandler?.({
        roomId: "ROOM1",
        state: { runtimeState: "playing" },
      });
    });
    expect(result.current.runtimeState).toBe("playing");

    const disconnectHandler = mocked.controllerSocket.on.mock.calls.find(
      ([event]: [string]) => event === "disconnect",
    )?.[1] as ((reason?: string) => void) | undefined;
    expect(disconnectHandler).toBeDefined();

    act(() => {
      disconnectHandler?.("transport close");
    });

    expect(result.current.connectionStatus).toBe("disconnected");
    expect(result.current.runtimeState).toBe("paused");
  });

  it("hydrates controller players from the welcome roster", async () => {
    const { result } = renderHook(() => useAirJamController(), {
      wrapper: createControllerWrapper({
        roomId: "ROOM1",
        controllerId: "ctrl_1",
      }),
    });

    await waitFor(() => {
      expect(result.current.connectionStatus).toBe("connected");
    });

    const welcomeHandler = mocked.controllerSocket.on.mock.calls.find(
      ([event]: [string]) => event === "server:welcome",
    )?.[1] as
      | ((
          payload: {
            controllerId: string;
            roomId: string;
            player?: { id: string; label: string };
            players?: Array<{ id: string; label: string }>;
          },
        ) => void)
      | undefined;
    expect(welcomeHandler).toBeDefined();

    act(() => {
      welcomeHandler?.({
        controllerId: "ctrl_1",
        roomId: "ROOM1",
        player: { id: "ctrl_1", label: "Alpha" },
        players: [
          { id: "ctrl_1", label: "Alpha" },
          { id: "ctrl_2", label: "Beta" },
        ],
      });
    });

    expect(result.current.players).toEqual([
      { id: "ctrl_1", label: "Alpha" },
      { id: "ctrl_2", label: "Beta" },
    ]);
  });

  it("applies controller roster join and leave notices after welcome", async () => {
    const { result } = renderHook(() => useAirJamController(), {
      wrapper: createControllerWrapper({
        roomId: "ROOM1",
        controllerId: "ctrl_1",
      }),
    });

    await waitFor(() => {
      expect(result.current.connectionStatus).toBe("connected");
    });

    const joinedHandler = mocked.controllerSocket.on.mock.calls.find(
      ([event]: [string]) => event === "server:controllerJoined",
    )?.[1] as
      | ((payload: {
          controllerId: string;
          player?: { id: string; label: string };
        }) => void)
      | undefined;
    const leftHandler = mocked.controllerSocket.on.mock.calls.find(
      ([event]: [string]) => event === "server:controllerLeft",
    )?.[1] as
      | ((payload: { controllerId: string }) => void)
      | undefined;
    expect(joinedHandler).toBeDefined();
    expect(leftHandler).toBeDefined();

    act(() => {
      joinedHandler?.({
        controllerId: "ctrl_2",
        player: { id: "ctrl_2", label: "Beta" },
      });
    });

    expect(result.current.players).toContainEqual({
      id: "ctrl_2",
      label: "Beta",
    });

    act(() => {
      leftHandler?.({
        controllerId: "ctrl_2",
      });
    });

    expect(result.current.players).not.toContainEqual({
      id: "ctrl_2",
      label: "Beta",
    });
  });

  it("recovers host status when the cached socket is already connected", async () => {
    mocked.store?.getState().setRoomId("ROOM1");
    mocked.store?.getState().setRegisteredRoomId("ROOM1");
    sessionStorage.setItem("airjam_room_id", "ROOM1");
    mocked.hostSocket.emit.mockImplementation(
      (
        event: string,
        _payload: unknown,
        callback?: (ack: unknown) => void,
      ) => {
        if (event === "host:bootstrap") {
          callback?.({ ok: true });
        }
        if (event === "host:reconnect") {
          callback?.({ ok: true, roomId: "ROOM1" });
        }
      },
    );

    const { result } = renderHook(() => useAirJamHost(), {
      wrapper: createHostWrapper(),
    });

    await waitFor(() => {
      expect(result.current.connectionStatus).toBe("connected");
    });

    expect(mocked.hostSocket.connect).not.toHaveBeenCalled();
    expect(mocked.hostSocket.emit).toHaveBeenCalledWith(
      "host:bootstrap",
      { appId: undefined, hostSessionKind: "game" },
      expect.any(Function),
    );
  });

  it("hydrates existing players from the host reconnect ack", async () => {
    mocked.store?.getState().setRoomId("ROOM1");
    mocked.store?.getState().setRegisteredRoomId("ROOM1");
    sessionStorage.setItem("airjam_room_id", "ROOM1");
    mocked.hostSocket.emit.mockImplementation(
      (
        event: string,
        _payload: unknown,
        callback?: (ack: unknown) => void,
      ) => {
        if (event === "host:bootstrap") {
          callback?.({ ok: true });
        }
        if (event === "host:reconnect") {
          callback?.({
            ok: true,
            roomId: "ROOM1",
            players: [
              {
                id: "ctrl_existing_1",
                label: "Existing Player",
                avatarId: "avatar-1",
              },
            ],
          });
        }
      },
    );

    const { result } = renderHook(() => useAirJamHost(), {
      wrapper: createHostWrapper(),
    });

    await waitFor(() => {
      expect(result.current.connectionStatus).toBe("connected");
    });

    expect(result.current.players).toEqual([
      {
        id: "ctrl_existing_1",
        label: "Existing Player",
        avatarId: "avatar-1",
      },
    ]);
  });

  it("blocks direct host state emits when the active room is no longer authoritative", async () => {
    mocked.store?.getState().setRoomId("ROOM1");
    mocked.store?.getState().setRegisteredRoomId("ROOM1");
    sessionStorage.setItem("airjam_room_id", "ROOM1");
    mocked.hostSocket.emit.mockImplementation(
      (
        event: string,
        _payload: unknown,
        callback?: (ack: unknown) => void,
      ) => {
        if (event === "host:bootstrap") {
          callback?.({ ok: true });
        }
        if (event === "host:reconnect") {
          callback?.({ ok: true, roomId: "ROOM1" });
        }
      },
    );

    const { result } = renderHook(() => useAirJamHost(), {
      wrapper: createHostWrapper(),
    });

    await waitFor(() => {
      expect(result.current.connectionStatus).toBe("connected");
    });

    expect(
      result.current.sendState({
        runtimeState: "playing",
      }),
    ).toBe(true);
    expect(mocked.hostSocket.emit).toHaveBeenCalledWith(
      "host:state",
      {
        roomId: "ROOM1",
        state: {
          runtimeState: "playing",
        },
      },
    );

    act(() => {
      mocked.store?.getState().setRegisteredRoomId(null);
    });

    expect(
      result.current.sendState({
        runtimeState: "paused",
      }),
    ).toBe(false);
    expect(
      mocked.hostSocket.emit.mock.calls.filter(
        ([event]: [string, ...unknown[]]) => event === "host:state",
      ),
    ).toHaveLength(1);
  });

  it("fetches a signed host grant before bootstrap when a grant endpoint is configured", async () => {
    mocked.store?.getState().setRoomId("ROOM1");
    mocked.store?.getState().setRegisteredRoomId("ROOM1");
    sessionStorage.setItem("airjam_room_id", "ROOM1");
    mocked.useAirJamContext.mockReturnValue({
      config: {
        appId: "aj_app_demo",
        hostSessionKind: "game",
        hostGrantEndpoint: "/api/airjam/host-grant",
        maxPlayers: 8,
        publicHost: "http://localhost:3000",
        resolveEnv: true,
        serverUrl: "http://localhost:3001",
      },
      store: mocked.store,
      getSocket: (role: "host" | "controller") =>
        role === "controller" ? mocked.controllerSocket : mocked.hostSocket,
      disconnectSocket: vi.fn(),
      inputManager: null,
    });
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ hostGrant: "signed_host_grant" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    mocked.hostSocket.emit.mockImplementation(
      (
        event: string,
        _payload: unknown,
        callback?: (ack: unknown) => void,
      ) => {
        if (event === "host:bootstrap") {
          callback?.({ ok: true });
        }
        if (event === "host:reconnect") {
          callback?.({ ok: true, roomId: "ROOM1" });
        }
      },
    );

    const { result } = renderHook(() => useAirJamHost(), {
      wrapper: createHostWrapper(),
    });

    await waitFor(() => {
      expect(result.current.connectionStatus).toBe("connected");
    });

    expect(fetch).toHaveBeenCalledWith("/api/airjam/host-grant", {
      method: "POST",
      credentials: "include",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ appId: "aj_app_demo" }),
    });
    expect(mocked.hostSocket.emit).toHaveBeenCalledWith(
      "host:bootstrap",
      { hostGrant: "signed_host_grant", hostSessionKind: "game" },
      expect.any(Function),
    );
  });

  it("emits a diagnostic when host bootstrap is rejected", async () => {
    const diagnostics: string[] = [];
    const unsubscribe = onAirJamDiagnostic((diagnostic) => {
      diagnostics.push(diagnostic.code);
    });

    mocked.hostSocket.emit.mockImplementation(
      (
        event: string,
        _payload: unknown,
        callback?: (ack: unknown) => void,
      ) => {
        if (event === "host:bootstrap") {
          callback?.({
            ok: false,
            code: "INVALID_APP_ID",
            message: "Unauthorized: Invalid or Missing App ID",
          });
        }
      },
    );

    const { result } = renderHook(() => useAirJamHost(), {
      wrapper: createHostWrapper(),
    });

    await waitFor(() => {
      expect(result.current.connectionStatus).toBe("disconnected");
    });

    expect(result.current.lastError).toBe(
      "Unauthorized: Invalid or Missing App ID",
    );
    expect(diagnostics).toContain("AJ_HOST_BOOTSTRAP_FAILED");
    unsubscribe();
  });

  it("does not re-bootstrap on the same socket after createRoom updates room state", async () => {
    sessionStorage.clear();

    mocked.hostSocket.emit.mockImplementation(
      (
        event: string,
        _payload: unknown,
        callback?: (ack: unknown) => void,
      ) => {
        if (event === "host:bootstrap") {
          callback?.({ ok: true });
          return;
        }
        if (event === "host:createRoom") {
          callback?.({ ok: true, roomId: "ROOM1" });
        }
      },
    );

    const { result } = renderHook(() => useAirJamHost(), {
      wrapper: createHostWrapper(),
    });

    await waitFor(() => {
      expect(result.current.connectionStatus).toBe("connected");
      expect(result.current.roomId).toBe("ROOM1");
    });

    await waitFor(() => {
      expect(
        mocked.hostSocket.emit.mock.calls.filter(
          ([event]: [string, ...unknown[]]) => event === "host:bootstrap",
        ),
      ).toHaveLength(1);
    });

    expect(
      mocked.hostSocket.emit.mock.calls.filter(
        ([event]: [string, ...unknown[]]) => event === "host:createRoom",
      ),
    ).toHaveLength(1);
    expect(
      mocked.hostSocket.emit.mock.calls.filter(
        ([event]: [string, ...unknown[]]) => event === "host:reconnect",
      ),
    ).toHaveLength(0);
  });

  it("clears room authority before reconnect fallback creates a replacement room", async () => {
    mocked.store?.getState().setRoomId("ROOM1");
    mocked.store?.getState().setRegisteredRoomId("ROOM1");
    sessionStorage.setItem("airjam_room_id", "ROOM1");

    mocked.hostSocket.emit.mockImplementation(
      (
        event: string,
        payload: unknown,
        callback?: (ack: unknown) => void,
      ) => {
        if (event === "host:bootstrap") {
          callback?.({ ok: true });
          return;
        }
        if (event === "host:reconnect") {
          callback?.({
            ok: false,
            code: "ROOM_NOT_FOUND",
            message: "Room missing",
          });
          return;
        }
        if (event === "host:createRoom") {
          expect(mocked.store?.getState().registeredRoomId).toBeNull();
          expect(payload).toMatchObject({
            maxPlayers: 8,
          });
          callback?.({ ok: true, roomId: "ROOM2" });
        }
      },
    );

    const { result } = renderHook(() => useAirJamHost(), {
      wrapper: createHostWrapper(),
    });

    await waitFor(() => {
      expect(result.current.connectionStatus).toBe("connected");
      expect(result.current.roomId).toBe("ROOM2");
    });

    expect(mocked.store?.getState().registeredRoomId).toBe("ROOM2");
    expect(sessionStorage.getItem("airjam_room_id")).toBe("ROOM2");
  });

  it("prefers the injected arcade join url in child-host mode", async () => {
    window.history.replaceState(
      {},
      "",
      "/game?aj_room=ROOM1&aj_cap=join_123&aj_cap_exp=1700000000000&aj_join_url=https%3A%2F%2Fplatform.example%2Fcontroller%3Froom%3DROOM1&aj_arcade_epoch=2&aj_arcade_kind=game&aj_arcade_game_id=pong",
    );

    const { result } = renderHook(() => useAirJamHost(), {
      wrapper: createHostWrapper(),
    });

    await waitFor(() => {
      expect(result.current.joinUrl).toBe(
        "https://platform.example/controller?room=ROOM1",
      );
    });
  });

  it("uses the embedded host bridge without opening a direct host socket", async () => {
    window.history.replaceState(
      {},
      "",
      "/game?aj_room=ROOM1&aj_cap=join_123&aj_cap_exp=1700000000000&aj_join_url=https%3A%2F%2Fplatform.example%2Fcontroller%3Froom%3DROOM1&aj_arcade_epoch=2&aj_arcade_kind=game&aj_arcade_game_id=pong",
    );
    const postMessageSpy = vi.spyOn(window.parent, "postMessage");

    const { result, unmount } = renderHook(() => useAirJamHost(), {
      wrapper: createHostWrapper(),
    });
    const requestCall = postMessageSpy.mock.calls[0] as unknown[] | undefined;
    const bridgePort = (requestCall?.[2] as MessagePort[] | undefined)?.[0];
    expect(bridgePort).toBeDefined();

    act(() => {
      bridgePort!.postMessage({
        type: "AIRJAM_HOST_BRIDGE_ATTACH",
        payload: {
          handshake: {
            protocolVersion: "2",
            sdkVersion: "1.0.0",
            runtimeKind: "arcade-host-runtime",
            capabilityFlags: {
              hostBridge: true,
            },
          },
          snapshot: {
            roomId: "ROOM1",
            capabilityToken: "join_123",
            connected: true,
            players: [],
            arcadeSurface: { epoch: 2, kind: "game", gameId: "pong" },
          },
        },
      });
    });

    await waitFor(() => {
      expect(result.current.connectionStatus).toBe("connected");
    });

    expect(mocked.hostSocket.connect).not.toHaveBeenCalled();
    expect(mocked.hostSocket.emit).not.toHaveBeenCalledWith(
      "host:joinAsChild",
      expect.anything(),
      expect.any(Function),
    );

    unmount();
  });

  it("uses the embedded controller bridge without opening a direct controller socket", async () => {
    window.history.replaceState(
      {},
      "",
      "/controller?aj_room=ROOM1&aj_controller_id=ctrl_1&aj_arcade_epoch=2&aj_arcade_kind=game&aj_arcade_game_id=pong&aj_player_label=Captain&aj_player_avatar=aj-3",
    );
    const postMessageSpy = vi.spyOn(window.parent, "postMessage");

    const { result, unmount } = renderHook(() => useAirJamController(), {
      wrapper: createControllerWrapper(),
    });
    const requestCall = postMessageSpy.mock.calls[0] as unknown[] | undefined;
    const bridgePort = (requestCall?.[2] as MessagePort[] | undefined)?.[0];
    expect(bridgePort).toBeDefined();

    act(() => {
      bridgePort!.postMessage({
        type: "AIRJAM_CONTROLLER_BRIDGE_ATTACH",
        payload: {
          handshake: {
            protocolVersion: "2",
            sdkVersion: "1.0.0",
            runtimeKind: "arcade-controller-runtime",
            capabilityFlags: {
              controllerBridge: true,
            },
          },
          snapshot: {
            roomId: "ROOM1",
            controllerId: "ctrl_1",
            connected: true,
            arcadeSurface: { epoch: 2, kind: "game", gameId: "pong" },
          },
        },
      });
    });

    await waitFor(() => {
      expect(result.current.connectionStatus).toBe("connected");
    });
    expect(result.current.selfPlayer).toMatchObject({
      id: "ctrl_1",
      label: "Captain",
      avatarId: "aj-3",
    });

    expect(mocked.controllerSocket.connect).not.toHaveBeenCalled();
    expect(mocked.controllerSocket.emit).not.toHaveBeenCalledWith(
      "controller:join",
      expect.anything(),
      expect.any(Function),
    );

    unmount();
  });
});

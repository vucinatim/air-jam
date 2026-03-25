// @vitest-environment jsdom

import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAirJamController } from "../src/hooks/use-air-jam-controller";
import { useAirJamHost } from "../src/hooks/use-air-jam-host";
import { resetControllerRealtimeClientForTests } from "../src/runtime/controller-realtime-client";
import { resetHostRealtimeClientForTests } from "../src/runtime/host-realtime-client";
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

vi.mock("../src/context/air-jam-context", () => ({
  useAirJamContext: mocked.useAirJamContext,
}));

vi.mock("../src/context/session-providers", () => ({
  useAssertSessionScope: mocked.useAssertSessionScope,
  useClaimSessionRuntimeOwner: mocked.useClaimSessionRuntimeOwner,
}));

describe("session reconnect behavior", () => {
  beforeEach(() => {
    window.history.replaceState({}, "", "/");
    mocked.store = createAirJamStore();
    mocked.controllerSocket = mocked.createMockSocket();
    mocked.hostSocket = mocked.createMockSocket();

    mocked.useAirJamContext.mockReturnValue({
      config: {
        apiKey: undefined,
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
    vi.restoreAllMocks();
  });

  it("recovers controller status when the cached socket is already connected", async () => {
    const { result } = renderHook(() =>
      useAirJamController({
        roomId: "ROOM1",
        controllerId: "ctrl_1",
      }),
    );

    await waitFor(() => {
      expect(result.current.connectionStatus).toBe("connected");
    });

    expect(mocked.controllerSocket.connect).not.toHaveBeenCalled();
    expect(mocked.controllerSocket.emit).toHaveBeenCalledWith(
      "controller:join",
      {
        roomId: "ROOM1",
        controllerId: "ctrl_1",
        nickname: undefined,
      },
      expect.any(Function),
    );
  });

  it("recovers host status when the cached socket is already connected", async () => {
    mocked.store?.getState().setRoomId("ROOM1");
    mocked.store?.getState().setRegisteredRoomId("ROOM1");

    const { result } = renderHook(() => useAirJamHost());

    await waitFor(() => {
      expect(result.current.connectionStatus).toBe("connected");
    });

    expect(mocked.hostSocket.connect).not.toHaveBeenCalled();
  });

  it("prefers the injected arcade join url in child-host mode", async () => {
    window.history.replaceState(
      {},
      "",
      "/game?aj_room=ROOM1&aj_token=join_123&aj_join_url=https%3A%2F%2Fplatform.example%2Fcontroller%3Froom%3DROOM1&aj_arcade_epoch=2&aj_arcade_kind=game&aj_arcade_game_id=pong",
    );

    const { result } = renderHook(() => useAirJamHost());

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
      "/game?aj_room=ROOM1&aj_token=join_123&aj_join_url=https%3A%2F%2Fplatform.example%2Fcontroller%3Froom%3DROOM1&aj_arcade_epoch=2&aj_arcade_kind=game&aj_arcade_game_id=pong",
    );
    const postMessageSpy = vi.spyOn(window.parent, "postMessage");

    const { result, unmount } = renderHook(() => useAirJamHost());
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
            joinToken: "join_123",
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

    const { result, unmount } = renderHook(() => useAirJamController());
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

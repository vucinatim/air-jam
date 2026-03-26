// @vitest-environment jsdom

import { render, screen, waitFor } from "@testing-library/react";
import { renderHook } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RoomQrCode } from "../src/components/room-qr-code";
import { useAirJamHost } from "../src/hooks/use-air-jam-host";
import { resetHostRealtimeClientForTests } from "../src/runtime/host-realtime-client";
import { createAirJamStore } from "../src/state/connection-store";
import { urlBuilder } from "../src/utils/url-builder";

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
  hostSocket: null as unknown,
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

describe("host join url behavior", () => {
  beforeEach(() => {
    window.history.replaceState({}, "", "/");
    mocked.store = createAirJamStore();
    mocked.hostSocket = mocked.createMockSocket();

    mocked.useAirJamContext.mockReturnValue({
      config: {
        appId: undefined,
        maxPlayers: 8,
        publicHost: "http://localhost:3000",
        resolveEnv: true,
        serverUrl: "http://localhost:3001",
      },
      store: mocked.store,
      getSocket: () => mocked.hostSocket,
      disconnectSocket: vi.fn(),
      inputManager: null,
    });
  });

  afterEach(() => {
    window.history.replaceState({}, "", "/");
    resetHostRealtimeClientForTests();
    vi.restoreAllMocks();
  });

  it("reports loading until the host join url resolves", async () => {
    mocked.store?.getState().setRoomId("ROOM1");
    mocked.store?.getState().setRegisteredRoomId("ROOM1");

    let resolveUrl: ((value: string) => void) | null = null;
    vi.spyOn(urlBuilder, "buildControllerUrl").mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveUrl = resolve;
        }),
    );

    const { result } = renderHook(() => useAirJamHost());

    expect(result.current.joinUrlStatus).toBe("loading");
    expect(result.current.joinUrl).toBe("");

    if (!resolveUrl) {
      throw new Error("Expected buildControllerUrl resolver to be captured");
    }
    const resolveJoinUrl = resolveUrl as (value: string) => void;
    resolveJoinUrl("https://platform.example/controller?room=ROOM1");

    await waitFor(() => {
      expect(result.current.joinUrlStatus).toBe("ready");
    });
    expect(result.current.joinUrl).toBe(
      "https://platform.example/controller?room=ROOM1",
    );
  });

  it("shows a loading state while the QR image is being generated", () => {
    render(
      createElement(RoomQrCode, {
        value: "https://platform.example/controller?room=ROOM1",
      }),
    );

    expect(screen.getByText("Generating QR…")).toBeTruthy();
  });
});

// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createAirJamStore } from "../src/store/create-air-jam-store";

type Role = "host" | "controller";

const mockedContext = vi.hoisted(() => {
  const state = {
    role: "controller" as Role,
    roomId: "ROOM1",
    controllerId: "ctrl_1",
  };

  return {
    state,
    useAirJamContext: vi.fn(),
    useAirJamState: vi.fn((selector: (s: typeof state) => unknown) =>
      selector(state),
    ),
  };
});

vi.mock("../src/context/air-jam-context", () => ({
  useAirJamContext: mockedContext.useAirJamContext,
  useAirJamState: mockedContext.useAirJamState,
}));

interface EmittedCall {
  event: string;
  args: unknown[];
}

class MockSocket {
  id = "socket_1";
  connected = true;
  emitted: EmittedCall[] = [];
  private listeners = new Map<string, Set<(...args: unknown[]) => void>>();

  on(event: string, listener: (...args: unknown[]) => void): this {
    const set = this.listeners.get(event) ?? new Set();
    set.add(listener);
    this.listeners.set(event, set);
    return this;
  }

  off(event: string, listener?: (...args: unknown[]) => void): this {
    if (!listener) {
      this.listeners.delete(event);
      return this;
    }

    const set = this.listeners.get(event);
    if (set) {
      set.delete(listener);
      if (set.size === 0) {
        this.listeners.delete(event);
      }
    }
    return this;
  }

  emit(event: string, ...args: unknown[]): void {
    this.emitted.push({ event, args });
  }

  trigger(event: string, ...args: unknown[]): void {
    const set = this.listeners.get(event);
    if (!set) {
      return;
    }

    for (const listener of set) {
      listener(...args);
    }
  }
}

interface TestStoreState {
  phase: string;
  actions: {
    joinTeam: (team: string, controllerId?: string) => void;
    setPhase: (phase: string) => void;
  };
}

const createTestStore = () =>
  createAirJamStore<TestStoreState>((set) => ({
    phase: "lobby",
    actions: {
      joinTeam: (team) => set({ phase: team }),
      setPhase: (phase) => set({ phase }),
    },
  }));

describe("createAirJamStore networked behavior", () => {
  let hostSocket: MockSocket;
  let controllerSocket: MockSocket;
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    hostSocket = new MockSocket();
    controllerSocket = new MockSocket();

    mockedContext.state.role = "controller";
    mockedContext.state.roomId = "ROOM1";
    mockedContext.state.controllerId = "ctrl_1";

    mockedContext.useAirJamContext.mockReturnValue({
      getSocket: (role: Role) =>
        role === "host" ? (hostSocket as unknown) : (controllerSocket as unknown),
    });

    mockedContext.useAirJamState.mockImplementation(
      (selector: (s: typeof mockedContext.state) => unknown) =>
        selector(mockedContext.state),
    );

    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it("proxies controller public actions over action RPC", () => {
    const useStore = createTestStore();
    const { result, unmount } = renderHook(() => useStore((state) => state.actions));

    act(() => {
      result.current.joinTeam("red");
    });

    const rpcEmit = controllerSocket.emitted.find(
      (call) => call.event === "controller:action_rpc",
    );

    expect(rpcEmit?.args[0]).toEqual({
      roomId: "ROOM1",
      actionName: "joinTeam",
      args: ["red"],
      controllerId: "ctrl_1",
    });

    unmount();
  });

  it("hides internal actions on controller and blocks emits after unload", () => {
    const useStore = createTestStore();
    const { result, unmount } = renderHook(() => useStore((state) => state.actions));

    expect(
      Object.prototype.hasOwnProperty.call(
        result.current as unknown as Record<string, unknown>,
        "_syncState",
      ),
    ).toBe(false);

    act(() => {
      result.current.joinTeam("blue");
    });

    expect(
      controllerSocket.emitted.filter((call) => call.event === "controller:action_rpc")
        .length,
    ).toBe(1);

    act(() => {
      controllerSocket.trigger("client:unloadUi");
      result.current.joinTeam("green");
    });

    expect(
      controllerSocket.emitted.filter((call) => call.event === "controller:action_rpc")
        .length,
    ).toBe(1);

    unmount();
  });

  it("applies host state sync payload to controller state", () => {
    const useStore = createTestStore();
    const { result, unmount } = renderHook(() => useStore((state) => state.phase));

    expect(result.current).toBe("lobby");

    act(() => {
      controllerSocket.trigger("airjam:state_sync", {
        roomId: "ROOM1",
        data: { phase: "playing" },
      });
    });

    expect(result.current).toBe("playing");

    unmount();
  });

  it("executes host-side action RPCs and ignores internal action names", () => {
    mockedContext.state.role = "host";

    const useStore = createTestStore();
    const { result, unmount } = renderHook(() => useStore((state) => state.phase));

    act(() => {
      hostSocket.trigger("airjam:action_rpc", {
        actionName: "setPhase",
        args: ["playing"],
        controllerId: "ctrl_remote",
      });
    });

    expect(result.current).toBe("playing");

    act(() => {
      hostSocket.trigger("airjam:action_rpc", {
        actionName: "_syncState",
        args: [{ phase: "hacked" }],
        controllerId: "ctrl_remote",
      });
    });

    expect(result.current).toBe("playing");

    unmount();
  });
});

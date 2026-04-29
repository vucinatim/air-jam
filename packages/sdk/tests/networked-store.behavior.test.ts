// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  onAirJamDiagnostic,
  resetAirJamDiagnosticsForTests,
  setAirJamDiagnosticsEnabled,
} from "../src/diagnostics";
import type { HostArcadeRestoreState } from "../src/state/connection-store";
import {
  AIR_JAM_ARCADE_SURFACE_STORE_DOMAIN,
  AIR_JAM_DEFAULT_STORE_DOMAIN,
} from "../src/store/air-jam-store-domain-constants";
import {
  createAirJamStore,
  rejectAirJamAction,
  type AirJamActionContext,
} from "../src/store/create-air-jam-store";

type Role = "host" | "controller";

const mockedContext = vi.hoisted(() => {
  const state = {
    role: "controller" as Role,
    roomId: "ROOM1",
    registeredRoomId: "ROOM1",
    connectionStatus: "connected" as const,
    controllerId: "ctrl_1",
    players: [
      { id: "ctrl_1", label: "Player 1" },
      { id: "ctrl_2", label: "Player 2" },
    ],
    hostArcadeRestore: {
      phase: "idle" as const,
      session: null as null,
    } as HostArcadeRestoreState,
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
    const callback = args[args.length - 1];
    if (typeof callback === "function" && event === "controller:action_rpc") {
      (
        callback as (ack: {
          ok: true;
          status: "accepted";
          source: "host";
        }) => void
      )({
        ok: true,
        status: "accepted",
        source: "host",
      });
    }
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
  lastActor?: string;
  lastRole?: "controller" | "host";
  lastConnectedPlayerIds?: string[];
  actions: {
    joinTeam: (ctx: AirJamActionContext, payload: { team: string }) => void;
    setPhase: (ctx: AirJamActionContext, payload: { phase: string }) => void;
  };
}

const createTestStore = () =>
  createAirJamStore<TestStoreState>((set) => ({
    phase: "lobby",
    lastActor: undefined,
    lastRole: undefined,
    actions: {
      joinTeam: (ctx, { team }) =>
        set({
          phase: team,
          lastActor: ctx.actorId,
          lastRole: ctx.role,
          lastConnectedPlayerIds: ctx.connectedPlayerIds,
        }),
      setPhase: (ctx, { phase }) =>
        set({
          phase,
          lastActor: ctx.actorId,
          lastRole: ctx.role,
          lastConnectedPlayerIds: ctx.connectedPlayerIds,
        }),
    },
  }));

interface CounterStoreState {
  count: number;
  actions: {
    increment: (ctx: AirJamActionContext, payload: { amount: number }) => void;
  };
}

const createCounterStore = () =>
  createAirJamStore<CounterStoreState>((set) => ({
    count: 0,
    actions: {
      increment: (_ctx, { amount }) =>
        set((state) => ({ count: state.count + amount })),
    },
  }));

describe("createAirJamStore networked behavior", () => {
  let hostSocket: MockSocket;
  let controllerSocket: MockSocket;
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    resetAirJamDiagnosticsForTests();
    setAirJamDiagnosticsEnabled(true);

    hostSocket = new MockSocket();
    controllerSocket = new MockSocket();

    mockedContext.state.role = "controller";
    mockedContext.state.roomId = "ROOM1";
    mockedContext.state.registeredRoomId = "ROOM1";
    mockedContext.state.connectionStatus = "connected";
    mockedContext.state.controllerId = "ctrl_1";
    mockedContext.state.players = [
      { id: "ctrl_1", label: "Player 1" },
      { id: "ctrl_2", label: "Player 2" },
    ];
    mockedContext.state.hostArcadeRestore = {
      phase: "idle",
      session: null,
    } as HostArcadeRestoreState;

    mockedContext.useAirJamContext.mockReturnValue({
      getSocket: (role: Role) =>
        role === "host"
          ? (hostSocket as unknown)
          : (controllerSocket as unknown),
    });

    mockedContext.useAirJamState.mockImplementation(
      (selector: (s: typeof mockedContext.state) => unknown) =>
        selector(mockedContext.state),
    );

    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
    resetAirJamDiagnosticsForTests();
  });

  it("proxies controller public actions over action RPC", async () => {
    const useStore = createTestStore();
    const { result, unmount } = renderHook(() => useStore.useActions());

    let acknowledgement:
      | Awaited<ReturnType<typeof result.current.joinTeam>>
      | undefined;
    await act(async () => {
      acknowledgement = await result.current.joinTeam({ team: "red" });
    });

    const rpcEmit = controllerSocket.emitted.find(
      (call) => call.event === "controller:action_rpc",
    );

    expect(rpcEmit?.args[0]).toEqual({
      roomId: "ROOM1",
      actionName: "joinTeam",
      payload: { team: "red" },
      storeDomain: AIR_JAM_DEFAULT_STORE_DOMAIN,
    });
    expect(
      controllerSocket.emitted.some(
        (call) => call.event === "controller:input",
      ),
    ).toBe(false);
    expect(acknowledgement).toEqual({
      ok: true,
      status: "accepted",
      source: "host",
    });

    unmount();
  });

  it("exposes imperative getState and subscribe on the synced store hook", () => {
    const useStore = createCounterStore();
    const observedCounts: number[] = [];
    const mountedStore = renderHook(() => useStore());

    const unsubscribe = useStore.subscribe((state) => {
      observedCounts.push(state.count);
    });

    expect(useStore.getState().count).toBe(0);

    act(() => {
      controllerSocket.trigger("airjam:state_sync", {
        roomId: "ROOM1",
        storeDomain: AIR_JAM_DEFAULT_STORE_DOMAIN,
        data: { count: 3 },
      });
    });

    expect(useStore.getState().count).toBe(3);
    expect(observedCounts).toContain(3);

    unsubscribe();
    mountedStore.unmount();
  });

  it("provides a supported live state ref hook for runtime extensions", () => {
    const useStore = createCounterStore();
    const { result, unmount } = renderHook(() => useStore.useLiveStateRef());

    expect(result.current.current.count).toBe(0);

    act(() => {
      controllerSocket.trigger("airjam:state_sync", {
        roomId: "ROOM1",
        storeDomain: AIR_JAM_DEFAULT_STORE_DOMAIN,
        data: { count: 5 },
      });
    });

    expect(result.current.current.count).toBe(5);

    unmount();
  });

  it("keeps state lane transport on action RPC even for input-like payload fields", () => {
    const useStore = createTestStore();
    const { result, unmount } = renderHook(() => useStore.useActions());

    act(() => {
      (
        result.current.joinTeam as unknown as (
          payload: Record<string, unknown>,
        ) => void
      )({
        team: "red",
        vector: { x: 1, y: 0 },
        action: true,
      });
    });

    expect(
      controllerSocket.emitted.some(
        (call) => call.event === "controller:action_rpc",
      ),
    ).toBe(true);
    expect(
      controllerSocket.emitted.some(
        (call) => call.event === "controller:input",
      ),
    ).toBe(false);

    unmount();
  });

  it("hides internal actions on controller and blocks emits after disconnect", () => {
    const useStore = createTestStore();
    const { result, unmount } = renderHook(() => useStore.useActions());

    expect(
      Object.prototype.hasOwnProperty.call(
        result.current as unknown as Record<string, unknown>,
        "_syncState",
      ),
    ).toBe(false);

    act(() => {
      result.current.joinTeam({ team: "blue" });
    });

    expect(
      controllerSocket.emitted.filter(
        (call) => call.event === "controller:action_rpc",
      ).length,
    ).toBe(1);

    act(() => {
      controllerSocket.connected = false;
      controllerSocket.trigger("disconnect", "closed");
      result.current.joinTeam({ team: "green" });
    });

    expect(
      controllerSocket.emitted.filter(
        (call) => call.event === "controller:action_rpc",
      ).length,
    ).toBe(1);

    unmount();
  });

  it("blocks controller action RPC payloads that are not serializable", () => {
    const diagnostics: string[] = [];
    const unsubscribe = onAirJamDiagnostic((diagnostic) => {
      diagnostics.push(diagnostic.code);
    });

    const useStore = createTestStore();
    const { result, unmount } = renderHook(() => useStore.useActions());

    act(() => {
      (result.current.joinTeam as unknown as (payload: unknown) => void)({
        team: "blue",
        bad: () => "fn",
      });
    });

    expect(
      controllerSocket.emitted.filter(
        (call) => call.event === "controller:action_rpc",
      ).length,
    ).toBe(0);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        '[AirJamStore] Action "joinTeam" blocked: payload must be RPC-serializable.',
      ),
      expect.objectContaining({ actionName: "joinTeam" }),
    );
    expect(diagnostics).toContain("AJ_STORE_ACTION_PAYLOAD_NOT_SERIALIZABLE");

    unmount();
    unsubscribe();
  });

  it("blocks controller action RPC payloads that are not plain objects", () => {
    const diagnostics: string[] = [];
    const unsubscribe = onAirJamDiagnostic((diagnostic) => {
      diagnostics.push(diagnostic.code);
    });

    const useStore = createTestStore();
    const { result, unmount } = renderHook(() => useStore.useActions());

    act(() => {
      (result.current.joinTeam as unknown as (payload: unknown) => void)([
        "red",
        "blue",
      ]);
    });

    expect(
      controllerSocket.emitted.filter(
        (call) => call.event === "controller:action_rpc",
      ).length,
    ).toBe(0);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        '[AirJamStore] Action "joinTeam" blocked: payload must be omitted or a plain object.',
      ),
      expect.objectContaining({ actionName: "joinTeam" }),
    );
    expect(diagnostics).toContain("AJ_STORE_ACTION_PAYLOAD_INVALID_SHAPE");

    act(() => {
      (result.current.joinTeam as unknown as (payload: unknown) => void)(null);
    });

    expect(
      controllerSocket.emitted.filter(
        (call) => call.event === "controller:action_rpc",
      ).length,
    ).toBe(0);
    expect(diagnostics).toContain("AJ_STORE_ACTION_PAYLOAD_INVALID_SHAPE");

    unmount();
    unsubscribe();
  });

  it("drops event-like payloads and continues action RPC with undefined payload", () => {
    const diagnostics: string[] = [];
    const unsubscribe = onAirJamDiagnostic((diagnostic) => {
      diagnostics.push(diagnostic.code);
    });

    const useStore = createTestStore();
    const { result, unmount } = renderHook(() => useStore.useActions());

    act(() => {
      (result.current.joinTeam as unknown as (payload: unknown) => void)({
        preventDefault: () => {},
        stopPropagation: () => {},
        target: {},
      });
    });

    const rpcEmit = controllerSocket.emitted.find(
      (call) => call.event === "controller:action_rpc",
    );

    expect(rpcEmit?.args[0]).toEqual({
      roomId: "ROOM1",
      actionName: "joinTeam",
      payload: undefined,
      storeDomain: AIR_JAM_DEFAULT_STORE_DOMAIN,
    });
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        '[AirJamStore] Action "joinTeam" received an event-like payload. Dropping payload and continuing.',
      ),
      expect.objectContaining({ actionName: "joinTeam" }),
    );
    expect(diagnostics).toContain("AJ_STORE_ACTION_EVENT_PAYLOAD_DROPPED");

    unmount();
    unsubscribe();
  });

  it("emits host:state_sync on host mount so controllers can replay current snapshot", () => {
    mockedContext.state.role = "host";

    const useStore = createTestStore();
    const { unmount } = renderHook(() => useStore((state) => state.phase));

    const syncCalls = hostSocket.emitted.filter(
      (call) => call.event === "host:state_sync",
    );
    expect(syncCalls.length).toBeGreaterThanOrEqual(1);
    expect(syncCalls[0]?.args[0]).toEqual({
      roomId: "ROOM1",
      data: { phase: "lobby" },
      storeDomain: AIR_JAM_DEFAULT_STORE_DOMAIN,
    });

    unmount();
  });

  it("suppresses host:state_sync until the registered room matches the active room", () => {
    mockedContext.state.role = "host";
    mockedContext.state.registeredRoomId = "ROOM_OLD";

    const useStore = createTestStore();
    const { rerender, unmount } = renderHook(() =>
      useStore((state) => state.phase),
    );

    expect(
      hostSocket.emitted.filter((call) => call.event === "host:state_sync"),
    ).toHaveLength(0);

    act(() => {
      mockedContext.state.registeredRoomId = "ROOM1";
      rerender();
    });

    expect(
      hostSocket.emitted.some((call) => call.event === "host:state_sync"),
    ).toBe(true);

    unmount();
  });

  it("emits host:state_sync again when player roster changes without a store mutation", () => {
    mockedContext.state.role = "host";

    const useStore = createTestStore();
    const { rerender, unmount } = renderHook(() =>
      useStore((state) => state.phase),
    );

    const countAfterMount = hostSocket.emitted.filter(
      (call) => call.event === "host:state_sync",
    ).length;

    act(() => {
      mockedContext.state.players = [
        ...mockedContext.state.players,
        { id: "ctrl_new", label: "New" },
      ];
      rerender();
    });

    const countAfterRoster = hostSocket.emitted.filter(
      (call) => call.event === "host:state_sync",
    ).length;

    expect(countAfterRoster).toBeGreaterThan(countAfterMount);

    unmount();
  });

  it("emits host:state_sync on server:controllerJoined when roster ids are unchanged (same-controller reconnect)", () => {
    mockedContext.state.role = "host";

    const useStore = createTestStore();
    const { unmount } = renderHook(() => useStore((state) => state.phase));

    const countBefore = hostSocket.emitted.filter(
      (call) => call.event === "host:state_sync",
    ).length;

    act(() => {
      hostSocket.trigger("server:controllerJoined", {
        controllerId: "ctrl_1",
        nickname: "Player 1",
        player: { id: "ctrl_1", label: "Player 1" },
      });
    });

    const countAfter = hostSocket.emitted.filter(
      (call) => call.event === "host:state_sync",
    ).length;

    expect(countAfter).toBeGreaterThan(countBefore);

    unmount();
  });

  it("requests the latest host snapshot when a controller store mounts connected", () => {
    const useStore = createTestStore();
    const { unmount } = renderHook(() => useStore((state) => state.phase));

    const requestCalls = controllerSocket.emitted.filter(
      (call) => call.event === "controller:state_sync_request",
    );

    expect(requestCalls).toHaveLength(1);
    expect(requestCalls[0]?.args[0]).toEqual({
      roomId: "ROOM1",
      storeDomain: AIR_JAM_DEFAULT_STORE_DOMAIN,
    });

    unmount();
  });

  it("flushes host state when a controller requests the latest snapshot for the matching store domain", () => {
    mockedContext.state.role = "host";

    const useStore = createTestStore();
    const { unmount } = renderHook(() => useStore((state) => state.phase));

    const countBefore = hostSocket.emitted.filter(
      (call) => call.event === "host:state_sync",
    ).length;

    act(() => {
      hostSocket.trigger("airjam:state_sync_request", {
        roomId: "ROOM1",
        storeDomain: AIR_JAM_DEFAULT_STORE_DOMAIN,
      });
    });

    const countAfter = hostSocket.emitted.filter(
      (call) => call.event === "host:state_sync",
    ).length;

    expect(countAfter).toBeGreaterThan(countBefore);

    unmount();
  });

  it("applies host state sync payload to controller state", () => {
    const useStore = createTestStore();
    const { result, unmount } = renderHook(() =>
      useStore((state) => state.phase),
    );

    expect(result.current).toBe("lobby");

    act(() => {
      controllerSocket.trigger("airjam:state_sync", {
        roomId: "ROOM1",
        data: { phase: "playing" },
        storeDomain: AIR_JAM_DEFAULT_STORE_DOMAIN,
      });
    });

    expect(result.current).toBe("playing");

    unmount();
  });

  it("ignores controller state sync when storeDomain does not match", () => {
    const useStore = createTestStore();
    const phaseHook = renderHook(() => useStore((state) => state.phase));

    act(() => {
      controllerSocket.trigger("airjam:state_sync", {
        roomId: "ROOM1",
        data: { phase: "playing" },
        storeDomain: "arcade.surface",
      });
    });

    expect(phaseHook.result.current).toBe("lobby");

    act(() => {
      controllerSocket.trigger("airjam:state_sync", {
        roomId: "ROOM1",
        data: { phase: "playing" },
        storeDomain: AIR_JAM_DEFAULT_STORE_DOMAIN,
      });
    });

    expect(phaseHook.result.current).toBe("playing");

    phaseHook.unmount();
  });

  it("ignores host action RPC when storeDomain does not match", () => {
    mockedContext.state.role = "host";

    const useStore = createTestStore();
    const phaseHook = renderHook(() => useStore((state) => state.phase));

    act(() => {
      hostSocket.trigger("airjam:action_rpc", {
        actionName: "setPhase",
        payload: { phase: "playing" },
        storeDomain: "arcade.surface",
        actor: {
          id: "ctrl_remote",
          role: "controller",
        },
      });
    });

    expect(phaseHook.result.current).toBe("lobby");

    act(() => {
      hostSocket.trigger("airjam:action_rpc", {
        actionName: "setPhase",
        payload: { phase: "playing" },
        storeDomain: AIR_JAM_DEFAULT_STORE_DOMAIN,
        actor: {
          id: "ctrl_remote",
          role: "controller",
        },
      });
    });

    expect(phaseHook.result.current).toBe("playing");

    phaseHook.unmount();
  });

  it("executes host-side action RPCs and ignores internal action names", () => {
    mockedContext.state.role = "host";

    const useStore = createTestStore();
    const phaseHook = renderHook(() => useStore((state) => state.phase));
    const actorHook = renderHook(() => useStore((state) => state.lastActor));
    const roleHook = renderHook(() => useStore((state) => state.lastRole));
    const connectedIdsHook = renderHook(() =>
      useStore((state) => state.lastConnectedPlayerIds),
    );

    act(() => {
      hostSocket.trigger("airjam:action_rpc", {
        actionName: "setPhase",
        payload: { phase: "playing" },
        storeDomain: AIR_JAM_DEFAULT_STORE_DOMAIN,
        actor: {
          id: "ctrl_remote",
          role: "controller",
        },
      });
    });

    expect(phaseHook.result.current).toBe("playing");
    expect(actorHook.result.current).toBe("ctrl_remote");
    expect(roleHook.result.current).toBe("controller");
    expect(connectedIdsHook.result.current).toEqual(["ctrl_1", "ctrl_2"]);

    act(() => {
      hostSocket.trigger("airjam:action_rpc", {
        actionName: "_syncState",
        payload: { phase: "hacked" },
        storeDomain: AIR_JAM_DEFAULT_STORE_DOMAIN,
        actor: {
          id: "ctrl_remote",
          role: "controller",
        },
      });
    });

    expect(phaseHook.result.current).toBe("playing");

    phaseHook.unmount();
    actorHook.unmount();
    roleHook.unmount();
    connectedIdsHook.unmount();
  });

  it("executes one host-side action RPC with multiple store consumers", () => {
    mockedContext.state.role = "host";

    const useStore = createCounterStore();
    const firstHook = renderHook(() => useStore((state) => state.count));
    const secondHook = renderHook(() => useStore((state) => state.count));
    const actionsHook = renderHook(() => useStore.useActions());

    act(() => {
      hostSocket.trigger("airjam:action_rpc", {
        actionName: "increment",
        payload: { amount: 1 },
        storeDomain: AIR_JAM_DEFAULT_STORE_DOMAIN,
        actor: {
          id: "ctrl_remote",
          role: "controller",
        },
      });
    });

    expect(firstHook.result.current).toBe(1);
    expect(secondHook.result.current).toBe(1);

    firstHook.unmount();
    secondHook.unmount();
    actionsHook.unmount();
  });

  it("emits one host state sync per mutation with multiple store consumers", () => {
    mockedContext.state.role = "host";

    const useStore = createCounterStore();
    const firstHook = renderHook(() => useStore((state) => state.count));
    const secondHook = renderHook(() => useStore((state) => state.count));
    const actionsHook = renderHook(() => useStore.useActions());

    hostSocket.emitted.length = 0;

    act(() => {
      actionsHook.result.current.increment({ amount: 1 });
    });

    expect(firstHook.result.current).toBe(1);
    expect(
      hostSocket.emitted.filter((call) => call.event === "host:state_sync"),
    ).toHaveLength(1);

    firstHook.unmount();
    secondHook.unmount();
    actionsHook.unmount();
  });

  it("emits one controller state sync request with multiple store consumers", () => {
    const useStore = createTestStore();
    const firstHook = renderHook(() => useStore((state) => state.phase));
    const secondHook = renderHook(() => useStore((state) => state.phase));
    const actionsHook = renderHook(() => useStore.useActions());

    expect(
      controllerSocket.emitted.filter(
        (call) => call.event === "controller:state_sync_request",
      ),
    ).toHaveLength(1);

    firstHook.unmount();
    secondHook.unmount();
    actionsHook.unmount();
  });

  it("executes host local dispatches with host action context", () => {
    mockedContext.state.role = "host";

    const useStore = createTestStore();
    const actionsHook = renderHook(() => useStore.useActions());
    const phaseHook = renderHook(() => useStore((state) => state.phase));
    const actorHook = renderHook(() => useStore((state) => state.lastActor));
    const roleHook = renderHook(() => useStore((state) => state.lastRole));
    const connectedIdsHook = renderHook(() =>
      useStore((state) => state.lastConnectedPlayerIds),
    );

    act(() => {
      actionsHook.result.current.setPhase({ phase: "playing" });
    });

    expect(phaseHook.result.current).toBe("playing");
    expect(actorHook.result.current).toBe("host");
    expect(roleHook.result.current).toBe("host");
    expect(connectedIdsHook.result.current).toEqual(["ctrl_1", "ctrl_2"]);

    actionsHook.unmount();
    phaseHook.unmount();
    actorHook.unmount();
    roleHook.unmount();
    connectedIdsHook.unmount();
  });

  it("executes host player-actions dispatches with controller action context", async () => {
    mockedContext.state.role = "host";

    const useStore = createTestStore();
    const storeHook = renderHook(() => useStore((state) => state.phase));
    const playerActions = useStore.asPlayer("ctrl_2");
    const phaseHook = renderHook(() => useStore((state) => state.phase));
    const actorHook = renderHook(() => useStore((state) => state.lastActor));
    const roleHook = renderHook(() => useStore((state) => state.lastRole));
    const connectedIdsHook = renderHook(() =>
      useStore((state) => state.lastConnectedPlayerIds),
    );

    let acknowledgement:
      | Awaited<ReturnType<typeof playerActions.joinTeam>>
      | undefined;
    await act(async () => {
      acknowledgement = await playerActions.joinTeam({ team: "blue" });
    });

    expect(acknowledgement).toEqual({
      ok: true,
      status: "accepted",
      source: "host",
    });
    expect(phaseHook.result.current).toBe("blue");
    expect(actorHook.result.current).toBe("ctrl_2");
    expect(roleHook.result.current).toBe("controller");
    expect(connectedIdsHook.result.current).toEqual(["ctrl_1", "ctrl_2"]);

    storeHook.unmount();
    phaseHook.unmount();
    actorHook.unmount();
    roleHook.unmount();
    connectedIdsHook.unmount();
  });

  it("rejects player-actions dispatches outside the host runtime", async () => {
    const diagnostics: string[] = [];
    const unsubscribe = onAirJamDiagnostic((diagnostic) => {
      diagnostics.push(diagnostic.code);
    });

    const useStore = createTestStore();
    const storeHook = renderHook(() => useStore((state) => state.phase));
    const playerActions = useStore.asPlayer("ctrl_2");

    let acknowledgement:
      | Awaited<ReturnType<typeof playerActions.joinTeam>>
      | undefined;
    await act(async () => {
      acknowledgement = await playerActions.joinTeam({ team: "blue" });
    });

    expect(acknowledgement).toEqual({
      ok: false,
      status: "rejected",
      source: "client",
      reason: "player_actions_host_only",
      message:
        'Store action "joinTeam" cannot impersonate a player outside the host runtime.',
      details: {
        actionName: "joinTeam",
        role: "controller",
        controllerId: "ctrl_2",
      },
    });
    expect(diagnostics).toContain("AJ_STORE_PLAYER_ACTIONS_HOST_ONLY");

    storeHook.unmount();
    unsubscribe();
  });

  it("rejects player-actions dispatches for disconnected controllers", async () => {
    mockedContext.state.role = "host";

    const diagnostics: string[] = [];
    const unsubscribe = onAirJamDiagnostic((diagnostic) => {
      diagnostics.push(diagnostic.code);
    });

    const useStore = createTestStore();
    const storeHook = renderHook(() => useStore((state) => state.phase));
    const playerActions = useStore.asPlayer("ctrl_missing");

    let acknowledgement:
      | Awaited<ReturnType<typeof playerActions.joinTeam>>
      | undefined;
    await act(async () => {
      acknowledgement = await playerActions.joinTeam({ team: "blue" });
    });

    expect(acknowledgement).toEqual({
      ok: false,
      status: "rejected",
      source: "client",
      reason: "player_not_connected",
      message:
        'Store action "joinTeam" cannot impersonate controller "ctrl_missing" because it is not currently connected.',
      details: {
        actionName: "joinTeam",
        controllerId: "ctrl_missing",
      },
    });
    expect(diagnostics).toContain(
      "AJ_STORE_PLAYER_ACTIONS_PLAYER_NOT_CONNECTED",
    );

    storeHook.unmount();
    unsubscribe();
  });

  it("notifies host action listeners for accepted host local dispatches", async () => {
    mockedContext.state.role = "host";

    const useStore = createTestStore();
    const observedEvents: unknown[] = [];
    const listenerHook = renderHook(() =>
      useStore.useHostActionListener((event) => {
        observedEvents.push(event);
      }),
    );
    const actionsHook = renderHook(() => useStore.useActions());

    await act(async () => {
      await actionsHook.result.current.setPhase({ phase: "playing" });
    });

    expect(observedEvents).toEqual([
      {
        actionName: "setPhase",
        payload: { phase: "playing" },
        context: {
          actorId: "host",
          role: "host",
          connectedPlayerIds: ["ctrl_1", "ctrl_2"],
        },
        acknowledgement: {
          ok: true,
          status: "accepted",
          source: "host",
        },
        invocationKind: "local",
        roomId: "ROOM1",
        storeDomain: AIR_JAM_DEFAULT_STORE_DOMAIN,
      },
    ]);

    listenerHook.unmount();
    actionsHook.unmount();
  });

  it("notifies host action listeners for accepted host player-actions dispatches", async () => {
    mockedContext.state.role = "host";

    const useStore = createTestStore();
    const observedEvents: unknown[] = [];
    const listenerHook = renderHook(() =>
      useStore.useHostActionListener((event) => {
        observedEvents.push(event);
      }),
    );
    const storeHook = renderHook(() => useStore((state) => state.phase));
    const playerActions = useStore.asPlayer("ctrl_2");

    await act(async () => {
      await playerActions.setPhase({ phase: "playing" });
    });

    expect(observedEvents).toEqual([
      {
        actionName: "setPhase",
        payload: { phase: "playing" },
        context: {
          actorId: "ctrl_2",
          role: "controller",
          connectedPlayerIds: ["ctrl_1", "ctrl_2"],
        },
        acknowledgement: {
          ok: true,
          status: "accepted",
          source: "host",
        },
        invocationKind: "local",
        roomId: "ROOM1",
        storeDomain: AIR_JAM_DEFAULT_STORE_DOMAIN,
      },
    ]);

    listenerHook.unmount();
    storeHook.unmount();
  });

  it("notifies host action listeners for accepted RPC dispatches", () => {
    mockedContext.state.role = "host";

    const useStore = createTestStore();
    const observedEvents: unknown[] = [];
    const unsubscribe = useStore.subscribeHostActions((event) => {
      observedEvents.push(event);
    });
    const storeHook = renderHook(() => useStore());

    let acknowledgement: unknown;
    act(() => {
      hostSocket.trigger(
        "airjam:action_rpc",
        {
          roomId: "ROOM1",
          actionName: "setPhase",
          payload: { phase: "ended" },
          actor: {
            id: "ctrl_2",
            role: "controller",
          },
          storeDomain: AIR_JAM_DEFAULT_STORE_DOMAIN,
        },
        (nextAcknowledgement: unknown) => {
          acknowledgement = nextAcknowledgement;
        },
      );
    });

    expect(acknowledgement).toEqual({
      ok: true,
      status: "accepted",
      source: "host",
    });
    expect(observedEvents).toEqual([
      {
        actionName: "setPhase",
        payload: { phase: "ended" },
        context: {
          actorId: "ctrl_2",
          role: "controller",
          connectedPlayerIds: ["ctrl_1", "ctrl_2"],
        },
        acknowledgement: {
          ok: true,
          status: "accepted",
          source: "host",
        },
        invocationKind: "rpc",
        roomId: "ROOM1",
        storeDomain: AIR_JAM_DEFAULT_STORE_DOMAIN,
      },
    ]);

    unsubscribe();
    storeHook.unmount();
  });

  it("filters rejected host actions unless the listener opts in", async () => {
    mockedContext.state.role = "host";

    const useRejectingStore = createAirJamStore<{
      phase: string;
      actions: {
        failPhaseChange: (
          ctx: AirJamActionContext,
          payload: { phase: string },
        ) => ReturnType<typeof rejectAirJamAction>;
      };
    }>(() => ({
      phase: "lobby",
      actions: {
        failPhaseChange: (_ctx, { phase }) =>
          rejectAirJamAction(
            "phase_locked",
            `Phase "${phase}" is locked.`,
            { phase },
          ),
      },
    }));

    const acceptedOnlyEvents: unknown[] = [];
    const rejectedEvents: unknown[] = [];
    const unsubscribeAcceptedOnly = useRejectingStore.subscribeHostActions(
      (event) => {
        acceptedOnlyEvents.push(event);
      },
    );
    const unsubscribeRejected = useRejectingStore.subscribeHostActions(
      (event) => {
        rejectedEvents.push(event);
      },
      { includeRejected: true },
    );
    const actionsHook = renderHook(() => useRejectingStore.useActions());

    let acknowledgement: unknown;
    await act(async () => {
      acknowledgement = await actionsHook.result.current.failPhaseChange({
        phase: "playing",
      });
    });

    expect(acknowledgement).toEqual({
      ok: false,
      status: "rejected",
      source: "host",
      reason: "phase_locked",
      message: 'Phase "playing" is locked.',
      details: { phase: "playing" },
    });
    expect(acceptedOnlyEvents).toEqual([]);
    expect(rejectedEvents).toEqual([
      {
        actionName: "failPhaseChange",
        payload: { phase: "playing" },
        context: {
          actorId: "host",
          role: "host",
          connectedPlayerIds: ["ctrl_1", "ctrl_2"],
        },
        acknowledgement: {
          ok: false,
          status: "rejected",
          source: "host",
          reason: "phase_locked",
          message: 'Phase "playing" is locked.',
          details: { phase: "playing" },
        },
        invocationKind: "local",
        roomId: "ROOM1",
        storeDomain: AIR_JAM_DEFAULT_STORE_DOMAIN,
      },
    ]);

    unsubscribeAcceptedOnly();
    unsubscribeRejected();
    actionsHook.unmount();
  });

  it("suppresses arcade.shell host:state_sync while reconnect ack is pending, then emits when cleared", () => {
    mockedContext.state.role = "host";
    mockedContext.state.hostArcadeRestore = {
      phase: "awaiting_ack",
      session: null,
    } as HostArcadeRestoreState;

    const useArcadeShellStore = createAirJamStore<TestStoreState>(
      (set) => ({
        phase: "lobby",
        lastActor: undefined,
        lastRole: undefined,
        actions: {
          joinTeam: (ctx, { team }) =>
            set({
              phase: team,
              lastActor: ctx.actorId,
              lastRole: ctx.role,
              lastConnectedPlayerIds: ctx.connectedPlayerIds,
            }),
          setPhase: (ctx, { phase }) =>
            set({
              phase,
              lastActor: ctx.actorId,
              lastRole: ctx.role,
              lastConnectedPlayerIds: ctx.connectedPlayerIds,
            }),
        },
      }),
      { storeDomain: AIR_JAM_ARCADE_SURFACE_STORE_DOMAIN },
    );

    hostSocket.emitted.length = 0;

    const { rerender } = renderHook(() => useArcadeShellStore());

    const syncWhilePending = hostSocket.emitted.filter(
      (c) => c.event === "host:state_sync",
    );
    expect(syncWhilePending.length).toBe(0);

    mockedContext.state.hostArcadeRestore = {
      phase: "idle",
      session: null,
    } as HostArcadeRestoreState;
    rerender();

    const syncAfterClear = hostSocket.emitted.filter(
      (c) => c.event === "host:state_sync",
    );
    expect(syncAfterClear.length).toBeGreaterThan(0);
    expect(
      (syncAfterClear[0]?.args[0] as { storeDomain?: string })?.storeDomain,
    ).toBe(AIR_JAM_ARCADE_SURFACE_STORE_DOMAIN);
  });
});

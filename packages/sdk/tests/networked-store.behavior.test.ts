// @vitest-environment jsdom

import {
  act,
  renderHook as renderTestingHook,
  type RenderHookOptions,
} from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { agentActionInput } from "../src/agent/agent-action";
import {
  agentAction,
  defineAirJamAgentContract,
} from "../src/agent/agent-contract";
import type { AirJamSocket } from "../src/context/socket-manager";
import type { HostArcadeRestoreState } from "../src/core/connection-store";
import { createConnectionStore } from "../src/core/connection-store";
import {
  createAirJamStore,
  rejectAirJamAction,
  type AirJamActionContext,
  type AttachableStore,
} from "../src/core/replicated-store";
import {
  onAirJamDiagnostic,
  resetAirJamDiagnosticsForTests,
  setAirJamDiagnosticsEnabled,
} from "../src/diagnostics";
import { hostStateSyncSchema } from "../src/protocol";
import {
  AIR_JAM_RUNTIME_CONTROL_KEY,
  type HostRuntimeControl,
} from "../src/runtime-control";
import {
  applyHostRuntimeLeasedControl,
  readHostStateEpochs,
  registerHostAgentContract,
  registerHostRuntimeParticipantReceiver,
} from "../src/runtime/contracts/control";
import { getControllerRealtimeClient } from "../src/runtime/controller-realtime-client";
import { getHostRealtimeClient } from "../src/runtime/host-realtime-client";
import { declaredStoresContext } from "../src/runtime/runtime-owner-contexts";
import {
  AIR_JAM_ARCADE_SURFACE_STORE_DOMAIN,
  AIR_JAM_DEFAULT_STORE_DOMAIN,
} from "../src/store/air-jam-store-domain-constants";
import {
  useAirJamStore,
  useHostActionListener,
} from "../src/store/use-air-jam-store";

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
      surfaceCheckpoint: null,
    } as HostArcadeRestoreState,
  };

  return { state };
});

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

// Stores the test created; a rendered hook attaches them like a running runtime.
const trackedStores: AttachableStore[] = [];
const pendingDetachments: (() => void)[] = [];
const TEST_GAME_TIME_MS = 4_200;

const track = <T extends AttachableStore>(store: T): T => {
  trackedStores.push(store);
  return store;
};
let hostSocket: MockSocket;
let controllerSocket: MockSocket;

/**
 * Renders a store hook inside a runtime that declares the test's stores. Its
 * connection follows the test's room state when the hook renders again.
 */
const renderHook = <Result, Props>(
  callback: (props: Props) => Result,
  options?: RenderHookOptions<Props>,
) => {
  const connection = createConnectionStore();
  const syncConnection = () => connection.setState({ ...mockedContext.state });
  syncConnection();
  const surface = mockedContext.state.role ?? "host";
  const socket =
    surface === "host"
      ? getHostRealtimeClient(() => hostSocket as unknown as AirJamSocket)
      : getControllerRealtimeClient(
          () => controllerSocket as unknown as AirJamSocket,
        );
  const detachments = trackedStores
    .filter((store) => !store.attached)
    .map((store) =>
      store.attach({
        socket,
        connection,
        defaultStoreDomain: AIR_JAM_DEFAULT_STORE_DOMAIN,
        controlTarget: surface === "host" ? window : null,
        now: () => TEST_GAME_TIME_MS,
      }),
    );
  pendingDetachments.push(...detachments);
  const declared = new Set(trackedStores);
  const rendered = renderTestingHook(callback, {
    ...options,
    wrapper: ({ children }: { children: ReactNode }) =>
      createElement(
        declaredStoresContext.Provider,
        { value: declared },
        children,
      ),
  });
  return {
    ...rendered,
    rerender: (props?: Props) => {
      syncConnection();
      rendered.rerender(props);
    },
    unmount: () => {
      rendered.unmount();
      for (const detach of detachments) detach();
    },
  };
};

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
  track(
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
    })),
  );

interface CounterStoreState {
  count: number;
  actions: {
    increment: (ctx: AirJamActionContext, payload: { amount: number }) => void;
  };
}

const createCounterStore = () =>
  track(
    createAirJamStore<CounterStoreState>((set) => ({
      count: 0,
      actions: {
        increment: (_ctx, { amount }) =>
          set((state) => ({ count: state.count + amount })),
      },
    })),
  );

interface ArcadeShellTestState {
  epoch: number;
  phase: "browser" | "game";
  actions: {
    setSurface: (
      ctx: AirJamActionContext,
      payload: { epoch: number; phase: "browser" | "game" },
    ) => void;
  };
}

const createArcadeShellTestStore = () =>
  track(
    createAirJamStore<ArcadeShellTestState>(
      (set) => ({
        epoch: 1,
        phase: "browser",
        actions: {
          setSurface: (_ctx, payload) => set(payload),
        },
      }),
      { storeDomain: AIR_JAM_ARCADE_SURFACE_STORE_DOMAIN },
    ),
  );

describe("createAirJamStore networked behavior", () => {
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
      surfaceCheckpoint: null,
    } as HostArcadeRestoreState;

    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    for (const detach of pendingDetachments.splice(0)) detach();
    trackedStores.length = 0;
    warnSpy.mockRestore();
    resetAirJamDiagnosticsForTests();
  });

  it("owned host control uses the local dispatcher, listeners and replication", async () => {
    mockedContext.state.role = "host";
    const store = createTestStore();
    const events: unknown[] = [];
    const { unmount } = renderHook(() => {
      useHostActionListener(store, (event) => events.push(event));
      return useAirJamStore(store);
    });
    const control = Reflect.get(
      window,
      AIR_JAM_RUNTIME_CONTROL_KEY,
    ) as HostRuntimeControl;
    await act(async () => {
      expect(
        await control.invoke({
          roomId: "ROOM1",
          storeDomain: "default",
          actionName: "setPhase",
          payload: { phase: "playing" },
        }),
      ).toMatchObject({ ok: true });
    });
    expect(store.getState()).toMatchObject({
      phase: "playing",
      lastActor: "host",
      lastRole: "host",
    });
    expect(events).toEqual([
      expect.objectContaining({
        actionName: "setPhase",
        invocationKind: "local",
        context: expect.objectContaining({ role: "host" }),
      }),
    ]);
    expect(
      hostSocket.emitted.some((call) => call.event === "host:state_sync"),
    ).toBe(true);
    expect(controllerSocket.emitted).toEqual([]);
    unmount();
    expect(
      await control.invoke({
        roomId: "ROOM1",
        storeDomain: "default",
        actionName: "setPhase",
        payload: { phase: "lobby" },
      }),
    ).toMatchObject({ reason: "host_store_unavailable" });
    expect(store.getState().phase).toBe("playing");
  });

  it("keeps the constructor epoch through actions and remounts but changes it for a fresh store", async () => {
    mockedContext.state.role = "host";
    const store = createTestStore();
    const first = renderHook(() => useAirJamStore(store));
    const epochs = readHostStateEpochs(window, "ROOM1");
    expect(epochs).toHaveLength(1);
    const control: HostRuntimeControl = Reflect.get(
      window,
      AIR_JAM_RUNTIME_CONTROL_KEY,
    );
    await act(async () => {
      await control.invoke({
        roomId: "ROOM1",
        storeDomain: "default",
        actionName: "setPhase",
        payload: { phase: "playing" },
      });
    });
    expect(readHostStateEpochs(window, "ROOM1")).toEqual(epochs);
    first.unmount();
    const rebound = renderHook(() => useAirJamStore(store));
    expect(readHostStateEpochs(window, "ROOM1")).toEqual(epochs);
    rebound.unmount();
    const replacementStore = createTestStore();
    const replacement = renderHook(() => useAirJamStore(replacementStore));
    expect(readHostStateEpochs(window, "ROOM1")).not.toEqual(epochs);
    expect(replacementStore.getState().phase).toBe("lobby");
    replacement.unmount();
  });

  it("hands the room to a replacement store with its own epoch and a newer revision", async () => {
    mockedContext.state.role = "host";
    const firstStore = createTestStore();
    const listener = vi.fn();
    const first = renderHook(() => {
      useHostActionListener(firstStore, listener);
      return firstStore.actions;
    });
    await act(async () => {
      await first.result.current.setPhase({ phase: "old" });
    });
    const before = readHostStateEpochs(window, "ROOM1");
    const previousUpdate = hostSocket.emitted
      .filter((call) => call.event === "host:state_sync")
      .at(-1);
    if (!previousUpdate) throw new Error("Missing original state update.");
    const previousRevision = hostStateSyncSchema.parse(
      previousUpdate.args[0],
    ).revision;
    first.unmount();

    const replacementStore = createTestStore();
    const replacement = renderHook(() => {
      useHostActionListener(replacementStore, listener);
      return replacementStore.actions;
    });
    expect(readHostStateEpochs(window, "ROOM1")).not.toEqual(before);
    const replacementUpdate = hostSocket.emitted
      .filter((call) => call.event === "host:state_sync")
      .at(-1);
    if (!replacementUpdate)
      throw new Error("Missing replacement state update.");
    const replacementState = hostStateSyncSchema.parse(
      replacementUpdate.args[0],
    );
    expect(replacementState.revision).toBeGreaterThan(previousRevision);
    expect(replacementState.data.phase).toBe("lobby");
    await act(async () => {
      await replacement.result.current.setPhase({ phase: "new" });
    });
    expect(firstStore.getState().phase).toBe("old");
    expect(replacementStore.getState().phase).toBe("new");
    expect(listener.mock.calls.at(-1)?.[0]).toMatchObject({
      actionName: "setPhase",
      payload: { phase: "new" },
    });
    replacement.unmount();
  });

  it("refuses to render a store its runtime does not declare", () => {
    const undeclaredStore = createAirJamStore<TestStoreState>(() => ({
      phase: "lobby",
      actions: { joinTeam: () => {}, setPhase: () => {} },
    }));
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => renderHook(() => useAirJamStore(undeclaredStore))).toThrow(
      /defineAirJamGame\(\{ stores/,
    );
  });

  it("never publishes host control from a controller store", () => {
    const store = createTestStore();
    const { unmount } = renderHook(() => useAirJamStore(store));
    expect(Reflect.get(window, AIR_JAM_RUNTIME_CONTROL_KEY)).toBeUndefined();
    unmount();
  });

  it("proxies controller public actions over action RPC", async () => {
    const store = createTestStore();
    const { result, unmount } = renderHook(() => store.actions);

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

  it("delivers an action called while the controller session is connecting", async () => {
    mockedContext.state.roomId = null as unknown as string;
    const store = createTestStore();
    const { result, rerender, unmount } = renderHook(() => store.actions);
    const pending = result.current.joinTeam({ team: "red" });
    expect(
      controllerSocket.emitted.some(
        (call) => call.event === "controller:action_rpc",
      ),
    ).toBe(false);
    mockedContext.state.roomId = "ROOM1";
    act(() => rerender());
    await expect(pending).resolves.toMatchObject({ ok: true });
    expect(
      controllerSocket.emitted.find(
        (call) => call.event === "controller:action_rpc",
      )?.args[0],
    ).toMatchObject({ roomId: "ROOM1", actionName: "joinTeam" });
    unmount();
  });

  it("applies a host action called before the host role is assigned", async () => {
    mockedContext.state.role = null as unknown as Role;
    const store = createTestStore();
    const { result, rerender, unmount } = renderHook(() => ({
      actions: store.actions,
      phase: useAirJamStore(store, (state) => state.phase),
    }));
    const pending = result.current.actions.setPhase({ phase: "playing" });
    mockedContext.state.role = "host";
    act(() => rerender());
    await expect(pending).resolves.toMatchObject({ ok: true });
    expect(store.getState().phase).toBe("playing");
    unmount();
  });

  it("rejects loudly when the session never becomes ready", async () => {
    vi.useFakeTimers();
    mockedContext.state.roomId = null as unknown as string;
    const diagnostics: string[] = [];
    const unsubscribe = onAirJamDiagnostic((diagnostic) => {
      if (diagnostic.code === "AJ_STORE_ACTION_SESSION_NOT_READY")
        diagnostics.push(diagnostic.severity);
    });
    const store = createTestStore();
    const { result, unmount } = renderHook(() => store.actions);
    try {
      const pending = result.current.joinTeam({ team: "red" });
      await vi.advanceTimersByTimeAsync(10_000);
      await expect(pending).resolves.toMatchObject({
        ok: false,
        reason: "session_not_ready",
      });
      expect(diagnostics).toEqual(["error"]);
    } finally {
      unsubscribe();
      unmount();
      vi.useRealTimers();
    }
  });

  it("exposes imperative getState and subscribe on the synced store hook", () => {
    const store = createCounterStore();
    const observedCounts: number[] = [];
    const mountedStore = renderHook(() => useAirJamStore(store));

    const unsubscribe = store.subscribe((state) => {
      observedCounts.push(state.count);
    });

    expect(store.getState().count).toBe(0);

    act(() => {
      controllerSocket.trigger("airjam:state_sync", {
        roomId: "ROOM1",
        storeDomain: AIR_JAM_DEFAULT_STORE_DOMAIN,
        data: { count: 3 },
        revision: 0,
      });
    });

    expect(store.getState().count).toBe(3);
    expect(observedCounts).toContain(3);

    unsubscribe();
    mountedStore.unmount();
  });

  it("keeps state lane transport on action RPC even for input-like payload fields", () => {
    const store = createTestStore();
    const { result, unmount } = renderHook(() => store.actions);

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
    const store = createTestStore();
    const { result, unmount } = renderHook(() => store.actions);

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

    const store = createTestStore();
    const { result, unmount } = renderHook(() => store.actions);

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
        '[AirJamConnectionState] Action "joinTeam" blocked: payload must be RPC-serializable.',
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

    const store = createTestStore();
    const { result, unmount } = renderHook(() => store.actions);

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
        '[AirJamConnectionState] Action "joinTeam" blocked: payload must be omitted or a plain object.',
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

    const store = createTestStore();
    const { result, unmount } = renderHook(() => store.actions);

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
        '[AirJamConnectionState] Action "joinTeam" received an event-like payload. Dropping payload and continuing.',
      ),
      expect.objectContaining({ actionName: "joinTeam" }),
    );
    expect(diagnostics).toContain("AJ_STORE_ACTION_EVENT_PAYLOAD_DROPPED");

    unmount();
    unsubscribe();
  });

  it("emits host:state_sync on host mount so controllers can replay current snapshot", () => {
    mockedContext.state.role = "host";

    const store = createTestStore();
    const { unmount } = renderHook(() =>
      useAirJamStore(store, (state) => state.phase),
    );

    const syncCalls = hostSocket.emitted.filter(
      (call) => call.event === "host:state_sync",
    );
    expect(syncCalls.length).toBeGreaterThanOrEqual(1);
    expect(syncCalls[0]?.args[0]).toEqual(
      expect.objectContaining({
        roomId: "ROOM1",
        storeDomain: AIR_JAM_DEFAULT_STORE_DOMAIN,
        revision: 0,
        data: expect.objectContaining({ phase: "lobby" }),
      }),
    );

    unmount();
  });

  it("suppresses host:state_sync until the registered room matches the active room", () => {
    mockedContext.state.role = "host";
    mockedContext.state.registeredRoomId = "ROOM_OLD";

    const store = createTestStore();
    const { rerender, unmount } = renderHook(() =>
      useAirJamStore(store, (state) => state.phase),
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

    const store = createTestStore();
    const { rerender, unmount } = renderHook(() =>
      useAirJamStore(store, (state) => state.phase),
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

    const store = createTestStore();
    const { unmount } = renderHook(() =>
      useAirJamStore(store, (state) => state.phase),
    );

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
    const store = createTestStore();
    const { unmount } = renderHook(() =>
      useAirJamStore(store, (state) => state.phase),
    );

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

    const store = createTestStore();
    const { unmount } = renderHook(() =>
      useAirJamStore(store, (state) => state.phase),
    );

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
    const store = createTestStore();
    const { result, unmount } = renderHook(() =>
      useAirJamStore(store, (state) => state.phase),
    );

    expect(result.current).toBe("lobby");

    act(() => {
      controllerSocket.trigger("airjam:state_sync", {
        roomId: "ROOM1",
        data: { phase: "playing" },
        storeDomain: AIR_JAM_DEFAULT_STORE_DOMAIN,
        revision: 0,
      });
    });

    expect(result.current).toBe("playing");

    unmount();
  });

  it("restores host state from a newer replicated sync payload", () => {
    mockedContext.state.role = "host";

    const store = createTestStore();
    const { result, unmount } = renderHook(() =>
      useAirJamStore(store, (state) => state.phase),
    );

    expect(result.current).toBe("lobby");

    act(() => {
      hostSocket.trigger("airjam:state_sync", {
        roomId: "ROOM1",
        data: { phase: "playing" },
        storeDomain: AIR_JAM_DEFAULT_STORE_DOMAIN,
        revision: 3,
      });
    });

    expect(result.current).toBe("playing");

    act(() => {
      hostSocket.trigger("airjam:state_sync", {
        roomId: "ROOM1",
        data: { phase: "lobby" },
        storeDomain: AIR_JAM_DEFAULT_STORE_DOMAIN,
        revision: 2,
      });
    });

    expect(result.current).toBe("playing");

    unmount();
  });

  it("emits newer host revisions after restoring replicated state", () => {
    mockedContext.state.role = "host";

    const store = createTestStore();
    const { unmount } = renderHook(() =>
      useAirJamStore(store, (state) => state.phase),
    );

    act(() => {
      hostSocket.trigger("airjam:state_sync", {
        roomId: "ROOM1",
        data: { phase: "playing" },
        storeDomain: AIR_JAM_DEFAULT_STORE_DOMAIN,
        revision: 4,
      });
    });

    const syncCountBefore = hostSocket.emitted.filter(
      (call) => call.event === "host:state_sync",
    ).length;

    act(() => {
      void store.getState().actions.setPhase(
        {
          actorId: "host",
          role: "host",
          connectedPlayerIds: ["ctrl_1", "ctrl_2"],
          now: TEST_GAME_TIME_MS,
        },
        { phase: "results" },
      );
    });

    const syncCalls = hostSocket.emitted.filter(
      (call) => call.event === "host:state_sync",
    );
    const latestSync = syncCalls.at(-1);

    expect(syncCalls.length).toBeGreaterThan(syncCountBefore);
    expect(latestSync?.args[0]).toMatchObject({
      roomId: "ROOM1",
      storeDomain: AIR_JAM_DEFAULT_STORE_DOMAIN,
      revision: 5,
      data: { phase: "results" },
    });

    unmount();
  });

  it("ignores older controller state sync revisions after a newer snapshot is applied", () => {
    const store = createTestStore();
    const { result, unmount } = renderHook(() =>
      useAirJamStore(store, (state) => state.phase),
    );

    act(() => {
      controllerSocket.trigger("airjam:state_sync", {
        roomId: "ROOM1",
        data: { phase: "playing" },
        storeDomain: AIR_JAM_DEFAULT_STORE_DOMAIN,
        revision: 2,
      });
    });

    expect(result.current).toBe("playing");

    act(() => {
      controllerSocket.trigger("airjam:state_sync", {
        roomId: "ROOM1",
        data: { phase: "lobby" },
        storeDomain: AIR_JAM_DEFAULT_STORE_DOMAIN,
        revision: 1,
      });
    });

    expect(result.current).toBe("playing");

    unmount();
  });

  it("ignores controller state sync when storeDomain does not match", () => {
    const store = createTestStore();
    const phaseHook = renderHook(() =>
      useAirJamStore(store, (state) => state.phase),
    );

    act(() => {
      controllerSocket.trigger("airjam:state_sync", {
        roomId: "ROOM1",
        data: { phase: "playing" },
        storeDomain: "arcade.surface",
        revision: 0,
      });
    });

    expect(phaseHook.result.current).toBe("lobby");

    act(() => {
      controllerSocket.trigger("airjam:state_sync", {
        roomId: "ROOM1",
        data: { phase: "playing" },
        storeDomain: AIR_JAM_DEFAULT_STORE_DOMAIN,
        revision: 0,
      });
    });

    expect(phaseHook.result.current).toBe("playing");

    phaseHook.unmount();
  });

  it("ignores host action RPC when storeDomain does not match", () => {
    mockedContext.state.role = "host";

    const store = createTestStore();
    const phaseHook = renderHook(() =>
      useAirJamStore(store, (state) => state.phase),
    );

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

    const store = createTestStore();
    const phaseHook = renderHook(() =>
      useAirJamStore(store, (state) => state.phase),
    );
    const actorHook = renderHook(() =>
      useAirJamStore(store, (state) => state.lastActor),
    );
    const roleHook = renderHook(() =>
      useAirJamStore(store, (state) => state.lastRole),
    );
    const connectedIdsHook = renderHook(() =>
      useAirJamStore(store, (state) => state.lastConnectedPlayerIds),
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

    const store = createCounterStore();
    const firstHook = renderHook(() =>
      useAirJamStore(store, (state) => state.count),
    );
    const secondHook = renderHook(() =>
      useAirJamStore(store, (state) => state.count),
    );
    const actionsHook = renderHook(() => store.actions);

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

    const store = createCounterStore();
    const firstHook = renderHook(() =>
      useAirJamStore(store, (state) => state.count),
    );
    const secondHook = renderHook(() =>
      useAirJamStore(store, (state) => state.count),
    );
    const actionsHook = renderHook(() => store.actions);

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
    const store = createTestStore();
    const firstHook = renderHook(() =>
      useAirJamStore(store, (state) => state.phase),
    );
    const secondHook = renderHook(() =>
      useAirJamStore(store, (state) => state.phase),
    );
    const actionsHook = renderHook(() => store.actions);

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

    const store = createTestStore();
    const actionsHook = renderHook(() => store.actions);
    const phaseHook = renderHook(() =>
      useAirJamStore(store, (state) => state.phase),
    );
    const actorHook = renderHook(() =>
      useAirJamStore(store, (state) => state.lastActor),
    );
    const roleHook = renderHook(() =>
      useAirJamStore(store, (state) => state.lastRole),
    );
    const connectedIdsHook = renderHook(() =>
      useAirJamStore(store, (state) => state.lastConnectedPlayerIds),
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

    const store = createTestStore();
    const storeHook = renderHook(() =>
      useAirJamStore(store, (state) => state.phase),
    );
    const playerActions = store.asPlayer("ctrl_2");
    const phaseHook = renderHook(() =>
      useAirJamStore(store, (state) => state.phase),
    );
    const actorHook = renderHook(() =>
      useAirJamStore(store, (state) => state.lastActor),
    );
    const roleHook = renderHook(() =>
      useAirJamStore(store, (state) => state.lastRole),
    );
    const connectedIdsHook = renderHook(() =>
      useAirJamStore(store, (state) => state.lastConnectedPlayerIds),
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

    const store = createTestStore();
    const storeHook = renderHook(() =>
      useAirJamStore(store, (state) => state.phase),
    );
    const playerActions = store.asPlayer("ctrl_2");

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

    const store = createTestStore();
    const storeHook = renderHook(() =>
      useAirJamStore(store, (state) => state.phase),
    );
    const playerActions = store.asPlayer("ctrl_missing");

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

    const store = createTestStore();
    const observedEvents: unknown[] = [];
    const listenerHook = renderHook(() =>
      useHostActionListener(store, (event) => {
        observedEvents.push(event);
      }),
    );
    const actionsHook = renderHook(() => store.actions);

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
          now: TEST_GAME_TIME_MS,
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

    const store = createTestStore();
    const observedEvents: unknown[] = [];
    const listenerHook = renderHook(() =>
      useHostActionListener(store, (event) => {
        observedEvents.push(event);
      }),
    );
    const storeHook = renderHook(() =>
      useAirJamStore(store, (state) => state.phase),
    );
    const playerActions = store.asPlayer("ctrl_2");

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
          now: TEST_GAME_TIME_MS,
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

    const store = createTestStore();
    const observedEvents: unknown[] = [];
    const unsubscribe = store.subscribeHostActions((event) => {
      observedEvents.push(event);
    });
    const storeHook = renderHook(() => useAirJamStore(store));

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
          now: TEST_GAME_TIME_MS,
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

  it("routes fenced semantic actions through the same participant dispatcher and listeners", async () => {
    mockedContext.state.role = "host";
    const store = createTestStore();
    const events: unknown[] = [];
    const unsubscribe = store.subscribeHostActions((event) =>
      events.push(event),
    );
    const storeHook = renderHook(() => useAirJamStore(store));
    const close = registerHostAgentContract(window, {
      roomId: "ROOM1",
      gameId: "fixture",
      contract: defineAirJamAgentContract({
        stores: { default: {} },
        actions: {
          finish: agentAction.participant(
            { actionName: "setPhase" },
            {
              input: agentActionInput.none(),
              toPayload: () => ({ phase: "ended" }),
            },
          ),
        },
        projectSnapshot: () => ({}),
      }),
    });
    const unregister = registerHostRuntimeParticipantReceiver(window, "ROOM1", {
      now: () => performance.now(),
      readState: () => ({
        runtimeState: "playing",
        connectionStatus: "connected",
      }),
      isParticipant: (id) => ["ctrl_1", "ctrl_2"].includes(id),
    });
    try {
      const control: HostRuntimeControl = Reflect.get(
        window,
        AIR_JAM_RUNTIME_CONTROL_KEY,
      );
      const observed = await control.agent({
        operation: "observe",
        roomId: "ROOM1",
        controllerId: "ctrl_2",
        scope: "player",
        includeImage: false,
      });
      if (observed.operation !== "observe")
        throw new Error("Missing observation.");
      const command = {
        roomId: "ROOM1",
        controllerId: "ctrl_2",
        expected: observed.observation.identity,
        lease: { id: "223e4567-e89b-42d3-a456-426614174000", sequence: 1 },
        operation: {
          kind: "action" as const,
          deadlineMs: performance.now() + 2000,
          actionId: "finish",
        },
      };
      act(() => {
        expect(applyHostRuntimeLeasedControl(window, command)).toMatchObject({
          status: "applied",
          operation: { kind: "action", result: { ok: true } },
        });
        expect(applyHostRuntimeLeasedControl(window, command)).toMatchObject({
          status: "applied",
          replayed: true,
        });
      });
      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        context: { actorId: "ctrl_2", role: "controller" },
        payload: { phase: "ended" },
        invocationKind: "rpc",
      });
      let legacyAck: unknown;
      act(() =>
        hostSocket.trigger(
          "airjam:action_rpc",
          {
            actionName: "setPhase",
            payload: { phase: "lobby" },
            actor: { id: "ctrl_2", role: "controller" },
            storeDomain: AIR_JAM_DEFAULT_STORE_DOMAIN,
          },
          (ack: unknown) => {
            legacyAck = ack;
          },
        ),
      );
      expect(legacyAck).toMatchObject({
        status: "rejected",
        reason: "participant_control_leased",
      });
      expect(events).toHaveLength(1);
    } finally {
      unregister();
      close();
      unsubscribe();
      storeHook.unmount();
    }
  });

  it("filters rejected host actions unless the listener opts in", async () => {
    mockedContext.state.role = "host";

    const rejectingStore = track(
      createAirJamStore<{
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
            rejectAirJamAction("phase_locked", `Phase "${phase}" is locked.`, {
              phase,
            }),
        },
      })),
    );

    const acceptedOnlyEvents: unknown[] = [];
    const rejectedEvents: unknown[] = [];
    const unsubscribeAcceptedOnly = rejectingStore.subscribeHostActions(
      (event) => {
        acceptedOnlyEvents.push(event);
      },
    );
    const unsubscribeRejected = rejectingStore.subscribeHostActions(
      (event) => {
        rejectedEvents.push(event);
      },
      { includeRejected: true },
    );
    const actionsHook = renderHook(() => rejectingStore.actions);

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
          now: TEST_GAME_TIME_MS,
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

  it("keeps local arcade restore convergence authoritative over the cached reconnect snapshot", () => {
    mockedContext.state.role = "controller";
    mockedContext.state.hostArcadeRestore = {
      phase: "idle",
      session: null,
      surfaceCheckpoint: null,
    } as HostArcadeRestoreState;

    const controllerStore = createArcadeShellTestStore();
    const controllerBinding = renderHook(() => useAirJamStore(controllerStore));
    act(() => {
      controllerSocket.trigger("airjam:state_sync", {
        roomId: "ROOM1",
        data: { epoch: 4, phase: "game" },
        storeDomain: AIR_JAM_ARCADE_SURFACE_STORE_DOMAIN,
        revision: 7,
      });
    });
    expect(controllerStore.getState()).toMatchObject({
      epoch: 4,
      phase: "game",
    });

    mockedContext.state.role = "host";
    mockedContext.state.hostArcadeRestore = {
      phase: "awaiting_ack",
      session: null,
      surfaceCheckpoint: null,
    } as HostArcadeRestoreState;

    const hostStore = createArcadeShellTestStore();

    hostSocket.emitted.length = 0;

    const hostBinding = renderHook(() => useAirJamStore(hostStore));

    const syncWhilePending = hostSocket.emitted.filter(
      (c) => c.event === "host:state_sync",
    );
    expect(syncWhilePending.length).toBe(0);

    act(() => {
      hostSocket.trigger("airjam:state_sync", {
        roomId: "ROOM1",
        data: { phase: "game" },
        storeDomain: AIR_JAM_ARCADE_SURFACE_STORE_DOMAIN,
        revision: 7,
      });
    });
    expect(hostStore.getState()).toMatchObject({
      epoch: 1,
      phase: "browser",
    });

    mockedContext.state.hostArcadeRestore = {
      phase: "pending_restore",
      session: {
        gameId: "pong",
        launchCapability: {
          token: "restore_capability",
          expiresAt: 1_800_000_000_000,
        },
      },
      surfaceCheckpoint: { epoch: 4, revision: 7 },
    } as HostArcadeRestoreState;
    hostBinding.rerender();

    act(() => {
      hostStore.getState().actions.setSurface(
        {
          actorId: "host",
          role: "host",
          connectedPlayerIds: [],
          now: TEST_GAME_TIME_MS,
        },
        { epoch: 5, phase: "browser" },
      );
    });
    expect(
      hostSocket.emitted.filter((c) => c.event === "host:state_sync"),
    ).toHaveLength(0);

    mockedContext.state.hostArcadeRestore = {
      phase: "idle",
      session: null,
      surfaceCheckpoint: null,
    } as HostArcadeRestoreState;
    hostBinding.rerender();

    const syncAfterClear = hostSocket.emitted.filter(
      (c) => c.event === "host:state_sync",
    );
    expect(syncAfterClear).toHaveLength(1);
    expect(syncAfterClear[0]?.args[0]).toMatchObject({
      data: { epoch: 5, phase: "browser" },
      storeDomain: AIR_JAM_ARCADE_SURFACE_STORE_DOMAIN,
      revision: 8,
    });

    act(() => {
      controllerSocket.trigger("airjam:state_sync", syncAfterClear[0]?.args[0]);
    });
    expect(controllerStore.getState()).toMatchObject({
      epoch: 5,
      phase: "browser",
    });

    hostBinding.unmount();
    controllerBinding.unmount();
  });
});

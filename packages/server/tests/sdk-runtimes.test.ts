import {
  ControllerRuntime,
  createAirJamConfig,
  createAirJamStore,
  createConnectionStore,
  defineAirJamInput,
  HostRuntime,
  type AirJamActionContext,
  type AirJamControllerEnvironment,
  type AirJamHostEnvironment,
  type ControllerRoomBinding,
} from "@air-jam/sdk/core";
import {
  createLoopbackConnector,
  HostRoomSession,
  PhoneRoomSession,
} from "@air-jam/sdk/room-session";
import { resolveRuntimeTopology } from "@air-jam/sdk/runtime-topology";
import { describe, expect, it, vi } from "vitest";
import { createRooms, ManualClock } from "./helpers/room-session-harness.js";

const input = defineAirJamInput({
  jump: { kind: "button", name: "jump", mode: "pressed" },
});

const config = createAirJamConfig({
  topology: resolveRuntimeTopology({
    runtimeMode: "self-hosted-production",
    surfaceRole: "host",
    appOrigin: "https://play.test",
    backendOrigin: "https://play.test",
    publicHost: "https://play.test",
  }),
  maxPlayers: 4,
});

type Cards = {
  round: number;
  hands: Record<string, string>;
  actions: {
    deal: (ctx: AirJamActionContext, payload: { card: string }) => void;
  };
};
const createCards = () =>
  createAirJamStore<Cards>(
    (set) => ({
      round: 1,
      hands: {},
      actions: {
        deal: ({ actorId }, { card }) =>
          set((state) => ({ hands: { ...state.hands, [actorId]: card } })),
      },
    }),
    { privateField: "hands" },
  );

/** A real room in memory that host and phone runtimes reach over the loopback link. */
const openRooms = () => {
  const clock = new ManualClock();
  const connector = createLoopbackConnector(createRooms(clock));
  const common = {
    connector,
    clock,
    random: () => 0.5,
    deviceWakeEvents: null,
  };
  let resume: Parameters<AirJamHostEnvironment["writeResume"]>[0] = null;
  const host = (): AirJamHostEnvironment => ({
    embedded: null,
    requestedRoomId: null,
    runMode: "standalone",
    defaultStoreDomain: "default",
    presentationChannel: "airjam.room",
    controlTarget: {},
    openRoom: (options) => new HostRoomSession({ ...options, ...common }),
    createKey: () => "host-key-00000001",
    readResume: () => resume,
    writeResume: (next) => {
      resume = next;
    },
    requestHostGrant: async () => "grant",
    controllerUrl: async (code) => `https://play.test/controller?room=${code}`,
    reportError: () => {},
    emitDevEvent: () => {},
    setDevLogContext: () => {},
    seed: () => 1,
    now: () => clock.now(),
  });
  const bindings = new Map<string, ControllerRoomBinding>();
  const vibrate = vi.fn();
  const phone = (code: string): AirJamControllerEnvironment => ({
    embedded: null,
    requestedRoomId: code,
    seatKind: "phone",
    runMode: "standalone",
    defaultStoreDomain: "default",
    presentationChannel: "airjam.room",
    joinRoom: (options) => new PhoneRoomSession({ ...options, ...common }),
    createKey: () => "phone-key-0000001",
    readBinding: (roomId) => bindings.get(roomId) ?? null,
    writeBinding: (roomId, binding) => bindings.set(roomId, binding),
    clearBinding: (roomId) => bindings.delete(roomId),
    vibrate,
    requestFrame: (callback) => queueMicrotask(callback),
    reportError: () => {},
    emitDevEvent: () => {},
    setDevLogContext: () => {},
  });
  return { clock, host, phone, bindings, vibrate };
};

describe("SDK runtimes in a real room", () => {
  it("seats a phone, mirrors its own hand, runs its actions as its seat and relays its input and the host's signals", async () => {
    const { clock, host, phone, vibrate } = openRooms();
    const hostCards = createCards();
    const presses: unknown[] = [];
    const hostRuntime = new HostRuntime({
      config,
      store: createConnectionStore(),
      environment: host(),
      stores: [hostCards],
      input,
      simulation: {
        stepMs: 10,
        create: () => ({}),
        step: (_sim, { input: read }) => {
          presses.push((read("p1") as { jump?: unknown }).jump);
        },
      },
    });
    const stopHost = hostRuntime.start();
    await clock.advance();
    const code = hostRuntime.roomId ?? "";

    const phoneCards = createCards();
    const controller = new ControllerRuntime(
      {
        store: createConnectionStore(),
        environment: phone(code),
        stores: [phoneCards],
        input,
      },
      {},
    );
    const stopPhone = controller.start();
    await clock.advance();
    expect(controller.store.getState()).toMatchObject({
      controllerId: "p1",
      connectionStatus: "connected",
      controllerOrientation: "portrait",
    });

    await expect(phoneCards.actions.deal({ card: "ace" })).resolves.toEqual(
      expect.objectContaining({ ok: true, status: "accepted" }),
    );
    await clock.advance(100);
    expect(hostCards.getState().hands).toEqual({ p1: "ace" });
    expect(phoneCards.getState().hands).toEqual({ p1: "ace" });

    controller.input?.press("jump");
    await clock.advance(20);
    hostRuntime.simulation?.advance(10);
    expect(presses.at(-1)).toBe(true);

    hostRuntime.sendSignal("HAPTIC", { pattern: "light" }, "p1");
    controller.sendSystemCommand("pause");
    await clock.advance(20);
    expect(vibrate).toHaveBeenCalledWith(10);
    expect(controller.store.getState().runtimeState).toBe("paused");

    stopPhone();
    stopHost();
  });

  it("resumes a phone's seat after its page reloads", async () => {
    const { clock, host, phone, bindings } = openRooms();
    const hostRuntime = new HostRuntime({
      config,
      store: createConnectionStore(),
      environment: host(),
      stores: [],
    });
    const stopHost = hostRuntime.start();
    await clock.advance();
    const code = hostRuntime.roomId ?? "";
    const open = () =>
      new ControllerRuntime(
        {
          store: createConnectionStore(),
          environment: phone(code),
          stores: [],
        },
        {},
      );
    const first = open();
    const stopFirst = first.start();
    await clock.advance();
    expect(bindings.get(code)).toEqual({
      key: "phone-key-0000001",
      instance: expect.any(String),
    });
    stopFirst();

    const reloaded = open();
    const stopReloaded = reloaded.start();
    await clock.advance();
    expect(reloaded.store.getState().controllerId).toBe("p1");
    expect(hostRuntime.store.getState().players.map((seat) => seat.id)).toEqual(
      ["p1"],
    );
    stopReloaded();
    stopHost();
  });

  it("gives a reloading host its store back only when the store's shape is the same", async () => {
    const { clock, host } = openRooms();
    const environment = host();
    const start = (store: ReturnType<typeof createCards>) => {
      const runtime = new HostRuntime({
        config,
        store: createConnectionStore(),
        environment,
        stores: [store],
      });
      return { runtime, stop: runtime.start() };
    };
    const before = createCards();
    const first = start(before);
    await clock.advance();
    before.api.setState({ round: 4 });
    await clock.advance(100);
    first.stop();

    const same = createCards();
    const second = start(same);
    await clock.advance();
    expect(same.getState().round).toBe(4);
    second.stop();

    const reshaped = createAirJamStore<{
      round: string;
      actions: {
        reset: (ctx: AirJamActionContext, payload: undefined) => void;
      };
    }>((set) => ({ round: "fresh", actions: { reset: () => set({}) } }));
    const third = new HostRuntime({
      config,
      store: createConnectionStore(),
      environment,
      stores: [reshaped],
    });
    const stopThird = third.start();
    await clock.advance();
    expect(reshaped.getState().round).toBe("fresh");
    stopThird();
  });
});

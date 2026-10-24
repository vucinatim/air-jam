import type { HostBootstrapAck, HostRegistrationAck } from "../protocol";
import { resolveRuntimeTopology } from "../runtime-topology";
import type {
  AirJamRealtimeClient,
  BridgeListener,
} from "../runtime/realtime-client";
import { createAirJamConfig } from "./config";
import { createConnectionStore } from "./connection-store";
import type { AirJamHostEnvironment } from "./environment";
import type { HostRuntime, HostRuntimeFactory } from "./host-runtime";
import { airJamInputLogSchema, type AirJamInputLog } from "./input-log";

const REPLAY_ROOM_ID = "REPLAY";
const REPLAY_ORIGIN = "http://replay.invalid";
const ROOM_OPEN_TIMEOUT_MS = 5_000;

/**
 * A room with no server: it admits the host, then delivers only the events
 * the replay fires, exactly when it fires them.
 */
const createReplayRoom = () => {
  const listeners = new Map<string, Set<BridgeListener>>();
  const fire = (event: string, payload?: unknown): void => {
    for (const listener of listeners.get(event) ?? []) listener(payload);
  };
  const answer = (event: string): unknown => {
    if (event === "host:bootstrap")
      return { ok: true } satisfies HostBootstrapAck;
    if (event === "host:createRoom")
      return {
        ok: true,
        roomId: REPLAY_ROOM_ID,
        players: [],
        controllers: [],
      } satisfies HostRegistrationAck;
    return undefined;
  };
  let connected = false;
  const client: AirJamRealtimeClient & { fire: typeof fire } = {
    get connected() {
      return connected;
    },
    id: "replay",
    connect() {
      connected = true;
      fire("connect");
      return client;
    },
    disconnect() {
      connected = false;
      fire("disconnect", "io client disconnect");
      return client;
    },
    on(event, listener) {
      listeners.set(event, (listeners.get(event) ?? new Set()).add(listener));
      return client;
    },
    off(event, listener) {
      if (listener) listeners.get(event)?.delete(listener);
      else listeners.delete(event);
      return client;
    },
    emit(event, ...args) {
      const acknowledge = args.at(-1);
      if (typeof acknowledge === "function") acknowledge(answer(event));
      return client;
    },
    emitWithAck: async <TAck>(event: string) => answer(event) as TAck,
    fire,
  };
  return client;
};

/**
 * Plays a recorded input log on a fresh host of the same game, with no
 * server, browser or wall clock: each recorded event reaches the game before
 * the step it reached it before in the recording. With the same seed and
 * game code, the match plays out the same way; read its stores when it ends.
 */
export const replayAirJamInputLog = async (
  createHostRuntime: HostRuntimeFactory,
  recorded: AirJamInputLog,
): Promise<{ runtime: HostRuntime; stop: () => void }> => {
  const log = airJamInputLogSchema.parse(recorded);
  const room = createReplayRoom();
  const store = createConnectionStore();
  let runtime: HostRuntime | null = null;
  const environment: AirJamHostEnvironment = {
    embedded: null,
    requestedRoomId: null,
    runMode: "standalone",
    defaultStoreDomain: log.storeDomain,
    controlTarget: {},
    readResume: () => null,
    writeResume: () => {},
    requestHostGrant: () =>
      Promise.reject(new Error("A replay runs without host grants.")),
    controllerUrl: async (roomId) =>
      `${REPLAY_ORIGIN}/controller?room=${roomId}`,
    transport: () => room,
    emitDevEvent: () => {},
    setDevLogContext: () => {},
    seed: () => log.seed,
    now: () => runtime?.simulation?.timeMs ?? 0,
  };
  runtime = createHostRuntime(
    {
      config: createAirJamConfig({
        topology: resolveRuntimeTopology({
          runtimeMode: "self-hosted-production",
          surfaceRole: "host",
          appOrigin: REPLAY_ORIGIN,
          backendOrigin: REPLAY_ORIGIN,
          socketOrigin: REPLAY_ORIGIN,
          publicHost: REPLAY_ORIGIN,
          embedded: false,
          proxyStrategy: "none",
          secureTransport: false,
        }),
      }),
      store,
      getSocket: () => {
        throw new Error("A replay room needs no socket.");
      },
      disconnectSocket: () => {},
      environment,
    },
    { seed: log.seed },
  );
  const stop = runtime.start();
  try {
    await runtime.ready;
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        unsubscribe();
        reject(new Error("The replay host never opened its room."));
      }, ROOM_OPEN_TIMEOUT_MS);
      const check = () => {
        if (store.getState().registeredRoomId !== REPLAY_ROOM_ID) return;
        clearTimeout(timer);
        unsubscribe();
        resolve();
      };
      const unsubscribe = store.subscribe(check);
      check();
    });
    const clock = runtime.simulation;
    if (!clock) throw new Error("A replay needs the game's simulation.");
    if (clock.ticks !== 0 || clock.stepMs !== log.stepMs)
      throw new Error("The replayed game does not match the recorded one.");
    let next = 0;
    for (let tick = 1; tick <= log.ticks; tick += 1) {
      for (; log.entries[next]?.tick === tick; next += 1) {
        const { event, payload } = log.entries[next];
        room.fire(
          event,
          "roomId" in payload
            ? { ...payload, roomId: REPLAY_ROOM_ID }
            : payload,
        );
      }
      clock.advance(log.stepMs);
    }
    return { runtime, stop };
  } catch (error) {
    stop();
    throw error;
  }
};

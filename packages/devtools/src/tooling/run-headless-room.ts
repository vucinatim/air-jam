/**
 * One headless room: the Air Jam relay on a loopback port and the game's host
 * core, with no page and no drawing. The game's clock moves only when the
 * owner advances it, so a test plays on game time, as fast as the host runs.
 */
import {
  createAirJamConfig,
  createConnectionStore,
  DirectRealtimeClient,
  type AirJamHostEnvironment,
} from "@air-jam/sdk/core";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
} from "@air-jam/sdk/protocol";
import {
  AIR_JAM_RUNTIME_CONTROL_KEY,
  type HostRuntimeControl,
} from "@air-jam/sdk/runtime-control";
import {
  resolveRuntimeTopology,
  runtimeTopologyToQueryParams,
} from "@air-jam/sdk/runtime-topology";
import { createAirJamServer, loadServerEnv } from "@air-jam/server";
import { io, type Socket } from "socket.io-client";
import {
  HEADLESS_ROOM_IPC_MAX_BYTES,
  headlessRoomRequestSchema,
  type HeadlessRoomResponse,
} from "../headless-room-protocol.js";
import {
  loadAirJamAppConfig,
  resolveAirJamConfigGameId,
} from "./airjam-agent.js";

const STARTUP_MS = 10_000;

type Room = {
  agent: HostRuntimeControl["agent"];
  advance: (ms: number) => number;
  close: () => Promise<void>;
};

let room: Room | undefined;
let initializing = false;
let busy = false;

function send(message: HeadlessRoomResponse) {
  if (process.connected) process.send?.(message);
}

async function openRoom(configPath: string, seed: number) {
  const app = await loadAirJamAppConfig(configPath);
  const server = createAirJamServer({
    host: "127.0.0.1",
    port: 0,
    envConfig: loadServerEnv({
      NODE_ENV: "test",
      AIR_JAM_AUTH_MODE: "disabled",
    }),
  });
  const origin = `http://127.0.0.1:${await server.start()}`;
  const topology = (surfaceRole: "host" | "controller") =>
    resolveRuntimeTopology({
      runtimeMode: "self-hosted-production",
      surfaceRole,
      appOrigin: origin,
      backendOrigin: origin,
      socketOrigin: origin,
      publicHost: origin,
      embedded: false,
      proxyStrategy: "none",
      secureTransport: false,
    });
  const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(
    origin,
    { autoConnect: false, query: { role: "host" }, transports: ["websocket"] },
  );
  let nowMs = 0;
  const controlTarget = {};
  const environment: AirJamHostEnvironment = {
    embedded: null,
    requestedRoomId: null,
    runMode: "standalone",
    defaultStoreDomain: "default",
    controlTarget,
    readResume: () => null,
    writeResume: () => {},
    requestHostGrant: () =>
      Promise.reject(new Error("A headless room runs without host grants.")),
    controllerUrl: async (roomId, capabilityToken) => {
      const url = new URL(app.controllerPath, origin);
      url.searchParams.set("room", roomId);
      if (capabilityToken)
        url.searchParams.set("aj_controller_cap", capabilityToken);
      for (const [key, value] of Object.entries(
        runtimeTopologyToQueryParams(topology("controller")),
      ))
        url.searchParams.set(key, value);
      return url.toString();
    },
    transport: (getSocket) => new DirectRealtimeClient(getSocket("host")),
    emitDevEvent: () => {},
    setDevLogContext: () => {},
    seed: () => seed,
    now: () => nowMs,
  };
  const store = createConnectionStore();
  // The game's own SDK builds its host, so its stores and host share one runtime.
  const runtime = app.createHostRuntime(
    {
      config: createAirJamConfig({
        topology: topology("host"),
        maxPlayers: app.runtime.maxPlayers,
      }),
      store,
      getSocket: () => socket,
      disconnectSocket: () => socket.disconnect(),
      environment,
    },
    { seed },
  );
  const stop = runtime.start();
  const close = async () => {
    stop();
    socket.disconnect();
    await server.stop();
  };
  try {
    const joined = await new Promise<{ roomId: string; joinUrl: string }>(
      (resolve, reject) => {
        const timer = setTimeout(
          () =>
            reject(new Error("room_startup_timeout: The host never joined.")),
          STARTUP_MS,
        );
        const check = () => {
          const state = store.getState();
          if (
            state.connectionStatus === "connected" &&
            state.roomId &&
            state.joinUrl
          ) {
            clearTimeout(timer);
            unsubscribe();
            resolve({ roomId: state.roomId, joinUrl: state.joinUrl });
          } else if (state.lastError) {
            clearTimeout(timer);
            unsubscribe();
            reject(new Error(`room_unavailable: ${state.lastError}`));
          }
        };
        const unsubscribe = store.subscribe(check);
        check();
      },
    );
    room = {
      agent: (request) => {
        const control = Reflect.get(
          controlTarget,
          AIR_JAM_RUNTIME_CONTROL_KEY,
        ) as HostRuntimeControl | undefined;
        if (!control)
          throw new Error(
            "room_unavailable: The game publishes nothing agents can read.",
          );
        return control.agent(request);
      },
      advance: (ms) => {
        nowMs += ms;
        runtime.simulation?.advance(ms);
        return nowMs;
      },
      close,
    };
    return {
      gameId: resolveAirJamConfigGameId(app),
      roomId: joined.roomId,
      controllerJoinUrl: joined.joinUrl,
      nowMs,
    };
  } catch (error) {
    await close();
    throw error;
  }
}

process.on("disconnect", () => {
  void (room?.close() ?? Promise.resolve()).finally(() => process.exit(0));
});
process.on("message", (message: unknown) => {
  void (async () => {
    if (
      Buffer.byteLength(JSON.stringify(message)) > HEADLESS_ROOM_IPC_MAX_BYTES
    )
      throw new Error("Oversized headless room request.");
    const request = headlessRoomRequestSchema.parse(message);
    if (busy)
      return send({ kind: "error", id: request.id, message: "room_busy" });
    busy = true;
    try {
      if (request.kind === "initialize") {
        if (room || initializing)
          throw new Error("The headless room is already open.");
        initializing = true;
        send({
          kind: "initialized",
          id: request.id,
          ...(await openRoom(request.configPath, request.seed)),
        });
        return;
      }
      if (!room) throw new Error("The headless room is not open.");
      if (request.kind === "agent")
        send({
          kind: "agent",
          id: request.id,
          response: await room.agent(request.request),
        });
      else
        send({
          kind: "advanced",
          id: request.id,
          nowMs: room.advance(request.ms),
        });
    } catch (error) {
      send({
        kind: "error",
        id: request.id,
        message: (error instanceof Error ? error.message : String(error)).slice(
          0,
          2000,
        ),
      });
    } finally {
      busy = false;
    }
  })().catch((error) => {
    console.error(error);
    process.exit(1);
  });
});
send({ kind: "ready" });

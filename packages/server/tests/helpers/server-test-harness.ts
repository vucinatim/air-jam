import { io, type Socket } from "socket.io-client";
import { afterEach, beforeEach } from "vitest";
import {
  createAirJamServer,
  type AirJamServerRuntime,
  type CreateAirJamServerOptions,
} from "../../src/index";
import { RateLimitService } from "../../src/services/rate-limit-service";
import { RoomManager } from "../../src/services/room-manager";

type GenericEventMap = Record<string, (...args: unknown[]) => void>;
type GenericSocket = Socket<GenericEventMap, GenericEventMap>;

interface HarnessOptions {
  server?: Omit<CreateAirJamServerOptions, "roomManager" | "rateLimitService">;
}

export interface ServerTestHarness {
  connectSocket: () => Promise<GenericSocket>;
  emitWithAck: <TAck>(
    socket: GenericSocket,
    event: string,
    payload: unknown,
  ) => Promise<TAck>;
  waitForEvent: <TPayload>(
    socket: GenericSocket,
    event: string,
    timeoutMs?: number,
  ) => Promise<TPayload>;
  expectNoEvent: (
    socket: GenericSocket,
    event: string,
    waitMs?: number,
  ) => Promise<void>;
  delay: (ms: number) => Promise<void>;
  getBaseUrl: () => string;
  getRoomManager: () => RoomManager;
}

export const setupServerTestHarness = (
  options: HarnessOptions = {},
): ServerTestHarness => {
  let runtime: AirJamServerRuntime | null = null;
  let roomManager = new RoomManager();
  const sockets: GenericSocket[] = [];
  let baseUrl = "";
  let previousChildTeardownMs: string | undefined;

  beforeEach(async () => {
    previousChildTeardownMs = process.env.AIR_JAM_CHILD_HOST_TEARDOWN_MS;
    process.env.AIR_JAM_CHILD_HOST_TEARDOWN_MS = "50";
    roomManager = new RoomManager();
    const rateLimitService = new RateLimitService();
    runtime = createAirJamServer({
      ...options.server,
      roomManager,
      rateLimitService,
    });

    const port = await runtime.start(0);
    baseUrl = `http://127.0.0.1:${port}`;
  });

  afterEach(async () => {
    while (sockets.length > 0) {
      const socket = sockets.pop();
      socket?.disconnect();
    }

    if (runtime) {
      await runtime.stop();
      runtime = null;
    }
    baseUrl = "";
    if (previousChildTeardownMs === undefined) {
      delete process.env.AIR_JAM_CHILD_HOST_TEARDOWN_MS;
    } else {
      process.env.AIR_JAM_CHILD_HOST_TEARDOWN_MS = previousChildTeardownMs;
    }
  });

  const connectSocket = async (): Promise<GenericSocket> => {
    const socket = await new Promise<GenericSocket>((resolve, reject) => {
      const nextSocket = io(baseUrl, {
        transports: ["websocket"],
        forceNew: true,
        reconnection: false,
      });

      const onConnectError = (error: Error) => {
        nextSocket.off("connect", onConnect);
        reject(error);
      };

      const onConnect = () => {
        nextSocket.off("connect_error", onConnectError);
        resolve(nextSocket as GenericSocket);
      };

      nextSocket.once("connect_error", onConnectError);
      nextSocket.once("connect", onConnect);
    });

    sockets.push(socket);
    return socket;
  };

  const emitWithAck = async <TAck>(
    socket: GenericSocket,
    event: string,
    payload: unknown,
  ): Promise<TAck> => {
    return await new Promise((resolve) => {
      socket.emit(event, payload, (ack: TAck) => resolve(ack));
    });
  };

  const waitForEvent = async <TPayload>(
    socket: GenericSocket,
    event: string,
    timeoutMs = 750,
  ): Promise<TPayload> => {
    return await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        socket.off(event, onEvent);
        reject(new Error(`Timed out waiting for ${event}`));
      }, timeoutMs);

      const onEvent = (...args: unknown[]) => {
        const payload = args[0] as TPayload;
        clearTimeout(timeout);
        resolve(payload);
      };

      socket.once(event, onEvent);
    });
  };

  const expectNoEvent = async (
    socket: GenericSocket,
    event: string,
    waitMs = 250,
  ): Promise<void> => {
    await new Promise((resolve, reject) => {
      const onEvent = () => {
        clearTimeout(timer);
        reject(new Error(`Unexpected event received: ${event}`));
      };

      const timer = setTimeout(() => {
        socket.off(event, onEvent);
        resolve(undefined);
      }, waitMs);

      socket.once(event, onEvent);
    });
  };

  const delay = async (ms: number): Promise<void> => {
    await new Promise((resolve) => setTimeout(resolve, ms));
  };

  return {
    connectSocket,
    emitWithAck,
    waitForEvent,
    expectNoEvent,
    delay,
    getBaseUrl: () => baseUrl,
    getRoomManager: () => roomManager,
  };
};

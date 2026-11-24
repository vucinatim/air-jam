import { AIRJAM_DEV_LOG_EVENTS } from "@air-jam/sdk/protocol";
import {
  DEFAULT_ROOM_LIMITS,
  parseRoomPath,
  roomCloseReasonForCode,
  type RoomAddress,
  type RoomLimits,
} from "@air-jam/sdk/room-protocol";
import {
  createServer,
  STATUS_CODES,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from "node:http";
import type { Duplex } from "node:stream";
import { WebSocketServer, type WebSocket } from "ws";
import { loadServerEnv, type ServerEnvConfig } from "../env/server-env.js";
import {
  receiveBrowserLogBatch,
  receiveBrowserUnload,
  type DevLogRouteResponse,
} from "../logging/dev-log-routes.js";
import {
  createServerLogging,
  type ServerLoggingOptions,
} from "../logging/server-logging.js";
import { resolveCorsOrigin, type AllowedOrigins } from "../origin-policy.js";
import { resolveSocketIdentifier } from "../policies/rate-limit-policy.js";
import type { RoomFact } from "../room/facts.js";
import {
  createMasterKeyRoomGate,
  createOpenRoomGate,
  type RoomGate,
} from "../room/gate.js";
import { MemoryRoomHost } from "../room-host/memory-room-host.js";
import { RateLimitService } from "../services/rate-limit-service.js";

export interface RoomServerHeartbeat {
  /** How often the server pings each socket at the protocol level. */
  readonly intervalMs: number;
  /** How long a socket may stay silent, answering no ping, before it is dropped. */
  readonly silenceMs: number;
}

export const DEFAULT_ROOM_SERVER_HEARTBEAT: RoomServerHeartbeat = {
  intervalMs: 10_000,
  silenceMs: 45_000,
};

export interface CreateRoomServerOptions extends ServerLoggingOptions {
  readonly host?: string;
  readonly port?: number;
  readonly envConfig?: ServerEnvConfig;
  readonly allowedOrigins?: AllowedOrigins;
  /** Replaces the gate the environment chooses: open to all, or the master key. */
  readonly gate?: RoomGate;
  /** The limits the environment's gates open rooms with. */
  readonly limits?: RoomLimits;
  readonly heartbeat?: RoomServerHeartbeat;
}

export interface RoomServerRuntime {
  readonly httpServer: Server;
  readonly rooms: MemoryRoomHost;
  start(portOverride?: number): Promise<number>;
  /** Stops every room as "restarting", so its devices come back, then closes the server. */
  stop(): Promise<void>;
  getPort(): number | null;
  flushDevLogs(): Promise<void>;
}

const BODY_LIMIT_BYTES = 512 * 1024;
/** How long closing sockets get to finish their closing handshake on shutdown. */
const CLOSE_GRACE_MS = 2_000;

const refuseNewRooms: RoomGate = {
  admit: () => ({ outcome: "refuse", reason: "try-later" }),
};

const environmentGate = (
  envConfig: ServerEnvConfig,
  limits: RoomLimits,
): RoomGate => {
  if (envConfig.authMode === "disabled") return createOpenRoomGate(limits);
  if (!envConfig.masterKey)
    throw new Error(
      "Required authentication needs a gate. AIR_JAM_MASTER_KEY is available only for local development and tests.",
    );
  return createMasterKeyRoomGate(envConfig.masterKey, limits);
};

const readBody = (request: IncomingMessage): Promise<string | null> =>
  new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let length = 0;
    request.on("data", (chunk: Buffer) => {
      length += chunk.byteLength;
      if (length > BODY_LIMIT_BYTES) {
        resolve(null);
        request.destroy();
      } else chunks.push(chunk);
    });
    request.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    request.on("error", reject);
  });

const parseJson = (text: string): unknown => {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
};

const rejectUpgrade = (socket: Duplex, status: number): void => {
  socket.end(
    `HTTP/1.1 ${status} ${STATUS_CODES[status]}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`,
  );
};

const factMessages: Record<RoomFact["kind"], string> = {
  opened: "Room opened",
  "seat-joined": "Seat joined",
  "seat-dropped": "Seat dropped",
  "seat-left": "Seat left",
  activity: "Room activity changed",
  closed: "Room closed",
};

/**
 * The room server for self-hosters, local development and Studio
 * workspaces: rooms in memory behind `node:http` and `ws`, at the protocol's
 * paths. It runs beside the socket.io server until the SDK switches to it;
 * it reads the same environment.
 */
export const createRoomServer = (
  options: CreateRoomServerOptions = {},
): RoomServerRuntime => {
  const envConfig = options.envConfig ?? loadServerEnv();
  const { logger, devLogCollector } = createServerLogging(options, envConfig);
  const collector = devLogCollector || null;
  const heartbeat = options.heartbeat ?? DEFAULT_ROOM_SERVER_HEARTBEAT;
  const gate =
    options.gate ??
    environmentGate(envConfig, options.limits ?? DEFAULT_ROOM_LIMITS);
  const corsOrigin = resolveCorsOrigin(
    options.allowedOrigins,
    envConfig.allowedOrigins,
  );
  const rateLimits = new RateLimitService();
  const allowedOrigin = (origin: string): boolean =>
    corsOrigin === "*" ||
    corsOrigin.some((allowed) =>
      typeof allowed === "string" ? allowed === origin : allowed.test(origin),
    );

  const rooms = new MemoryRoomHost({
    gate: envConfig.maintenanceMode ? refuseNewRooms : gate,
    codesMayBeAsked: true,
    afterTurn: setImmediate,
    onFact: ({ code, kind, ...details }) =>
      logger.info(
        { event: `room.${kind}`, roomId: code, ...details },
        factMessages[kind],
      ),
    onGateError: (error) =>
      logger.error(
        { err: error },
        "Room gate failed; the host was told to try later",
      ),
  });

  const answer = (
    response: ServerResponse,
    status: number,
    body?: unknown,
  ): void => {
    if (body === undefined) {
      response.writeHead(status).end();
      return;
    }
    response
      .writeHead(status, { "content-type": "application/json" })
      .end(JSON.stringify(body));
  };

  const answerDevLog = (
    response: ServerResponse,
    { status, body }: DevLogRouteResponse,
  ) => answer(response, status, body);

  const handleRequest = async (
    request: IncomingMessage,
    response: ServerResponse,
  ): Promise<void> => {
    const origin = request.headers.origin;
    if (origin && allowedOrigin(origin)) {
      response.setHeader(
        "access-control-allow-origin",
        corsOrigin === "*" ? "*" : origin,
      );
      response.setHeader("vary", "origin");
    }
    if (request.method === "OPTIONS") {
      response.setHeader("access-control-allow-methods", "GET,POST");
      response.setHeader(
        "access-control-allow-headers",
        request.headers["access-control-request-headers"] ?? "content-type",
      );
      return answer(response, 204);
    }
    const path = new URL(request.url ?? "/", "http://server").pathname;
    if (request.method === "GET" && path === "/health") {
      const described = rooms.describe();
      return answer(response, 200, {
        ok: true,
        uptime: Math.floor(process.uptime()),
        rooms: described.length,
        seats: described.reduce((total, room) => total + room.seats.length, 0),
        maintenance: envConfig.maintenanceMode,
      });
    }
    if (request.method === "GET" && path === "/ready")
      return answer(response, envConfig.maintenanceMode ? 503 : 200, {
        ok: !envConfig.maintenanceMode,
        maintenance: envConfig.maintenanceMode,
      });
    if (request.method === "POST" && path === "/__airjam/dev/browser-logs") {
      const body = await readBody(request);
      if (body === null) return answer(response, 413, { ok: false });
      return answerDevLog(
        response,
        receiveBrowserLogBatch(collector, parseJson(body)),
      );
    }
    if (request.method === "POST" && path === "/__airjam/dev/browser-unload") {
      const body = await readBody(request);
      if (body === null) return answer(response, 413, { ok: false });
      return answerDevLog(response, receiveBrowserUnload(collector, body));
    }
    answer(response, 404, { ok: false });
  };

  const httpServer = createServer((request, response) => {
    handleRequest(request, response).catch((error: unknown) => {
      logger.error({ err: error }, "Room server request failed");
      if (!response.headersSent) answer(response, 500, { ok: false });
    });
  });

  const sockets = new WebSocketServer({
    noServer: true,
    maxPayload: 1024 * 1024,
  });
  const lastHeard = new Map<WebSocket, number>();

  const connect = (
    socket: WebSocket,
    address: RoomAddress,
    origin: string | null,
  ): void => {
    lastHeard.set(socket, Date.now());
    const handlers = rooms.accept(address, origin, {
      send: (data) => {
        if (socket.readyState === socket.OPEN) socket.send(data);
      },
      close: (code) =>
        socket.close(code, roomCloseReasonForCode(code) ?? undefined),
    });
    socket.on("message", (data: Buffer, isBinary: boolean) => {
      lastHeard.set(socket, Date.now());
      handlers.receive(isBinary ? data : data.toString("utf8"));
    });
    socket.on("pong", () => lastHeard.set(socket, Date.now()));
    socket.on("close", () => {
      lastHeard.delete(socket);
      handlers.closed();
    });
    socket.on("error", (error) =>
      logger.debug({ err: error, roomId: address.code }, "Room socket error"),
    );
  };

  httpServer.on("upgrade", (request: IncomingMessage, socket: Duplex, head) => {
    const path = new URL(request.url ?? "/", "http://server").pathname;
    const address = parseRoomPath(path);
    if (!address) return rejectUpgrade(socket, 404);
    const origin = request.headers.origin ?? null;
    if (origin !== null && !allowedOrigin(origin))
      return rejectUpgrade(socket, 403);
    const client = resolveSocketIdentifier(
      request.headers["x-forwarded-for"],
      request.socket.remoteAddress,
      "unknown-client",
      envConfig.proxyHeaderTrustMode,
    );
    const limit =
      address.role === "host"
        ? envConfig.hostRegistrationRateLimitMax
        : envConfig.controllerJoinRateLimitMax;
    if (
      !rateLimits.check(
        `room-${address.role}:${client}`,
        limit,
        envConfig.rateLimitWindowMs,
      ).allowed
    )
      return rejectUpgrade(socket, 429);
    sockets.handleUpgrade(request, socket, head, (webSocket) =>
      connect(webSocket, address, origin),
    );
  });

  // A browser answers protocol-level pings even in a background tab, where
  // its own timers are throttled, so these decide whether a device is gone.
  const sweep = setInterval(() => {
    const now = Date.now();
    for (const [socket, heard] of lastHeard)
      if (now - heard > heartbeat.silenceMs) socket.terminate();
      else socket.ping();
  }, heartbeat.intervalMs);
  sweep.unref();

  let activePort: number | null = null;
  let stopping: Promise<void> | null = null;

  const start = async (portOverride?: number): Promise<number> => {
    if (httpServer.listening) return activePort ?? envConfig.port;
    const port = portOverride ?? options.port ?? envConfig.port;
    const host = options.host ?? envConfig.bindHost;
    await new Promise<void>((resolve, reject) => {
      httpServer.once("error", reject);
      httpServer.listen({ port, ...(host ? { host } : {}) }, () => {
        httpServer.off("error", reject);
        resolve();
      });
    });
    const address = httpServer.address();
    activePort = typeof address === "object" && address ? address.port : port;
    logger.info(
      {
        event: AIRJAM_DEV_LOG_EVENTS.server.started,
        port: activePort,
        corsOrigin,
        authMode: envConfig.authMode,
      },
      `Room server listening on http://localhost:${activePort}`,
    );
    return activePort;
  };

  const stop = (): Promise<void> => {
    stopping ??= (async () => {
      clearInterval(sweep);
      rooms.stop();
      const open = [...sockets.clients];
      await Promise.race([
        Promise.all(
          open.map(
            (socket) =>
              new Promise<void>((resolve) => {
                if (socket.readyState === socket.CLOSED) resolve();
                else socket.once("close", () => resolve());
              }),
          ),
        ),
        new Promise((resolve) => setTimeout(resolve, CLOSE_GRACE_MS).unref()),
      ]);
      for (const socket of sockets.clients) socket.terminate();
      await new Promise<void>((resolve) => sockets.close(() => resolve()));
      if (httpServer.listening) {
        const closed = new Promise<void>((resolve) =>
          httpServer.close(() => resolve()),
        );
        httpServer.closeAllConnections();
        await closed;
      }
      activePort = null;
      await collector?.flush();
    })();
    return stopping;
  };

  return {
    httpServer,
    rooms,
    start,
    stop,
    getPort: () => activePort,
    flushDevLogs: async () => {
      await collector?.flush();
    },
  };
};

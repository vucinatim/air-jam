import type {
  ClientToServerEvents,
  InterServerEvents,
  ServerToClientEvents,
  SocketData,
} from "@air-jam/sdk/protocol";
import cors from "cors";
import express from "express";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Server } from "socket.io";
import { registerSocketHandlers } from "./gateway/register-socket-handlers.js";
import { AuthService, authService } from "./services/auth-service.js";
import { RateLimitService, rateLimitService } from "./services/rate-limit-service.js";
import { RoomManager, roomManager } from "./services/room-manager.js";

const parsePositiveInt = (
  value: string | undefined,
  fallback: number,
): number => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

export type AirJamIoServer = Server<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;

export interface CreateAirJamServerOptions {
  port?: number;
  rateLimitWindowMs?: number;
  hostRegistrationRateLimitMax?: number;
  controllerJoinRateLimitMax?: number;
  allowedOrigins?: string[] | "*";
  authService?: AuthService;
  rateLimitService?: RateLimitService;
  roomManager?: RoomManager;
}

export interface AirJamServerRuntime {
  app: express.Express;
  httpServer: ReturnType<typeof createServer>;
  io: AirJamIoServer;
  start: (portOverride?: number) => Promise<number>;
  stop: () => Promise<void>;
  getPort: () => number | null;
}

const parseAllowedOrigins = (input?: string[] | "*"): string[] | "*" => {
  if (input === "*") {
    return "*";
  }

  if (input && input.length > 0) {
    return input.includes("*") ? "*" : input;
  }

  const allowedOrigins = process.env.AIR_JAM_ALLOWED_ORIGINS?.split(",")
    .map((origin) => origin.trim().replace(/^['"]|['"]$/g, ""))
    .filter(Boolean);

  if (
    !allowedOrigins ||
    allowedOrigins.length === 0 ||
    allowedOrigins.includes("*")
  ) {
    return "*";
  }

  return allowedOrigins;
};

export const createAirJamServer = (
  options: CreateAirJamServerOptions = {},
): AirJamServerRuntime => {
  let activePort: number | null = null;

  const roomManagerInstance = options.roomManager ?? roomManager;
  const rateLimitServiceInstance = options.rateLimitService ?? rateLimitService;
  const authServiceInstance = options.authService ?? authService;

  const defaultPort = Number(process.env.PORT ?? 4000);
  const rateLimitWindowMs =
    options.rateLimitWindowMs ??
    parsePositiveInt(process.env.AIR_JAM_RATE_LIMIT_WINDOW_MS, 60_000);
  const hostRegistrationRateLimitMax =
    options.hostRegistrationRateLimitMax ??
    parsePositiveInt(process.env.AIR_JAM_HOST_REGISTRATION_RATE_LIMIT_MAX, 30);
  const controllerJoinRateLimitMax =
    options.controllerJoinRateLimitMax ??
    parsePositiveInt(process.env.AIR_JAM_CONTROLLER_JOIN_RATE_LIMIT_MAX, 120);
  const corsOrigin = parseAllowedOrigins(options.allowedOrigins);

  const app = express();
  app.use(cors({ origin: corsOrigin }));
  app.use(express.json());

  app.get("/health", (_, res) => {
    res.json({ ok: true });
  });

  const httpServer = createServer(app);

  const io = new Server<
    ClientToServerEvents,
    ServerToClientEvents,
    InterServerEvents,
    SocketData
  >(httpServer, {
    cors: { origin: corsOrigin },
    pingInterval: 2000,
    pingTimeout: 5000,
  });

  io.on("connection", (socket) => {
    registerSocketHandlers({
      io,
      socket,
      roomManager: roomManagerInstance,
      rateLimitService: rateLimitServiceInstance,
      authService: authServiceInstance,
      rateLimitWindowMs,
      hostRegistrationRateLimitMax,
      controllerJoinRateLimitMax,
    });
  });

  const start = async (portOverride?: number): Promise<number> => {
    if (httpServer.listening) {
      return activePort ?? defaultPort;
    }

    const resolvedPort = portOverride ?? options.port ?? defaultPort;
    await new Promise<void>((resolve, reject) => {
      httpServer.once("error", reject);
      httpServer.listen(resolvedPort, () => {
        httpServer.off("error", reject);
        resolve();
      });
    });

    const address = httpServer.address();
    activePort =
      typeof address === "object" && address?.port ? address.port : resolvedPort;

    console.log(`[air-jam] server listening on http://localhost:${activePort}`);
    return activePort;
  };

  const stop = async (): Promise<void> => {
    if (!httpServer.listening) {
      return;
    }

    await new Promise<void>((resolve) => {
      io.close(() => resolve());
    });

    activePort = null;
  };

  const getPort = (): number | null => activePort;

  return {
    app,
    httpServer,
    io,
    start,
    stop,
    getPort,
  };
};

const isMainModule = (() => {
  if (!process.argv[1]) {
    return false;
  }
  const thisFilePath = fileURLToPath(import.meta.url);
  return thisFilePath === path.resolve(process.argv[1]);
})();

if (isMainModule) {
  const runtime = createAirJamServer();
  runtime.start().catch((error) => {
    console.error("[air-jam] failed to start server", error);
    process.exitCode = 1;
  });
}

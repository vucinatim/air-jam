import {
  AIRJAM_DEV_LOG_EVENTS,
  type ClientToServerEvents,
  type InterServerEvents,
  type ServerToClientEvents,
  type SocketData,
} from "@air-jam/sdk/protocol";
import {
  formatEnvValidationError,
  isEnvValidationError,
} from "@air-jam/env";
import cors from "cors";
import express from "express";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Server } from "socket.io";
import { registerSocketHandlers } from "./gateway/register-socket-handlers.js";
import {
  AuthService,
  type HostBootstrapAuthService,
} from "./services/auth-service.js";
import { createServerLogger, type ServerLogger } from "./logging/logger.js";
import { resolveDefaultDevLogDir } from "./logging/log-paths.js";
import {
  DevLogCollector,
  type BrowserLogBatchPayload,
  type BrowserLogUnloadPayload,
} from "./logging/dev-log-collector.js";
import {
  type RuntimeUsagePublisher,
} from "./analytics/runtime-usage.js";
import { createDatabaseRuntimeUsageLedgerPublisher } from "./analytics/runtime-usage-ledger.js";
import { RateLimitService, rateLimitService } from "./services/rate-limit-service.js";
import { RoomManager, roomManager } from "./services/room-manager.js";
import { loadServerEnv, type ServerEnvConfig } from "./env/server-env.js";

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
  staticAppRateLimitMax?: number;
  allowedOrigins?: string[] | "*";
  logger?: ServerLogger;
  authService?: HostBootstrapAuthService;
  runtimeUsagePublisher?: RuntimeUsagePublisher;
  rateLimitService?: RateLimitService;
  roomManager?: RoomManager;
  devLogCollector?: DevLogCollector | false;
  devLogDir?: string;
  envConfig?: ServerEnvConfig;
}

export interface AirJamServerRuntime {
  app: express.Express;
  httpServer: ReturnType<typeof createServer>;
  io: AirJamIoServer;
  start: (portOverride?: number) => Promise<number>;
  stop: () => Promise<void>;
  flushDevLogs: () => Promise<void>;
  getPort: () => number | null;
}

const parseAllowedOrigins = (
  input: string[] | "*" | undefined,
  fallback: string[] | "*",
): string[] | "*" => {
  if (input === "*") {
    return "*";
  }

  if (input && input.length > 0) {
    return input.includes("*") ? "*" : input;
  }

  return fallback;
};

export const createAirJamServer = (
  options: CreateAirJamServerOptions = {},
): AirJamServerRuntime => {
  const envConfig = options.envConfig ?? loadServerEnv();
  let activePort: number | null = null;

  const devLogCollector =
    options.devLogCollector === false
      ? null
      : options.devLogCollector ??
        new DevLogCollector({
          enabled: envConfig.devLogCollectorEnabled,
          logDir:
            options.devLogDir ?? envConfig.devLogDir ?? resolveDefaultDevLogDir(),
        });
  const logger =
    options.logger ??
    createServerLogger(
      { service: "air-jam-server" },
      undefined,
      devLogCollector,
      { level: envConfig.logLevel },
    );
  const roomManagerInstance = options.roomManager ?? roomManager;
  const rateLimitServiceInstance = options.rateLimitService ?? rateLimitService;
  const authServiceInstance =
    options.authService ??
    new AuthService({
      logger: logger.child({ component: "auth" }),
      env: {
        authMode: envConfig.authMode,
        masterKey: envConfig.masterKey,
        hostGrantSecret: envConfig.hostGrantSecret,
        databaseUrl: envConfig.databaseUrl,
        nodeEnv: envConfig.nodeEnv,
      },
    });
  const runtimeUsagePublisher =
    options.runtimeUsagePublisher ??
    createDatabaseRuntimeUsageLedgerPublisher(
      logger.child({ component: "analytics" }),
    );
  const startupConfigurationError =
    typeof authServiceInstance.getStartupConfigurationError === "function"
      ? authServiceInstance.getStartupConfigurationError()
      : null;
  if (startupConfigurationError) {
    throw new Error(startupConfigurationError);
  }

  const defaultPort = envConfig.port;
  const rateLimitWindowMs = options.rateLimitWindowMs ?? envConfig.rateLimitWindowMs;
  const hostRegistrationRateLimitMax =
    options.hostRegistrationRateLimitMax ?? envConfig.hostRegistrationRateLimitMax;
  const controllerJoinRateLimitMax =
    options.controllerJoinRateLimitMax ?? envConfig.controllerJoinRateLimitMax;
  const staticAppRateLimitMax =
    options.staticAppRateLimitMax ?? envConfig.staticAppRateLimitMax;
  const corsOrigin = parseAllowedOrigins(options.allowedOrigins, envConfig.allowedOrigins);

  const app = express();
  app.use(cors({ origin: corsOrigin }));
  app.use(express.json());

  app.get("/health", (_, res) => {
    res.json({ ok: true });
  });

  app.post("/__airjam/dev/browser-logs", async (req, res) => {
    if (!devLogCollector?.enabled) {
      res.status(404).json({ ok: false });
      return;
    }

    const payload = req.body as BrowserLogBatchPayload | undefined;
    if (
      !payload ||
      (payload.mode !== "reset" && payload.mode !== "append") ||
      typeof payload.sessionId !== "string" ||
      !payload.sessionId ||
      !Array.isArray(payload.entries) ||
      payload.entries.length === 0 ||
      typeof payload.metadata !== "object" ||
      payload.metadata === null
    ) {
      res.status(400).json({ ok: false, message: "Invalid browser log payload" });
      return;
    }

    devLogCollector.enqueueBrowserBatch(payload);
    res.json({ ok: true });
  });

  app.post(
    "/__airjam/dev/browser-unload",
    express.text({ type: "*/*" }),
    async (req, res) => {
      if (!devLogCollector?.enabled) {
        res.status(404).json({ ok: false });
        return;
      }

      if (typeof req.body !== "string" || req.body.trim().length === 0) {
        res.status(400).json({ ok: false, message: "Invalid browser unload payload" });
        return;
      }

      let payload: BrowserLogUnloadPayload | null = null;
      try {
        payload = JSON.parse(req.body) as BrowserLogUnloadPayload;
      } catch {
        res.status(400).json({ ok: false, message: "Invalid browser unload payload" });
        return;
      }

      if (
        !payload ||
        typeof payload.sessionId !== "string" ||
        !payload.sessionId ||
        typeof payload.metadata !== "object" ||
        payload.metadata === null ||
        typeof payload.entry !== "object" ||
        payload.entry === null
      ) {
        res.status(400).json({ ok: false, message: "Invalid browser unload payload" });
        return;
      }

      devLogCollector.enqueueBrowserUnload(payload);
      res.status(204).end();
    },
  );

  const httpServer = createServer(app);

  const io = new Server<
    ClientToServerEvents,
    ServerToClientEvents,
    InterServerEvents,
    SocketData
  >(httpServer, {
    cors: { origin: corsOrigin },
    // Arcade tab: system host + game iframe share one event loop. Heavy WebGL /
    // match start can stall the JS thread for several seconds; the default
    // ~5s ping window drops the master host and tears down the room.
    pingInterval: 10_000,
    pingTimeout: 45_000,
  });

  io.on("connection", (socket) => {
    registerSocketHandlers({
      io,
      socket,
      logger,
      roomManager: roomManagerInstance,
      rateLimitService: rateLimitServiceInstance,
      authService: authServiceInstance,
      runtimeUsagePublisher,
      rateLimitWindowMs,
      hostRegistrationRateLimitMax,
      controllerJoinRateLimitMax,
      staticAppRateLimitMax,
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

    logger.info(
      {
        event: AIRJAM_DEV_LOG_EVENTS.server.started,
        port: activePort,
        corsOrigin,
      },
      `Server listening on http://localhost:${activePort}`,
    );
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
    await devLogCollector?.flush();
  };

  const flushDevLogs = async (): Promise<void> => {
    await devLogCollector?.flush();
  };

  const getPort = (): number | null => activePort;

  return {
    app,
    httpServer,
    io,
    start,
    stop,
    flushDevLogs,
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
  Promise.resolve()
    .then(() => createAirJamServer())
    .then((runtime) => runtime.start())
    .catch((error) => {
      if (isEnvValidationError(error)) {
        console.error(
          formatEnvValidationError(error, {
            docsHint:
              "Fix the listed AIR_JAM_* variables and retry. For local dev, check .env.local.",
          }),
        );
        process.exitCode = 1;
        return;
      }

      const logger = createServerLogger({ service: "air-jam-server" });
      logger.error({ err: error }, "Failed to start server");
      process.exitCode = 1;
    });
}

import {
  AIRJAM_DEV_LOG_EVENTS,
  type ClientToServerEvents,
  type InterServerEvents,
  type ServerToClientEvents,
  type SocketData,
} from "@air-jam/sdk/protocol";
import cors from "cors";
import express from "express";
import { createServer } from "node:http";
import { Server } from "socket.io";
import {
  createNoopRuntimeUsagePublisher,
  type RuntimeUsagePublisher,
} from "./analytics/runtime-usage.js";
import { loadServerEnv, type ServerEnvConfig } from "./env/server-env.js";
import { registerSocketHandlers } from "./gateway/register-socket-handlers.js";
import type {
  BrowserLogBatchPayload,
  BrowserLogUnloadPayload,
} from "./logging/dev-log-collector.js";
import {
  createServerLogging,
  type ServerLoggingOptions,
} from "./logging/server-logging.js";
import {
  createNoopServerOperationalEventPublisher,
  publishServerOperationalFailureSafely,
  type ServerOperationalEventPublisher,
} from "./operations/operational-event-publisher.js";
import { resolveCorsOrigin, type AllowedOrigins } from "./origin-policy.js";
import {
  AuthService,
  type HostBootstrapAuthService,
} from "./services/auth-service.js";
import { RateLimitService } from "./services/rate-limit-service.js";
import {
  createLocalRealtimeAdmissionService,
  type RealtimeAdmissionService,
  type RealtimeAdmissionStatus,
  type RealtimeAdmissionTerminalFailure,
} from "./services/realtime-admission-service.js";
import { RoomManager } from "./services/room-manager.js";

export type AirJamIoServer = Server<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;

const projectPublicRealtimeAdmissionStatus = (
  status: RealtimeAdmissionStatus,
) => ({
  contractVersion: status.contractVersion,
  authority: status.authority,
  budgetRequirement: status.budgetRequirement,
  acceptingNewWork: status.acceptingNewWork,
  draining: status.draining,
  terminalAuthorityLost: status.terminalAuthorityLost,
  pendingReconciliations: status.pendingReconciliations,
  lastHeartbeatAt: status.lastHeartbeatAt,
  hasError: status.lastError !== null,
});

export interface CreateAirJamServerOptions extends ServerLoggingOptions {
  port?: number;
  rateLimitWindowMs?: number;
  hostRegistrationRateLimitMax?: number;
  controllerJoinRateLimitMax?: number;
  staticAppRateLimitMax?: number;
  runtimeErrorReportRateLimitMax?: number;
  drainTimeoutMs?: number;
  allowedOrigins?: AllowedOrigins;
  authService?: HostBootstrapAuthService;
  runtimeUsagePublisher?: RuntimeUsagePublisher;
  operationalEventPublisher?: ServerOperationalEventPublisher;
  rateLimitService?: RateLimitService;
  roomManager?: RoomManager;
  realtimeAdmissionService?: RealtimeAdmissionService;
  proxyHeaderTrustMode?: ServerEnvConfig["proxyHeaderTrustMode"];
  envConfig?: ServerEnvConfig;
}

export interface AirJamServerRuntime {
  app: express.Express;
  httpServer: ReturnType<typeof createServer>;
  io: AirJamIoServer;
  start: (portOverride?: number) => Promise<number>;
  drain: (timeoutMs?: number) => Promise<{
    completed: boolean;
    remainingRooms: number;
    waitedMs: number;
  }>;
  stop: () => Promise<void>;
  flushDevLogs: () => Promise<void>;
  getPort: () => number | null;
  onTerminalFailure: (
    listener: (failure: RealtimeAdmissionTerminalFailure) => void,
  ) => () => void;
}

export const createAirJamServer = (
  options: CreateAirJamServerOptions = {},
): AirJamServerRuntime => {
  const envConfig = options.envConfig ?? loadServerEnv();
  let activePort: number | null = null;
  let admissionStarted = false;
  let stopPromise: Promise<void> | null = null;
  let terminalFailure: RealtimeAdmissionTerminalFailure | null = null;
  const terminalFailureListeners = new Set<
    (failure: RealtimeAdmissionTerminalFailure) => void
  >();

  const { logger, devLogCollector } = createServerLogging(options, envConfig);
  const roomManagerInstance = options.roomManager ?? new RoomManager();
  const rateLimitServiceInstance =
    options.rateLimitService ?? new RateLimitService();
  const realtimeAdmissionService =
    options.realtimeAdmissionService ?? createLocalRealtimeAdmissionService();
  const operationalEventPublisher =
    options.operationalEventPublisher ??
    createNoopServerOperationalEventPublisher();
  const authServiceInstance =
    options.authService ??
    new AuthService({
      env: { authMode: envConfig.authMode, masterKey: envConfig.masterKey },
    });
  const runtimeUsagePublisher =
    options.runtimeUsagePublisher ?? createNoopRuntimeUsagePublisher();
  const startupConfigurationError =
    authServiceInstance.getStartupConfigurationError?.();
  if (startupConfigurationError) throw new Error(startupConfigurationError);

  const defaultPort = envConfig.port;
  const rateLimitWindowMs =
    options.rateLimitWindowMs ?? envConfig.rateLimitWindowMs;
  const hostRegistrationRateLimitMax =
    options.hostRegistrationRateLimitMax ??
    envConfig.hostRegistrationRateLimitMax;
  const controllerJoinRateLimitMax =
    options.controllerJoinRateLimitMax ?? envConfig.controllerJoinRateLimitMax;
  const staticAppRateLimitMax =
    options.staticAppRateLimitMax ?? envConfig.staticAppRateLimitMax;
  const runtimeErrorReportRateLimitMax =
    options.runtimeErrorReportRateLimitMax ??
    envConfig.runtimeErrorReportRateLimitMax;
  const corsOrigin = resolveCorsOrigin(
    options.allowedOrigins,
    envConfig.allowedOrigins,
  );

  const app = express();
  app.use(cors({ origin: corsOrigin }));
  app.use(express.json({ limit: "512kb" }));

  app.get("/health", (_, res) => {
    const rooms = roomManagerInstance.getAllRooms();
    let controllerCount = 0;
    for (const session of rooms.values()) {
      controllerCount += session.controllers.size;
    }
    const realtimeAdmission = projectPublicRealtimeAdmissionStatus(
      realtimeAdmissionService.getStatus(),
    );
    res.json({
      ok: true,
      uptime: Math.floor(process.uptime()),
      rooms: rooms.size,
      controllers: controllerCount,
      maintenance: envConfig.maintenanceMode,
      realtimeAdmission,
    });
  });

  app.get("/ready", (_, res) => {
    const realtimeAdmission = projectPublicRealtimeAdmissionStatus(
      realtimeAdmissionService.getStatus(),
    );
    const ok = !envConfig.maintenanceMode && realtimeAdmission.acceptingNewWork;
    res.status(ok ? 200 : 503).json({
      ok,
      maintenance: envConfig.maintenanceMode,
      realtimeAdmission,
    });
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
      res
        .status(400)
        .json({ ok: false, message: "Invalid browser log payload" });
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
        res
          .status(400)
          .json({ ok: false, message: "Invalid browser unload payload" });
        return;
      }

      let payload: BrowserLogUnloadPayload | null = null;
      try {
        payload = JSON.parse(req.body) as BrowserLogUnloadPayload;
      } catch {
        res
          .status(400)
          .json({ ok: false, message: "Invalid browser unload payload" });
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
        res
          .status(400)
          .json({ ok: false, message: "Invalid browser unload payload" });
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
      realtimeAdmissionService,
      rateLimitService: rateLimitServiceInstance,
      authService: authServiceInstance,
      runtimeUsagePublisher,
      operationalEventPublisher,
      rateLimitWindowMs,
      hostRegistrationRateLimitMax,
      controllerJoinRateLimitMax,
      staticAppRateLimitMax,
      runtimeErrorReportRateLimitMax,
      proxyHeaderTrustMode:
        options.proxyHeaderTrustMode ?? envConfig.proxyHeaderTrustMode,
      maintenanceMode: envConfig.maintenanceMode,
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

    await realtimeAdmissionService.start();
    admissionStarted = true;

    const address = httpServer.address();
    activePort =
      typeof address === "object" && address?.port
        ? address.port
        : resolvedPort;

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

  const drain = async (
    timeoutMs: number = options.drainTimeoutMs ?? 25_000,
  ): Promise<{
    completed: boolean;
    remainingRooms: number;
    waitedMs: number;
  }> => {
    const startedAt = Date.now();
    await realtimeAdmissionService.beginDrain();

    while (roomManagerInstance.getAllRooms().size > 0) {
      const remainingMs = timeoutMs - (Date.now() - startedAt);
      if (remainingMs <= 0) break;
      await new Promise<void>((resolve) => {
        const timer = setTimeout(resolve, Math.min(100, remainingMs));
        timer.unref?.();
      });
    }

    const remainingRooms = roomManagerInstance.getAllRooms().size;
    return {
      completed: remainingRooms === 0,
      remainingRooms,
      waitedMs: Date.now() - startedAt,
    };
  };

  const stop = async (): Promise<void> => {
    if (stopPromise) return stopPromise;
    stopPromise = (async () => {
      const cleanupErrors: unknown[] = [];
      const attempt = async (cleanup: () => void | Promise<void>) => {
        try {
          await cleanup();
        } catch (error) {
          cleanupErrors.push(error);
        }
      };

      if (admissionStarted) {
        await attempt(() => realtimeAdmissionService.beginDrain());
      }
      await attempt(() =>
        roomManagerInstance.clearAllRooms(io, "Server shutting down"),
      );

      if (httpServer.listening) {
        await attempt(
          () =>
            new Promise<void>((resolve) => {
              io.close(() => resolve());
            }),
        );
      }

      activePort = null;
      if (admissionStarted) {
        await attempt(() => realtimeAdmissionService.stop());
        admissionStarted = false;
      }
      await attempt(async () => devLogCollector?.flush());
      unsubscribeAdmissionFailure();

      if (cleanupErrors.length > 0) {
        throw new AggregateError(
          cleanupErrors,
          "Realtime server cleanup failed",
        );
      }
    })();
    return stopPromise;
  };

  const flushDevLogs = async (): Promise<void> => {
    await devLogCollector?.flush();
  };

  const getPort = (): number | null => activePort;

  const onTerminalFailure = (
    listener: (failure: RealtimeAdmissionTerminalFailure) => void,
  ): (() => void) => {
    terminalFailureListeners.add(listener);
    if (terminalFailure) {
      queueMicrotask(() => {
        if (terminalFailure && terminalFailureListeners.has(listener)) {
          listener(terminalFailure);
        }
      });
    }
    return () => terminalFailureListeners.delete(listener);
  };

  const unsubscribeAdmissionFailure =
    realtimeAdmissionService.onTerminalAuthorityLoss((failure) => {
      if (terminalFailure) return;
      terminalFailure = failure;
      publishServerOperationalFailureSafely({
        publisher: operationalEventPublisher,
        logger,
        input: {
          code: "realtime_admission.instance_lease_lost",
          failureClass: "dependency",
          summary:
            "The realtime server lost its database-backed admission authority.",
          retryable: false,
          component: "realtime-admission",
          subject: { type: "service", id: "realtime_server" },
          correlation: {
            contractVersion: 1,
            correlationId: `realtime-admission:${crypto.randomUUID()}`,
          },
          details: {
            authorityFailureCode: failure.code,
            action: "drain_and_stop_instance",
          },
        },
      });
      for (const listener of terminalFailureListeners) listener(failure);
    });

  return {
    app,
    httpServer,
    io,
    start,
    drain,
    stop,
    flushDevLogs,
    getPort,
    onTerminalFailure,
  };
};

export {
  createRuntimeUsageEvent,
  type RuntimeUsageEvent,
  type RuntimeUsagePublisher,
} from "./analytics/runtime-usage.js";
export { loadWorkspaceEnv } from "./env/load-workspace-env.js";
export { loadServerEnv, type ServerEnvConfig } from "./env/server-env.js";
export { createServerLogger, type ServerLogger } from "./logging/logger.js";
export { createServerLogging } from "./logging/server-logging.js";
export {
  publishServerOperationalFailureSafely,
  type ServerOperationalEventPublisher,
} from "./operations/operational-event-publisher.js";
export type { ServerOperationalFailureInput } from "./operations/operational-event-publisher.js";
export { installServerProcessSignalHandlers } from "./process-lifecycle.js";
export type {
  HostBootstrapAuthService,
  HostBootstrapVerificationResult,
  VerificationResult,
  VerifyAppIdContext,
  VerifyHostBootstrapInput,
} from "./services/auth-service.js";
export { RateLimitService } from "./services/rate-limit-service.js";
export {
  createLocalRealtimeAdmissionService,
  type RealtimeAdmissionDenial,
  type RealtimeAdmissionService,
  type RealtimeAdmissionStatus,
  type RealtimeAdmissionTerminalFailure,
  type RealtimeControllerLease,
  type RealtimeRoomLease,
} from "./services/realtime-admission-service.js";
export type {
  RealtimeAdmissionDecision,
  RealtimeAdmissionDenialReason,
} from "./services/realtime-admission-service.js";
export { RoomManager } from "./services/room-manager.js";

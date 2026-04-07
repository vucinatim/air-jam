import {
  AIRJAM_DEV_LOG_EVENTS,
  ErrorCode,
  hostActivateEmbeddedGameSchema,
  hostBootstrapSchema,
  type HostSessionKind,
  hostCreateRoomSchema,
  hostJoinAsChildSchema,
  hostReconnectSchema,
  hostRegisterSystemSchema,
  systemLaunchGameSchema,
  type AirJamDevLogEventName,
  type HostActivateEmbeddedGamePayload,
  type HostBootstrapAck,
  type HostBootstrapPayload,
  type HostCreateRoomPayload,
  type HostJoinAsChildPayload,
  type HostRegistrationAck,
  type HostReconnectPayload,
  type HostRegisterSystemPayload,
  type PlayerProfile,
  type SystemLaunchGamePayload,
} from "@air-jam/sdk/protocol";
import { v4 as uuidv4 } from "uuid";
import {
  createRoomAnalyticsState,
  createRoomRuntimeUsageEvent,
  createRuntimeUsageEvent,
  syncRoomAnalyticsState,
} from "../../analytics/runtime-usage.js";
import { redactIdentifier } from "../../logging/logger.js";
import {
  activateChildHost,
  activateEmbeddedGame,
  beginChildHostActivation,
  beginGameLaunch,
  beginRoomClosing,
  buildArcadeSessionForHostAck,
  buildControllerCapabilityForHostAck,
  canBeginGameLaunch,
  disconnectChildHostIfPresent,
  getRoomLifecyclePhase,
  isChildHostCapabilityExpired,
  issueControllerPrivilegedCapability,
  issueChildHostCapability,
  toControllerJoinedNotice,
  transitionToSystemFocus,
} from "../../domain/room-session-domain.js";
import type { RoomSession } from "../../types.js";
import { generateRoomCode } from "../../utils/ids.js";
import type { SocketHandlerContext } from "../socket-handler-context.js";

export const registerHostLifecycleHandlers = (
  context: SocketHandlerContext,
): void => {
  const { io, socket, roomManager, authService, runtimeUsagePublisher } =
    context;
  const logger = context.logger.child({ component: "host-lifecycle" });
  const requestOrigin =
    typeof socket.handshake.headers.origin === "string"
      ? socket.handshake.headers.origin
      : undefined;

  const bindHostAuthority = (
    appId?: string,
    gameId?: string,
    verifiedVia?: "appId" | "hostGrant",
    verifiedOrigin?: string,
    hostSessionKind: HostSessionKind = "system",
  ): string => {
    const traceId = `host_${uuidv4().replace(/-/g, "").slice(0, 12)}`;
    socket.data.hostAuthority = {
      appId,
      gameId,
      traceId,
      verifiedAt: Date.now(),
      verifiedVia,
      verifiedOrigin,
      hostSessionKind,
    };
    return traceId;
  };

  const createInitialRoomSession = (
    roomId: string,
    maxPlayers: number,
    hostSessionKind: HostSessionKind,
  ): RoomSession => {
    const analytics = createRoomAnalyticsState(socket.data.hostAuthority);
    analytics.hostSessionKind = hostSessionKind;
    const startsInGameFocus = hostSessionKind === "game";

    return {
      roomId,
      masterHostSocketId: socket.id,
      analytics,
      focus: startsInGameFocus ? "GAME" : "SYSTEM",
      launchCapability: undefined,
      controllerCapability: issueControllerPrivilegedCapability(uuidv4()),
      activeGameId: startsInGameFocus ? analytics.gameId : undefined,
      controllers: new Map(),
      maxPlayers,
      gameState: "paused",
      controllerOrientation: "portrait",
      lifecycleState: startsInGameFocus ? "GAME_ACTIVE" : "SYSTEM_IDLE",
    };
  };

  const buildHostRosterSnapshot = (session: RoomSession): PlayerProfile[] =>
    Array.from(session.controllers.values(), (controller) => controller.playerProfile);

  const getControllerCapabilityForAck = (
    session: RoomSession,
  ) => buildControllerCapabilityForHostAck(session, uuidv4);

  const getHostLogger = (bindings: Record<string, unknown> = {}) => {
    const traceId = socket.data.hostAuthority?.traceId;
    const mergedBindings = {
      ...(traceId ? { traceId } : {}),
      ...bindings,
    };

    return Object.keys(mergedBindings).length > 0
      ? logger.child(mergedBindings)
      : logger;
  };

  const logHostEvent = (
    level: "info" | "warn",
    event: AirJamDevLogEventName,
    msg: string,
    bindings: Record<string, unknown> = {},
  ): void => {
    const target = getHostLogger(bindings);
    if (level === "warn") {
      target.warn({ event }, msg);
      return;
    }
    target.info({ event }, msg);
  };

  const resolveStaticAppQuotaScope = (): string | null => {
    const authority = socket.data.hostAuthority;
    if (!authority?.appId || authority.verifiedVia !== "appId") {
      return null;
    }

    return `${authority.appId}::${authority.verifiedOrigin ?? "unknown-origin"}`;
  };

  const isStaticAppRateLimited = (bucket: string): boolean => {
    const scope = resolveStaticAppQuotaScope();
    if (!scope) {
      return false;
    }

    return context.isScopedRateLimited(
      bucket,
      scope,
      context.staticAppRateLimitMax,
    );
  };

  const ensureHostAuthority = (
    eventName: string,
    callback: (ack: HostRegistrationAck) => void,
  ): boolean => {
    if (socket.data.hostAuthority) {
      return true;
    }

    logHostEvent(
      "warn",
      AIRJAM_DEV_LOG_EVENTS.host.lifecycleRejected,
      "Rejected host lifecycle event before bootstrap",
      {
        eventName,
        reason: "bootstrap_required",
      },
    );
    callback({
      ok: false,
      message: "Unauthorized: Host bootstrap required",
      code: ErrorCode.UNAUTHORIZED,
    });
    return false;
  };

  socket.on(
    "host:bootstrap",
    async (
      payload: HostBootstrapPayload,
      callback: (ack: HostBootstrapAck) => void,
    ) => {
      if (
        context.isRateLimited(
          "host-bootstrap",
          context.hostRegistrationRateLimitMax,
        )
      ) {
        logHostEvent(
          "warn",
          AIRJAM_DEV_LOG_EVENTS.host.bootstrapRejected,
          "Rejected host bootstrap due to socket rate limit",
          { reason: "rate_limited" },
        );
        callback({
          ok: false,
          message: "Too many host registration attempts. Please try again.",
          code: ErrorCode.SERVICE_UNAVAILABLE,
        });
        return;
      }

      const parsed = hostBootstrapSchema.safeParse(payload);
      if (!parsed.success) {
        logHostEvent(
          "warn",
          AIRJAM_DEV_LOG_EVENTS.host.bootstrapRejected,
          "Rejected host bootstrap with invalid payload",
          {
            reason: "invalid_payload",
            issues: parsed.error.issues,
          },
        );
        callback({
          ok: false,
          message: parsed.error.message,
          code: ErrorCode.INVALID_PAYLOAD,
        });
        return;
      }

      const verification = await authService.verifyHostBootstrap({
        appId: parsed.data.appId,
        hostGrant: parsed.data.hostGrant,
        origin: requestOrigin,
      });
      if (!verification.isVerified) {
        logHostEvent(
          "warn",
          AIRJAM_DEV_LOG_EVENTS.host.bootstrapRejected,
          "Rejected host bootstrap",
          {
            reason: verification.error,
            appIdHint: redactIdentifier(parsed.data.appId),
            hasHostGrant: Boolean(parsed.data.hostGrant),
          },
        );
        callback({
          ok: false,
          message: verification.error,
          code: ErrorCode.INVALID_APP_ID,
        });
        return;
      }

      if (
        verification.verifiedVia === "appId" &&
        verification.appId &&
        context.isScopedRateLimited(
          "static-app-bootstrap",
          `${verification.appId}::${verification.verifiedOrigin ?? "unknown-origin"}`,
          context.staticAppRateLimitMax,
        )
      ) {
        logHostEvent(
          "warn",
          AIRJAM_DEV_LOG_EVENTS.host.bootstrapRejected,
          "Rejected host bootstrap due to static app quota",
          {
            reason: "static_app_quota",
            appIdHint: redactIdentifier(verification.appId),
            verifiedOrigin: verification.verifiedOrigin,
          },
        );
        callback({
          ok: false,
          message: "Too many bootstrap attempts for this app. Please try again.",
          code: ErrorCode.SERVICE_UNAVAILABLE,
        });
        return;
      }

      const traceId = bindHostAuthority(
        verification.appId,
        verification.gameId,
        verification.verifiedVia,
        verification.verifiedOrigin,
        parsed.data.hostSessionKind,
      );
      logHostEvent("info", AIRJAM_DEV_LOG_EVENTS.host.bootstrapVerified, "Host bootstrap verified", {
        verifiedVia: verification.verifiedVia,
        appIdHint: redactIdentifier(verification.appId),
        verifiedOrigin: verification.verifiedOrigin,
      });
      runtimeUsagePublisher.publish(
        createRuntimeUsageEvent({
          kind: "host_bootstrap_verified",
          appId: verification.appId,
          hostVerifiedVia: verification.verifiedVia,
          hostVerifiedOrigin: verification.verifiedOrigin,
        }),
      );
      callback({ ok: true, traceId });
    },
  );

  socket.on(
    "host:registerSystem",
    async (payload: HostRegisterSystemPayload, callback) => {
      if (
        context.isRateLimited(
          "host-registration",
          context.hostRegistrationRateLimitMax,
        )
      ) {
        logHostEvent(
          "warn",
          AIRJAM_DEV_LOG_EVENTS.host.registerSystemRejected,
          "Rejected host registerSystem due to socket rate limit",
          { reason: "rate_limited" },
        );
        callback({
          ok: false,
          message: "Too many host registration attempts. Please try again.",
          code: ErrorCode.SERVICE_UNAVAILABLE,
        });
        return;
      }

      if (!ensureHostAuthority("host:registerSystem", callback)) {
        return;
      }

      if (isStaticAppRateLimited("static-app-lifecycle")) {
        logHostEvent(
          "warn",
          AIRJAM_DEV_LOG_EVENTS.host.registerSystemRejected,
          "Rejected host registerSystem due to static app quota",
          { reason: "static_app_quota" },
        );
        callback({
          ok: false,
          message: "Too many host lifecycle attempts for this app. Please try again.",
          code: ErrorCode.SERVICE_UNAVAILABLE,
        });
        return;
      }

      const parsed = hostRegisterSystemSchema.safeParse(payload);
      if (!parsed.success) {
        logHostEvent(
          "warn",
          AIRJAM_DEV_LOG_EVENTS.host.registerSystemRejected,
          "Rejected host registerSystem with invalid payload",
          {
            reason: "invalid_payload",
            issues: parsed.error.issues,
          },
        );
        callback({
          ok: false,
          message: parsed.error.message,
          code: ErrorCode.INVALID_PAYLOAD,
        });
        return;
      }

      const { roomId } = parsed.data;

      let session = roomManager.getRoom(roomId);
      if (session) {
        session.masterHostSocketId = socket.id;
        syncRoomAnalyticsState(session.analytics, socket.data.hostAuthority);
        roomManager.setRoom(roomId, session);
      } else {
        session = createInitialRoomSession(roomId, 32, "system");
        roomManager.setRoom(roomId, session);
      }

      roomManager.setHostRoom(socket.id, roomId);
      socket.join(roomId);

      logHostEvent("info", AIRJAM_DEV_LOG_EVENTS.host.registerSystemAccepted, "Host registered as system host", {
        roomId,
      });
      runtimeUsagePublisher.publish(
        createRoomRuntimeUsageEvent(session, {
          kind: "room_registered",
        }),
      );
      callback({
        ok: true,
        roomId,
        controllerCapability: getControllerCapabilityForAck(session),
      });
      io.to(roomId).emit("server:roomReady", { roomId });
    },
  );

  socket.on(
    "host:createRoom",
    async (
      payload: HostCreateRoomPayload,
      callback: (ack: HostRegistrationAck) => void,
    ) => {
      if (
        context.isRateLimited(
          "host-registration",
          context.hostRegistrationRateLimitMax,
        )
      ) {
        logHostEvent(
          "warn",
          AIRJAM_DEV_LOG_EVENTS.host.createRoomRejected,
          "Rejected host createRoom due to socket rate limit",
          { reason: "rate_limited" },
        );
        callback({
          ok: false,
          message: "Too many host registration attempts. Please try again.",
          code: ErrorCode.SERVICE_UNAVAILABLE,
        });
        return;
      }

      if (!ensureHostAuthority("host:createRoom", callback)) {
        return;
      }

      if (isStaticAppRateLimited("static-app-lifecycle")) {
        logHostEvent(
          "warn",
          AIRJAM_DEV_LOG_EVENTS.host.createRoomRejected,
          "Rejected host createRoom due to static app quota",
          { reason: "static_app_quota" },
        );
        callback({
          ok: false,
          message: "Too many host lifecycle attempts for this app. Please try again.",
          code: ErrorCode.SERVICE_UNAVAILABLE,
        });
        return;
      }

      const parsed = hostCreateRoomSchema.safeParse(payload);
      if (!parsed.success) {
        logHostEvent(
          "warn",
          AIRJAM_DEV_LOG_EVENTS.host.createRoomRejected,
          "Rejected host createRoom with invalid payload",
          {
            reason: "invalid_payload",
            issues: parsed.error.issues,
          },
        );
        callback({
          ok: false,
          message: parsed.error.message,
          code: ErrorCode.INVALID_PAYLOAD,
        });
        return;
      }

      const { maxPlayers } = parsed.data;

      const existingRoomId = roomManager.getRoomByHostId(socket.id);
      if (existingRoomId) {
        const existingSession = roomManager.getRoom(existingRoomId);
        if (
          existingSession &&
          existingSession.masterHostSocketId === socket.id
        ) {
          syncRoomAnalyticsState(
            existingSession.analytics,
            socket.data.hostAuthority,
          );
          logHostEvent(
            "info",
            AIRJAM_DEV_LOG_EVENTS.host.createRoomAccepted,
            "Host createRoom reused existing room",
            { roomId: existingRoomId, reused: true },
          );
          callback({
            ok: true,
            roomId: existingRoomId,
            players: buildHostRosterSnapshot(existingSession),
            controllerCapability: getControllerCapabilityForAck(existingSession),
          });
          return;
        }
      }

      let roomId: string;
      let attempts = 0;
      do {
        roomId = generateRoomCode();
        attempts += 1;
        if (attempts > 10) {
          logHostEvent(
            "warn",
            AIRJAM_DEV_LOG_EVENTS.host.createRoomRejected,
            "Rejected host createRoom because a unique room ID could not be generated",
            { reason: "room_id_generation_failed" },
          );
          callback({
            ok: false,
            message: "Failed to generate unique room ID",
            code: ErrorCode.CONNECTION_FAILED,
          });
          return;
        }
      } while (roomManager.getRoom(roomId));

      const session = createInitialRoomSession(
        roomId,
        maxPlayers ?? 8,
        socket.data.hostAuthority?.hostSessionKind ?? "game",
      );

      roomManager.setRoom(roomId, session);
      roomManager.setHostRoom(socket.id, roomId);
      socket.join(roomId);

      logHostEvent("info", AIRJAM_DEV_LOG_EVENTS.host.createRoomAccepted, "Host created room", {
        roomId,
        maxPlayers,
        reused: false,
      });
      runtimeUsagePublisher.publish(
        createRoomRuntimeUsageEvent(session, {
          kind: "room_created",
          payload: {
            maxPlayers: session.maxPlayers,
            hostSessionKind: session.analytics.hostSessionKind,
          },
        }),
      );
      if (session.lifecycleState === "GAME_ACTIVE") {
        runtimeUsagePublisher.publish(
          createRoomRuntimeUsageEvent(session, {
            kind: "game_became_active",
            payload: {
              activation: "host_create_room",
            },
          }),
        );
      }
      callback({
        ok: true,
        roomId,
        players: buildHostRosterSnapshot(session),
        controllerCapability: getControllerCapabilityForAck(session),
      });
      socket.emit("server:state", {
        roomId,
        state: {
          gameState: session.gameState,
          orientation: session.controllerOrientation,
        },
      });
      io.to(roomId).emit("server:roomReady", { roomId });
    },
  );

  socket.on(
    "host:reconnect",
    async (
      payload: HostReconnectPayload,
      callback: (ack: HostRegistrationAck) => void,
    ) => {
      if (
        context.isRateLimited(
          "host-registration",
          context.hostRegistrationRateLimitMax,
        )
      ) {
        logHostEvent(
          "warn",
          AIRJAM_DEV_LOG_EVENTS.host.reconnectRejected,
          "Rejected host reconnect due to socket rate limit",
          { reason: "rate_limited" },
        );
        callback({
          ok: false,
          message: "Too many host registration attempts. Please try again.",
          code: ErrorCode.SERVICE_UNAVAILABLE,
        });
        return;
      }

      if (!ensureHostAuthority("host:reconnect", callback)) {
        return;
      }

      if (isStaticAppRateLimited("static-app-lifecycle")) {
        logHostEvent(
          "warn",
          AIRJAM_DEV_LOG_EVENTS.host.reconnectRejected,
          "Rejected host reconnect due to static app quota",
          { reason: "static_app_quota" },
        );
        callback({
          ok: false,
          message: "Too many host lifecycle attempts for this app. Please try again.",
          code: ErrorCode.SERVICE_UNAVAILABLE,
        });
        return;
      }

      const parsed = hostReconnectSchema.safeParse(payload);
      if (!parsed.success) {
        logHostEvent(
          "warn",
          AIRJAM_DEV_LOG_EVENTS.host.reconnectRejected,
          "Rejected host reconnect with invalid payload",
          {
            reason: "invalid_payload",
            issues: parsed.error.issues,
          },
        );
        callback({
          ok: false,
          message: parsed.error.message,
          code: ErrorCode.INVALID_PAYLOAD,
        });
        return;
      }

      const { roomId } = parsed.data;

      const session = roomManager.getRoom(roomId);
      if (!session) {
        logHostEvent(
          "warn",
          AIRJAM_DEV_LOG_EVENTS.host.reconnectRejected,
          "Rejected host reconnect because room was not found",
          {
            roomId,
            reason: "room_not_found",
          },
        );
        callback({
          ok: false,
          message: "Room not found",
          code: ErrorCode.ROOM_NOT_FOUND,
        });
        return;
      }

      const previousMasterSocket = io.sockets.sockets.get(
        session.masterHostSocketId,
      );
      const isPreviousHostConnected = previousMasterSocket?.connected ?? false;
      if (
        !isPreviousHostConnected ||
        session.masterHostSocketId === socket.id
      ) {
        const previousGameState = session.gameState;
        // Host refresh/reconnect should always return the room to lobby-safe pause state.
        if (session.gameState === "playing") {
          session.gameState = "paused";
        }

        session.masterHostSocketId = socket.id;
        syncRoomAnalyticsState(session.analytics, socket.data.hostAuthority);
        roomManager.setRoom(roomId, session);
        roomManager.setHostRoom(socket.id, roomId);
        socket.join(roomId);

        if (previousGameState !== session.gameState) {
          io.to(roomId).emit("server:state", {
            roomId,
            state: {
              gameState: session.gameState,
              orientation: session.controllerOrientation,
            },
          });
        }

        logHostEvent("info", AIRJAM_DEV_LOG_EVENTS.host.reconnectAccepted, "Host reconnected to room", {
          roomId,
          controllerCount: session.controllers.size,
          focus: session.focus,
          previousGameState,
          nextGameState: session.gameState,
          resetToLobbyOnReconnect: previousGameState !== session.gameState,
        });
        callback({
          ok: true,
          roomId,
          arcadeSession: buildArcadeSessionForHostAck(session, uuidv4),
          players: buildHostRosterSnapshot(session),
          controllerCapability: getControllerCapabilityForAck(session),
        });
        socket.emit("server:state", {
          roomId,
          state: {
            gameState: session.gameState,
            orientation: session.controllerOrientation,
          },
        });
        io.to(roomId).emit("server:roomReady", { roomId });
      } else {
        logHostEvent(
          "warn",
          AIRJAM_DEV_LOG_EVENTS.host.reconnectRejected,
          "Rejected host reconnect because another active host owns the room",
          {
            roomId,
            reason: "active_host_exists",
          },
        );
        callback({
          ok: false,
          message: "Room already has an active host",
          code: ErrorCode.ALREADY_CONNECTED,
        });
      }
    },
  );

  socket.on(
    "system:launchGame",
    (payload: SystemLaunchGamePayload, callback) => {
      const parsed = systemLaunchGameSchema.safeParse(payload);
      if (!parsed.success) {
        logHostEvent(
          "warn",
          AIRJAM_DEV_LOG_EVENTS.system.launchGameRejected,
          "Rejected game launch with invalid payload",
          {
            reason: "invalid_payload",
            issues: parsed.error.issues,
          },
        );
        callback({
          ok: false,
          message: parsed.error.message,
          code: ErrorCode.INVALID_PAYLOAD,
        });
        return;
      }

      const { roomId, gameId } = parsed.data;
      const session = roomManager.getRoom(roomId);
      if (!session) {
        logHostEvent(
          "warn",
          AIRJAM_DEV_LOG_EVENTS.system.launchGameRejected,
          "Rejected game launch because room was not found",
          {
            roomId,
            gameId,
            reason: "room_not_found",
          },
        );
        callback({
          ok: false,
          message: "Room not found",
          code: ErrorCode.ROOM_NOT_FOUND,
        });
        return;
      }

      if (session.masterHostSocketId !== socket.id) {
        logHostEvent(
          "warn",
          AIRJAM_DEV_LOG_EVENTS.system.launchGameRejected,
          "Rejected game launch from non-system host",
          {
            roomId,
            gameId,
            reason: "unauthorized",
          },
        );
        callback({
          ok: false,
          message: "Unauthorized: Not System Host",
          code: ErrorCode.UNAUTHORIZED,
        });
        return;
      }

      const launchAvailability = canBeginGameLaunch(session);
      if (
        !launchAvailability.ok &&
        launchAvailability.reason === "GAME_ACTIVE"
      ) {
        logHostEvent(
          "warn",
          AIRJAM_DEV_LOG_EVENTS.system.launchGameRejected,
          "Rejected game launch because a game is already active",
          {
            roomId,
            gameId,
            reason: "game_active",
          },
        );
        callback({
          ok: false,
          message: "Game already active",
          code: ErrorCode.ALREADY_CONNECTED,
        });
        return;
      }

      if (
        !launchAvailability.ok &&
        launchAvailability.reason === "LAUNCH_PENDING" &&
        session.launchCapability &&
        !isChildHostCapabilityExpired(session.launchCapability)
      ) {
        logHostEvent(
          "info",
          AIRJAM_DEV_LOG_EVENTS.system.launchGameAccepted,
          "Reused pending launch capability",
          {
            roomId,
            gameId,
            reused: true,
          },
        );
        callback({ ok: true, launchCapability: session.launchCapability });
        return;
      }
      if (
        !launchAvailability.ok &&
        (launchAvailability.reason === "ROOM_CLOSING" ||
          launchAvailability.reason === "ROOM_TORN_DOWN")
      ) {
        logHostEvent(
          "warn",
          AIRJAM_DEV_LOG_EVENTS.system.launchGameRejected,
          "Rejected game launch because room is closing",
          {
            roomId,
            gameId,
            reason: "room_closing",
          },
        );
        callback({
          ok: false,
          message: "Room is closing",
          code: ErrorCode.CONNECTION_FAILED,
        });
        return;
      }

      const launchCapability = issueChildHostCapability(uuidv4());
      const transitionResult = beginGameLaunch(
        session,
        launchCapability,
        gameId,
      );
      if (!transitionResult.ok) {
        logHostEvent(
          "warn",
          AIRJAM_DEV_LOG_EVENTS.system.launchGameRejected,
          "Rejected game launch due to invalid lifecycle state",
          {
            roomId,
            gameId,
            reason: "invalid_lifecycle_state",
          },
        );
        callback({
          ok: false,
          message: "Unable to launch game from current room state",
          code: ErrorCode.CONNECTION_FAILED,
        });
        return;
      }

      logHostEvent(
        "info",
        AIRJAM_DEV_LOG_EVENTS.system.launchGameAccepted,
        "Issued game launch capability",
        {
          roomId,
          gameId,
          reused: false,
        },
      );
      runtimeUsagePublisher.publish(
        createRoomRuntimeUsageEvent(session, {
          kind: "game_launch_started",
          gameId,
        }),
      );
      callback({ ok: true, launchCapability });
    },
  );

  socket.on("host:joinAsChild", (payload: HostJoinAsChildPayload, callback) => {
    const parsed = hostJoinAsChildSchema.safeParse(payload);
    if (!parsed.success) {
      logHostEvent(
        "warn",
        AIRJAM_DEV_LOG_EVENTS.childHost.joinRejected,
        "Rejected child host join with invalid payload",
        {
          reason: "invalid_payload",
          issues: parsed.error.issues,
        },
      );
      callback({
        ok: false,
        message: parsed.error.message,
        code: ErrorCode.INVALID_PAYLOAD,
      });
      return;
    }

    const { roomId, capabilityToken } = parsed.data;
    const session = roomManager.getRoom(roomId);
    if (!session) {
      logHostEvent(
        "warn",
        AIRJAM_DEV_LOG_EVENTS.childHost.joinRejected,
        "Rejected child host join because room was not found",
        {
          roomId,
          reason: "room_not_found",
        },
      );
      callback({
        ok: false,
        message: "Room not found",
        code: ErrorCode.ROOM_NOT_FOUND,
      });
      return;
    }

    if (!session.launchCapability) {
      logHostEvent(
        "warn",
        AIRJAM_DEV_LOG_EVENTS.childHost.joinRejected,
        "Rejected child host join because launch capability is missing",
        {
          roomId,
          reason: "launch_capability_missing",
        },
      );
      callback({
        ok: false,
        message: "Launch capability missing",
        code: ErrorCode.INVALID_TOKEN,
      });
      return;
    }
    if (isChildHostCapabilityExpired(session.launchCapability)) {
      logHostEvent(
        "warn",
        AIRJAM_DEV_LOG_EVENTS.childHost.joinRejected,
        "Rejected child host join because launch capability expired",
        {
          roomId,
          reason: "launch_capability_expired",
        },
      );
      callback({
        ok: false,
        message: "Launch capability expired",
        code: ErrorCode.TOKEN_EXPIRED,
      });
      return;
    }
    if (session.launchCapability.token !== capabilityToken) {
      logHostEvent(
        "warn",
        AIRJAM_DEV_LOG_EVENTS.childHost.joinRejected,
        "Rejected child host join because capability token was invalid",
        {
          roomId,
          reason: "invalid_capability_token",
        },
      );
      callback({
        ok: false,
        message: "Invalid launch capability",
        code: ErrorCode.INVALID_TOKEN,
      });
      return;
    }

    const phase = getRoomLifecyclePhase(session);
    if (
      phase === "GAME_ACTIVE" &&
      session.launchCapability.token === capabilityToken
    ) {
      const hasLiveChild =
        session.childHostSocketId &&
        io.sockets.sockets.get(session.childHostSocketId)?.connected;
      if (!hasLiveChild) {
        if (session.pendingChildTeardownTimer) {
          clearTimeout(session.pendingChildTeardownTimer);
          session.pendingChildTeardownTimer = undefined;
        }
        if (session.childHostSocketId) {
          roomManager.deleteHost(session.childHostSocketId);
        }
        activateChildHost(session, socket.id);
        roomManager.setHostRoom(socket.id, roomId);
        socket.join(roomId);

        logHostEvent(
          "info",
          AIRJAM_DEV_LOG_EVENTS.childHost.joinAccepted,
          "Child host rejoined active game after disconnect",
          {
            roomId,
            resumed: true,
          },
        );
        setTimeout(() => {
          session.controllers.forEach((controller) => {
            socket.emit(
              "server:controllerJoined",
              toControllerJoinedNotice(controller),
            );
          });

          socket.emit("server:state", {
            roomId,
            state: {
              gameState: session.gameState,
              orientation: session.controllerOrientation,
            },
          });
        }, 100);

        callback({ ok: true, roomId });
        return;
      }

      callback({
        ok: false,
        message: "Game already active",
        code: ErrorCode.ALREADY_CONNECTED,
      });
      logHostEvent(
        "warn",
        AIRJAM_DEV_LOG_EVENTS.childHost.joinRejected,
        "Rejected child host join because an active child host is already connected",
        {
          roomId,
          reason: "active_child_host_exists",
        },
      );
      return;
    }

    const activationAvailability = beginChildHostActivation(session, socket.id);
    if (
      !activationAvailability.ok &&
      activationAvailability.reason === "GAME_ACTIVE"
    ) {
      logHostEvent(
        "warn",
        AIRJAM_DEV_LOG_EVENTS.childHost.joinRejected,
        "Rejected child host join because game is already active",
        {
          roomId,
          reason: "game_active",
        },
      );
      callback({
        ok: false,
        message: "Game already active",
        code: ErrorCode.ALREADY_CONNECTED,
      });
      return;
    }
    if (
      !activationAvailability.ok &&
      activationAvailability.reason === "NO_LAUNCH_PENDING"
    ) {
      logHostEvent(
        "warn",
        AIRJAM_DEV_LOG_EVENTS.childHost.joinRejected,
        "Rejected child host join because launch is not pending",
        {
          roomId,
          reason: "launch_not_pending",
        },
      );
      callback({
        ok: false,
        message: "Launch not pending",
        code: ErrorCode.CONNECTION_FAILED,
      });
      return;
    }
    if (
      !activationAvailability.ok &&
      (activationAvailability.reason === "ROOM_CLOSING" ||
        activationAvailability.reason === "ROOM_TORN_DOWN")
    ) {
      logHostEvent(
        "warn",
        AIRJAM_DEV_LOG_EVENTS.childHost.joinRejected,
        "Rejected child host join because room is closing",
        {
          roomId,
          reason: "room_closing",
        },
      );
      callback({
        ok: false,
        message: "Room is closing",
        code: ErrorCode.CONNECTION_FAILED,
      });
      return;
    }

    roomManager.setHostRoom(socket.id, roomId);
    socket.join(roomId);

    logHostEvent("info", AIRJAM_DEV_LOG_EVENTS.childHost.joinAccepted, "Child host joined pending launch", {
      roomId,
      resumed: false,
    });
    runtimeUsagePublisher.publish(
      createRoomRuntimeUsageEvent(session, {
        kind: "game_became_active",
        payload: {
          activation: "child_host_join",
        },
      }),
    );
    setTimeout(() => {
      session.controllers.forEach((controller) => {
        socket.emit(
          "server:controllerJoined",
          toControllerJoinedNotice(controller),
        );
      });

      socket.emit("server:state", {
        roomId,
        state: {
          gameState: session.gameState,
          orientation: session.controllerOrientation,
        },
      });
    }, 100);

    callback({ ok: true, roomId });
  });

  socket.on(
    "host:activateEmbeddedGame",
    (
      payload: HostActivateEmbeddedGamePayload,
      callback: (ack: HostRegistrationAck) => void,
    ) => {
      const parsed = hostActivateEmbeddedGameSchema.safeParse(payload);
      if (!parsed.success) {
        logHostEvent(
          "warn",
          AIRJAM_DEV_LOG_EVENTS.embeddedGame.activateRejected,
          "Rejected embedded game activation with invalid payload",
          {
            reason: "invalid_payload",
            issues: parsed.error.issues,
          },
        );
        callback({
          ok: false,
          message: parsed.error.message,
          code: ErrorCode.INVALID_PAYLOAD,
        });
        return;
      }

      const { roomId, capabilityToken } = parsed.data;
      const session = roomManager.getRoom(roomId);
      if (!session) {
        logHostEvent(
          "warn",
          AIRJAM_DEV_LOG_EVENTS.embeddedGame.activateRejected,
          "Rejected embedded game activation because room was not found",
          {
            roomId,
            reason: "room_not_found",
          },
        );
        callback({
          ok: false,
          message: "Room not found",
          code: ErrorCode.ROOM_NOT_FOUND,
        });
        return;
      }

      if (session.masterHostSocketId !== socket.id) {
        logHostEvent(
          "warn",
          AIRJAM_DEV_LOG_EVENTS.embeddedGame.activateRejected,
          "Rejected embedded game activation from non-system host",
          {
            roomId,
            reason: "unauthorized",
          },
        );
        callback({
          ok: false,
          message: "Unauthorized: Not System Host",
          code: ErrorCode.UNAUTHORIZED,
        });
        return;
      }

      if (!session.launchCapability) {
        logHostEvent(
          "warn",
          AIRJAM_DEV_LOG_EVENTS.embeddedGame.activateRejected,
          "Rejected embedded game activation because launch capability is missing",
          {
            roomId,
            reason: "launch_capability_missing",
          },
        );
        callback({
          ok: false,
          message: "Launch capability missing",
          code: ErrorCode.INVALID_TOKEN,
        });
        return;
      }
      if (isChildHostCapabilityExpired(session.launchCapability)) {
        logHostEvent(
          "warn",
          AIRJAM_DEV_LOG_EVENTS.embeddedGame.activateRejected,
          "Rejected embedded game activation because launch capability expired",
          {
            roomId,
            reason: "launch_capability_expired",
          },
        );
        callback({
          ok: false,
          message: "Launch capability expired",
          code: ErrorCode.TOKEN_EXPIRED,
        });
        return;
      }
      if (session.launchCapability.token !== capabilityToken) {
        logHostEvent(
          "warn",
          AIRJAM_DEV_LOG_EVENTS.embeddedGame.activateRejected,
          "Rejected embedded game activation because capability token was invalid",
          {
            roomId,
            reason: "invalid_capability_token",
          },
        );
        callback({
          ok: false,
          message: "Invalid launch capability",
          code: ErrorCode.INVALID_TOKEN,
        });
        return;
      }

      const phase = getRoomLifecyclePhase(session);
      if (phase === "GAME_ACTIVE" && session.focus === "GAME") {
        logHostEvent(
          "info",
          AIRJAM_DEV_LOG_EVENTS.embeddedGame.activateAccepted,
          "Embedded game activation acknowledged for already-active game",
          {
            roomId,
            alreadyActive: true,
          },
        );
        callback({ ok: true, roomId });
        return;
      }

      if (phase !== "GAME_LAUNCH_PENDING") {
        logHostEvent(
          "warn",
          AIRJAM_DEV_LOG_EVENTS.embeddedGame.activateRejected,
          "Rejected embedded game activation because launch is not pending",
          {
            roomId,
            reason: "launch_not_pending",
          },
        );
        callback({
          ok: false,
          message: "Launch not pending",
          code: ErrorCode.CONNECTION_FAILED,
        });
        return;
      }

      if (session.pendingChildTeardownTimer) {
        clearTimeout(session.pendingChildTeardownTimer);
        session.pendingChildTeardownTimer = undefined;
      }

      activateEmbeddedGame(session);
      logHostEvent("info", AIRJAM_DEV_LOG_EVENTS.embeddedGame.activateAccepted, "Embedded game activated", {
        roomId,
        alreadyActive: false,
      });
      runtimeUsagePublisher.publish(
        createRoomRuntimeUsageEvent(session, {
          kind: "game_became_active",
          payload: {
            activation: "embedded_game_activate",
          },
        }),
      );
      callback({ ok: true, roomId });
    },
  );

  socket.on("system:closeGame", (payload: { roomId: string }) => {
    const { roomId } = payload;
    const session = roomManager.getRoom(roomId);
    if (!session || session.masterHostSocketId !== socket.id) {
      logHostEvent(
        "warn",
        AIRJAM_DEV_LOG_EVENTS.system.closeGameRejected,
        "Ignored closeGame from non-system host or missing room",
        {
          roomId,
          reason: "unauthorized_or_room_missing",
        },
      );
      return;
    }

    const previousGameId = session.activeGameId;
    beginRoomClosing(session);
    disconnectChildHostIfPresent(io, session);
    transitionToSystemFocus(io, session, {
      resyncPlayersToMaster: true,
    });
    logHostEvent(
      "info",
      AIRJAM_DEV_LOG_EVENTS.system.closeGameAccepted,
      "Closed active game and returned room to system focus",
      {
        roomId,
      },
    );
    runtimeUsagePublisher.publish(
      createRoomRuntimeUsageEvent(session, {
        kind: "game_returned_to_system",
        gameId: previousGameId,
        payload: {
          reason: "system_close_game",
        },
      }),
    );
  });
};

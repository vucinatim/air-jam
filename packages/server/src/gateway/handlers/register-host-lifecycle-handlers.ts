import {
  ErrorCode,
  hostActivateEmbeddedGameSchema,
  hostBootstrapSchema,
  hostCreateRoomSchema,
  hostJoinAsChildSchema,
  hostReconnectSchema,
  hostRegisterSystemSchema,
  systemLaunchGameSchema,
  type HostActivateEmbeddedGamePayload,
  type HostBootstrapAck,
  type HostBootstrapPayload,
  type HostCreateRoomPayload,
  type HostJoinAsChildPayload,
  type HostReconnectPayload,
  type HostRegisterSystemPayload,
  type SystemLaunchGamePayload,
} from "@air-jam/sdk/protocol";
import { v4 as uuidv4 } from "uuid";
import { redactIdentifier } from "../../logging/logger.js";
import {
  activateChildHost,
  activateEmbeddedGame,
  beginChildHostActivation,
  beginGameLaunch,
  beginRoomClosing,
  buildArcadeSessionForHostAck,
  canBeginGameLaunch,
  disconnectChildHostIfPresent,
  getRoomLifecyclePhase,
  isChildHostCapabilityExpired,
  issueChildHostCapability,
  toControllerJoinedNotice,
  transitionToSystemFocus,
} from "../../domain/room-session-domain.js";
import type { HostArcadeSessionSnapshot } from "@air-jam/sdk/protocol";
import type { RoomSession } from "../../types.js";
import { generateRoomCode } from "../../utils/ids.js";
import type { SocketHandlerContext } from "../socket-handler-context.js";

type HostAck = {
  ok: boolean;
  roomId?: string;
  message?: string;
  code?: ErrorCode | string;
  arcadeSession?: HostArcadeSessionSnapshot;
};

export const registerHostLifecycleHandlers = (
  context: SocketHandlerContext,
): void => {
  const { io, socket, roomManager, authService, logger } = context;
  const requestOrigin =
    typeof socket.handshake.headers.origin === "string"
      ? socket.handshake.headers.origin
      : undefined;

  const bindHostAuthority = (
    appId?: string,
    verifiedVia?: "appId" | "hostGrant",
    verifiedOrigin?: string,
  ): string => {
    const traceId = `host_${uuidv4().replace(/-/g, "").slice(0, 12)}`;
    socket.data.hostAuthority = {
      appId,
      traceId,
      verifiedAt: Date.now(),
      verifiedVia,
      verifiedOrigin,
    };
    return traceId;
  };

  const getHostLogger = () => {
    const traceId = socket.data.hostAuthority?.traceId;
    return traceId ? logger.child({ traceId }) : logger;
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
    callback: (ack: HostAck) => void,
  ): boolean => {
    if (socket.data.hostAuthority) {
      return true;
    }

    logger.warn({ eventName }, "Rejected host lifecycle event before bootstrap");
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
        logger.warn("Rejected host bootstrap due to socket rate limit");
        callback({
          ok: false,
          message: "Too many host registration attempts. Please try again.",
          code: ErrorCode.SERVICE_UNAVAILABLE,
        });
        return;
      }

      const parsed = hostBootstrapSchema.safeParse(payload);
      if (!parsed.success) {
        logger.warn({ issues: parsed.error.issues }, "Rejected host bootstrap with invalid payload");
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
        logger.warn(
          {
            reason: verification.error,
            appIdHint: redactIdentifier(parsed.data.appId),
            hasHostGrant: Boolean(parsed.data.hostGrant),
          },
          "Rejected host bootstrap",
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
        logger.warn(
          {
            appIdHint: redactIdentifier(verification.appId),
            verifiedOrigin: verification.verifiedOrigin,
          },
          "Rejected host bootstrap due to static app quota",
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
        verification.verifiedVia,
        verification.verifiedOrigin,
      );
      getHostLogger().info(
        {
          verifiedVia: verification.verifiedVia,
          appIdHint: redactIdentifier(verification.appId),
          verifiedOrigin: verification.verifiedOrigin,
        },
        "Host bootstrap verified",
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
        logger.warn("Rejected host registerSystem due to socket rate limit");
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
        getHostLogger().warn("Rejected host registerSystem due to static app quota");
        callback({
          ok: false,
          message: "Too many host lifecycle attempts for this app. Please try again.",
          code: ErrorCode.SERVICE_UNAVAILABLE,
        });
        return;
      }

      const parsed = hostRegisterSystemSchema.safeParse(payload);
      if (!parsed.success) {
        getHostLogger().warn({ issues: parsed.error.issues }, "Rejected host registerSystem with invalid payload");
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
        roomManager.setRoom(roomId, session);
      } else {
        session = {
          roomId,
          masterHostSocketId: socket.id,
          focus: "SYSTEM",
          controllers: new Map(),
          maxPlayers: 32,
          gameState: "paused",
          controllerOrientation: "portrait",
          lifecycleState: "SYSTEM_IDLE",
        };
        roomManager.setRoom(roomId, session);
      }

      roomManager.setHostRoom(socket.id, roomId);
      socket.join(roomId);

      getHostLogger().info({ roomId }, "Host registered as system host");
      callback({ ok: true, roomId });
      io.to(roomId).emit("server:roomReady", { roomId });
    },
  );

  socket.on(
    "host:createRoom",
    async (
      payload: HostCreateRoomPayload,
      callback: (ack: HostAck) => void,
    ) => {
      if (
        context.isRateLimited(
          "host-registration",
          context.hostRegistrationRateLimitMax,
        )
      ) {
        logger.warn("Rejected host createRoom due to socket rate limit");
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
        getHostLogger().warn("Rejected host createRoom due to static app quota");
        callback({
          ok: false,
          message: "Too many host lifecycle attempts for this app. Please try again.",
          code: ErrorCode.SERVICE_UNAVAILABLE,
        });
        return;
      }

      const parsed = hostCreateRoomSchema.safeParse(payload);
      if (!parsed.success) {
        getHostLogger().warn({ issues: parsed.error.issues }, "Rejected host createRoom with invalid payload");
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
          getHostLogger().info({ roomId: existingRoomId }, "Host createRoom reused existing room");
          callback({ ok: true, roomId: existingRoomId });
          return;
        }
      }

      let roomId: string;
      let attempts = 0;
      do {
        roomId = generateRoomCode();
        attempts += 1;
        if (attempts > 10) {
          callback({
            ok: false,
            message: "Failed to generate unique room ID",
            code: ErrorCode.CONNECTION_FAILED,
          });
          return;
        }
      } while (roomManager.getRoom(roomId));

      const session: RoomSession = {
        roomId,
        masterHostSocketId: socket.id,
        focus: "SYSTEM",
        controllers: new Map(),
        maxPlayers: maxPlayers ?? 8,
        gameState: "paused",
        controllerOrientation: "portrait",
        lifecycleState: "SYSTEM_IDLE",
      };

      roomManager.setRoom(roomId, session);
      roomManager.setHostRoom(socket.id, roomId);
      socket.join(roomId);

      getHostLogger().info({ roomId, maxPlayers }, "Host created room");
      callback({ ok: true, roomId });
      io.to(roomId).emit("server:roomReady", { roomId });
    },
  );

  socket.on(
    "host:reconnect",
    async (payload: HostReconnectPayload, callback: (ack: HostAck) => void) => {
      if (
        context.isRateLimited(
          "host-registration",
          context.hostRegistrationRateLimitMax,
        )
      ) {
        logger.warn("Rejected host reconnect due to socket rate limit");
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
        getHostLogger().warn("Rejected host reconnect due to static app quota");
        callback({
          ok: false,
          message: "Too many host lifecycle attempts for this app. Please try again.",
          code: ErrorCode.SERVICE_UNAVAILABLE,
        });
        return;
      }

      const parsed = hostReconnectSchema.safeParse(payload);
      if (!parsed.success) {
        getHostLogger().warn({ issues: parsed.error.issues }, "Rejected host reconnect with invalid payload");
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
        getHostLogger().warn({ roomId }, "Rejected host reconnect because room was not found");
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
        session.masterHostSocketId = socket.id;
        roomManager.setRoom(roomId, session);
        roomManager.setHostRoom(socket.id, roomId);
        socket.join(roomId);

        getHostLogger().info({ roomId }, "Host reconnected to room");
        callback({
          ok: true,
          roomId,
          arcadeSession: buildArcadeSessionForHostAck(session, uuidv4),
        });
        io.to(roomId).emit("server:roomReady", { roomId });
      } else {
        getHostLogger().warn({ roomId }, "Rejected host reconnect because another active host owns the room");
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
        getHostLogger().warn({ roomId, gameId }, "Rejected game launch because room was not found");
        callback({
          ok: false,
          message: "Room not found",
          code: ErrorCode.ROOM_NOT_FOUND,
        });
        return;
      }

      if (session.masterHostSocketId !== socket.id) {
        getHostLogger().warn({ roomId, gameId }, "Rejected game launch from non-system host");
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
        getHostLogger().warn({ roomId, gameId }, "Rejected game launch because a game is already active");
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
        getHostLogger().info({ roomId, gameId }, "Reused pending launch capability");
        callback({ ok: true, launchCapability: session.launchCapability });
        return;
      }
      if (
        !launchAvailability.ok &&
        (launchAvailability.reason === "ROOM_CLOSING" ||
          launchAvailability.reason === "ROOM_TORN_DOWN")
      ) {
        getHostLogger().warn({ roomId, gameId }, "Rejected game launch because room is closing");
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
        getHostLogger().warn({ roomId, gameId }, "Rejected game launch due to invalid lifecycle state");
        callback({
          ok: false,
          message: "Unable to launch game from current room state",
          code: ErrorCode.CONNECTION_FAILED,
        });
        return;
      }

      getHostLogger().info({ roomId, gameId }, "Issued game launch capability");
      callback({ ok: true, launchCapability });
    },
  );

  socket.on("host:joinAsChild", (payload: HostJoinAsChildPayload, callback) => {
    const parsed = hostJoinAsChildSchema.safeParse(payload);
    if (!parsed.success) {
      getHostLogger().warn({ issues: parsed.error.issues }, "Rejected child host join with invalid payload");
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
      getHostLogger().warn({ roomId }, "Rejected child host join because room was not found");
      callback({
        ok: false,
        message: "Room not found",
        code: ErrorCode.ROOM_NOT_FOUND,
      });
      return;
    }

    if (!session.launchCapability) {
      getHostLogger().warn({ roomId }, "Rejected child host join because launch capability is missing");
      callback({
        ok: false,
        message: "Launch capability missing",
        code: ErrorCode.INVALID_TOKEN,
      });
      return;
    }
    if (isChildHostCapabilityExpired(session.launchCapability)) {
      getHostLogger().warn({ roomId }, "Rejected child host join because launch capability expired");
      callback({
        ok: false,
        message: "Launch capability expired",
        code: ErrorCode.TOKEN_EXPIRED,
      });
      return;
    }
    if (session.launchCapability.token !== capabilityToken) {
      getHostLogger().warn({ roomId }, "Rejected child host join because capability token was invalid");
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

        getHostLogger().info({ roomId }, "Child host rejoined active game after disconnect");
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
      getHostLogger().warn({ roomId }, "Rejected child host join because an active child host is already connected");
      return;
    }

    const activationAvailability = beginChildHostActivation(session, socket.id);
    if (
      !activationAvailability.ok &&
      activationAvailability.reason === "GAME_ACTIVE"
    ) {
      getHostLogger().warn({ roomId }, "Rejected child host join because game is already active");
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
      getHostLogger().warn({ roomId }, "Rejected child host join because launch is not pending");
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
      getHostLogger().warn({ roomId }, "Rejected child host join because room is closing");
      callback({
        ok: false,
        message: "Room is closing",
        code: ErrorCode.CONNECTION_FAILED,
      });
      return;
    }

    roomManager.setHostRoom(socket.id, roomId);
    socket.join(roomId);

    getHostLogger().info({ roomId }, "Child host joined pending launch");
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
      callback: (ack: HostAck) => void,
    ) => {
      const parsed = hostActivateEmbeddedGameSchema.safeParse(payload);
      if (!parsed.success) {
        getHostLogger().warn({ issues: parsed.error.issues }, "Rejected embedded game activation with invalid payload");
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
        getHostLogger().warn({ roomId }, "Rejected embedded game activation because room was not found");
        callback({
          ok: false,
          message: "Room not found",
          code: ErrorCode.ROOM_NOT_FOUND,
        });
        return;
      }

      if (session.masterHostSocketId !== socket.id) {
        getHostLogger().warn({ roomId }, "Rejected embedded game activation from non-system host");
        callback({
          ok: false,
          message: "Unauthorized: Not System Host",
          code: ErrorCode.UNAUTHORIZED,
        });
        return;
      }

      if (!session.launchCapability) {
        getHostLogger().warn({ roomId }, "Rejected embedded game activation because launch capability is missing");
        callback({
          ok: false,
          message: "Launch capability missing",
          code: ErrorCode.INVALID_TOKEN,
        });
        return;
      }
      if (isChildHostCapabilityExpired(session.launchCapability)) {
        getHostLogger().warn({ roomId }, "Rejected embedded game activation because launch capability expired");
        callback({
          ok: false,
          message: "Launch capability expired",
          code: ErrorCode.TOKEN_EXPIRED,
        });
        return;
      }
      if (session.launchCapability.token !== capabilityToken) {
        getHostLogger().warn({ roomId }, "Rejected embedded game activation because capability token was invalid");
        callback({
          ok: false,
          message: "Invalid launch capability",
          code: ErrorCode.INVALID_TOKEN,
        });
        return;
      }

      const phase = getRoomLifecyclePhase(session);
      if (phase === "GAME_ACTIVE" && session.focus === "GAME") {
        getHostLogger().info({ roomId }, "Embedded game activation acknowledged for already-active game");
        callback({ ok: true, roomId });
        return;
      }

      if (phase !== "GAME_LAUNCH_PENDING") {
        getHostLogger().warn({ roomId }, "Rejected embedded game activation because launch is not pending");
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
      getHostLogger().info({ roomId }, "Embedded game activated");
      callback({ ok: true, roomId });
    },
  );

  socket.on("system:closeGame", (payload: { roomId: string }) => {
    const { roomId } = payload;
    const session = roomManager.getRoom(roomId);
    if (!session || session.masterHostSocketId !== socket.id) {
      getHostLogger().warn({ roomId }, "Ignored closeGame from non-system host or missing room");
      return;
    }

    beginRoomClosing(session);
    disconnectChildHostIfPresent(io, session);
    transitionToSystemFocus(io, session, {
      resyncPlayersToMaster: true,
    });
    getHostLogger().info({ roomId }, "Closed active game and returned room to system focus");
  });
};

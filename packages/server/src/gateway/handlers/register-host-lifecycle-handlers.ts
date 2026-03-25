import {
  ErrorCode,
  hostActivateEmbeddedGameSchema,
  hostCreateRoomSchema,
  hostJoinAsChildSchema,
  hostReconnectSchema,
  hostRegisterSystemSchema,
  systemLaunchGameSchema,
  type HostActivateEmbeddedGamePayload,
  type HostCreateRoomPayload,
  type HostJoinAsChildPayload,
  type HostReconnectPayload,
  type HostRegisterSystemPayload,
  type SystemLaunchGamePayload,
} from "@air-jam/sdk/protocol";
import { v4 as uuidv4 } from "uuid";
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
  const { io, socket, roomManager, authService } = context;

  socket.on(
    "host:registerSystem",
    async (payload: HostRegisterSystemPayload, callback) => {
      if (
        context.isRateLimited(
          "host-registration",
          context.hostRegistrationRateLimitMax,
        )
      ) {
        callback({
          ok: false,
          message: "Too many host registration attempts. Please try again.",
          code: ErrorCode.SERVICE_UNAVAILABLE,
        });
        return;
      }

      const parsed = hostRegisterSystemSchema.safeParse(payload);
      if (!parsed.success) {
        callback({
          ok: false,
          message: parsed.error.message,
          code: ErrorCode.INVALID_PAYLOAD,
        });
        return;
      }

      const { roomId, apiKey } = parsed.data;
      const verification = await authService.verifyApiKey(apiKey);
      if (!verification.isVerified) {
        console.warn(
          `[server] Unauthorized host registration attempt for room ${roomId}`,
        );
        callback({
          ok: false,
          message: verification.error,
          code: ErrorCode.INVALID_API_KEY,
        });
        return;
      }

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
        callback({
          ok: false,
          message: "Too many host registration attempts. Please try again.",
          code: ErrorCode.SERVICE_UNAVAILABLE,
        });
        return;
      }

      const parsed = hostCreateRoomSchema.safeParse(payload);
      if (!parsed.success) {
        callback({
          ok: false,
          message: parsed.error.message,
          code: ErrorCode.INVALID_PAYLOAD,
        });
        return;
      }

      const { maxPlayers, apiKey } = parsed.data;
      const verification = await authService.verifyApiKey(apiKey);
      if (!verification.isVerified) {
        callback({
          ok: false,
          message: verification.error,
          code: ErrorCode.INVALID_API_KEY,
        });
        return;
      }

      const existingRoomId = roomManager.getRoomByHostId(socket.id);
      if (existingRoomId) {
        const existingSession = roomManager.getRoom(existingRoomId);
        if (
          existingSession &&
          existingSession.masterHostSocketId === socket.id
        ) {
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
        callback({
          ok: false,
          message: "Too many host registration attempts. Please try again.",
          code: ErrorCode.SERVICE_UNAVAILABLE,
        });
        return;
      }

      const parsed = hostReconnectSchema.safeParse(payload);
      if (!parsed.success) {
        callback({
          ok: false,
          message: parsed.error.message,
          code: ErrorCode.INVALID_PAYLOAD,
        });
        return;
      }

      const { roomId, apiKey } = parsed.data;
      const verification = await authService.verifyApiKey(apiKey);
      if (!verification.isVerified) {
        callback({
          ok: false,
          message: verification.error,
          code: ErrorCode.INVALID_API_KEY,
        });
        return;
      }

      const session = roomManager.getRoom(roomId);
      if (!session) {
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

        callback({
          ok: true,
          roomId,
          arcadeSession: buildArcadeSessionForHostAck(session),
        });
        io.to(roomId).emit("server:roomReady", { roomId });
      } else {
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

      const { roomId, gameUrl, gameId } = parsed.data;
      const session = roomManager.getRoom(roomId);
      if (!session) {
        callback({
          ok: false,
          message: "Room not found",
          code: ErrorCode.ROOM_NOT_FOUND,
        });
        return;
      }

      if (session.masterHostSocketId !== socket.id) {
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
        session.joinToken
      ) {
        callback({ ok: true, joinToken: session.joinToken });
        return;
      }
      if (
        !launchAvailability.ok &&
        (launchAvailability.reason === "ROOM_CLOSING" ||
          launchAvailability.reason === "ROOM_TORN_DOWN")
      ) {
        callback({
          ok: false,
          message: "Room is closing",
          code: ErrorCode.CONNECTION_FAILED,
        });
        return;
      }

      const joinToken = uuidv4();
      const transitionResult = beginGameLaunch(session, joinToken, gameUrl, gameId);
      if (!transitionResult.ok) {
        callback({
          ok: false,
          message: "Unable to launch game from current room state",
          code: ErrorCode.CONNECTION_FAILED,
        });
        return;
      }

      io.to(roomId).emit("client:loadUi", { url: gameUrl });
      callback({ ok: true, joinToken });
    },
  );

  socket.on("host:joinAsChild", (payload: HostJoinAsChildPayload, callback) => {
    const parsed = hostJoinAsChildSchema.safeParse(payload);
    if (!parsed.success) {
      callback({
        ok: false,
        message: parsed.error.message,
        code: ErrorCode.INVALID_PAYLOAD,
      });
      return;
    }

    const { roomId, joinToken } = parsed.data;
    const session = roomManager.getRoom(roomId);
    if (!session) {
      callback({
        ok: false,
        message: "Room not found",
        code: ErrorCode.ROOM_NOT_FOUND,
      });
      return;
    }

    if (session.joinToken !== joinToken) {
      callback({
        ok: false,
        message: "Invalid Join Token",
        code: ErrorCode.INVALID_TOKEN,
      });
      return;
    }

    const phase = getRoomLifecyclePhase(session);
    if (phase === "GAME_ACTIVE" && session.joinToken === joinToken) {
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
      return;
    }

    const activationAvailability = beginChildHostActivation(session, socket.id);
    if (
      !activationAvailability.ok &&
      activationAvailability.reason === "GAME_ACTIVE"
    ) {
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
      callback({
        ok: false,
        message: "Room is closing",
        code: ErrorCode.CONNECTION_FAILED,
      });
      return;
    }

    roomManager.setHostRoom(socket.id, roomId);
    socket.join(roomId);

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
        callback({
          ok: false,
          message: parsed.error.message,
          code: ErrorCode.INVALID_PAYLOAD,
        });
        return;
      }

      const { roomId, joinToken } = parsed.data;
      const session = roomManager.getRoom(roomId);
      if (!session) {
        callback({
          ok: false,
          message: "Room not found",
          code: ErrorCode.ROOM_NOT_FOUND,
        });
        return;
      }

      if (session.masterHostSocketId !== socket.id) {
        callback({
          ok: false,
          message: "Unauthorized: Not System Host",
          code: ErrorCode.UNAUTHORIZED,
        });
        return;
      }

      if (session.joinToken !== joinToken) {
        callback({
          ok: false,
          message: "Invalid Join Token",
          code: ErrorCode.INVALID_TOKEN,
        });
        return;
      }

      const phase = getRoomLifecyclePhase(session);
      if (phase === "GAME_ACTIVE" && session.focus === "GAME") {
        callback({ ok: true, roomId });
        return;
      }

      if (phase !== "GAME_LAUNCH_PENDING") {
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
      callback({ ok: true, roomId });
    },
  );

  socket.on("system:closeGame", (payload: { roomId: string }) => {
    const { roomId } = payload;
    const session = roomManager.getRoom(roomId);
    if (!session || session.masterHostSocketId !== socket.id) {
      return;
    }

    beginRoomClosing(session);
    disconnectChildHostIfPresent(io, session);
    transitionToSystemFocus(io, roomId, session, {
      resyncPlayersToMaster: true,
    });
  });
};

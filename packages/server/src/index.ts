import {
  controllerInputSchema,
  controllerJoinSchema,
  controllerLeaveSchema,
  controllerStateSchema,
  controllerSystemSchema,
  ErrorCode,
  hostJoinAsChildSchema,
  hostRegisterSystemSchema,
  hostRegistrationSchema,
  PlaySoundEventPayload,
  systemLaunchGameSchema,
  type ClientToServerEvents,
  type ControllerInputEvent,
  type ControllerJoinedNotice,
  type ControllerJoinPayload,
  type ControllerLeavePayload,
  type ControllerLeftNotice,
  type ControllerStateMessage,
  type HostJoinAsChildPayload,
  type HostRegisterSystemPayload,
  type HostRegistrationPayload,
  type InterServerEvents,
  type PlayerProfile,
  type ServerErrorPayload,
  type ServerToClientEvents,
  type SocketData,
  type SystemLaunchGamePayload,
} from "@air-jam/sdk/protocol";
import Color from "color";
import cors from "cors";
import express from "express";
import { createServer } from "node:http";
import { Server, type Socket } from "socket.io";
import { v4 as uuidv4 } from "uuid";
import { authService } from "./services/auth-service.js";
import { roomManager } from "./services/room-manager.js";
import type { ControllerSession } from "./types.js";

const PORT = Number(process.env.PORT ?? 4000);

const app = express();
app.use(cors());
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
  cors: {
    origin: "*",
  },
  pingInterval: 2000,
  pingTimeout: 5000,
});

const emitError = (socketId: string, payload: ServerErrorPayload): void => {
  io.to(socketId).emit("server:error", payload);
};

io.on(
  "connection",
  (
    socket: Socket<
      ClientToServerEvents,
      ServerToClientEvents,
      InterServerEvents,
      SocketData
    >,
  ) => {
    // --- SYSTEM HOST REGISTRATION (Arcade) ---
    socket.on(
      "host:registerSystem",
      async (payload: HostRegisterSystemPayload, callback) => {
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

        // API Key Validation using authService
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
          // Reconnect logic for System Host
          console.log(
            `[server] System Host re-connected to room ${roomId} (Socket: ${socket.id})`,
          );
          session.masterHostSocketId = socket.id;
          roomManager.setRoom(roomId, session);
        } else {
          // Create new room
          console.log(
            `[server] Creating new room ${roomId} (Socket: ${socket.id})`,
          );
          session = {
            roomId,
            masterHostSocketId: socket.id,
            focus: "SYSTEM",
            controllers: new Map(),
            maxPlayers: 8, // Default
            gameState: "paused",
          };
          roomManager.setRoom(roomId, session);
        }

        roomManager.setHostRoom(socket.id, roomId);
        socket.join(roomId);

        callback({ ok: true, roomId });
        io.to(roomId).emit("server:roomReady", { roomId });
      },
    );

    // --- LAUNCH GAME (System -> Server) ---
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

        const { roomId, gameUrl } = parsed.data;
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

        // Generate Join Token
        const joinToken = uuidv4();
        session.joinToken = joinToken;
        session.activeControllerUrl = gameUrl; // Assuming gameUrl is base, logic might need refinement for controller specific URL

        console.log(
          `[server] Launching game in room ${roomId}. Token: ${joinToken}`,
        );

        // Broadcast to controllers to load UI
        // NOTE: In a real scenario, gameUrl might be different from controllerUrl.
        // For now, we assume the game handles the controller logic or we pass the game URL.
        // Ideally, the game manifest should provide the controller URL.
        // We will send the gameUrl for now.
        io.to(roomId).emit("client:loadUi", { url: gameUrl });

        callback({ ok: true, joinToken });
      },
    );

    // --- JOIN AS CHILD (Game -> Server) ---
    socket.on(
      "host:joinAsChild",
      (payload: HostJoinAsChildPayload, callback) => {
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
          console.warn(
            `[server] Invalid join token for room ${roomId}. Expected ${session.joinToken}, got ${joinToken}`,
          );
          callback({
            ok: false,
            message: "Invalid Join Token",
            code: ErrorCode.INVALID_TOKEN,
          });
          return;
        }

        console.log(
          `[server] Child Host joined room ${roomId} (Socket: ${socket.id})`,
        );
        session.childHostSocketId = socket.id;
        session.focus = "GAME"; // Auto-focus on join

        roomManager.setHostRoom(socket.id, roomId);
        socket.join(roomId);

        // Send initial state to the game
        console.log(
          `[server] Syncing ${session.controllers.size} players to Child Host`,
        );

        // Small delay to ensure client is ready to receive events after ack
        setTimeout(() => {
          session.controllers.forEach((c) => {
            const notice: ControllerJoinedNotice = {
              controllerId: c.controllerId,
              nickname: c.nickname,
              player: c.playerProfile,
            };
            socket.emit("server:controllerJoined", notice);
          });
        }, 100);

        callback({ ok: true, roomId });
      },
    );

    // --- CLOSE GAME (System -> Server) ---
    socket.on("system:closeGame", (payload: { roomId: string }) => {
      const { roomId } = payload;
      const session = roomManager.getRoom(roomId);
      if (!session) return;

      if (session.masterHostSocketId !== socket.id) return;

      console.log(`[server] System closing game in room ${roomId}`);
      session.focus = "SYSTEM";
      session.childHostSocketId = undefined;
      session.joinToken = undefined;
      session.activeControllerUrl = undefined;

      // Tell controllers to unload UI
      io.to(roomId).emit("client:unloadUi");

      // Tell child to close (if connected) - though usually this is called AFTER child disconnects or to force it.
      // If we have a child socket, we could disconnect it.
    });

    // --- LEGACY/STANDALONE HOST REGISTER ---
    // Keeping this for standalone development where there is no "System"
    socket.on(
      "host:register",
      async (payload: HostRegistrationPayload, callback) => {
        const parsed = hostRegistrationSchema.safeParse(payload);
        if (!parsed.success) {
          callback({
            ok: false,
            message: parsed.error.message,
            code: ErrorCode.INVALID_PAYLOAD,
          });
          return;
        }
        const { roomId, maxPlayers } = parsed.data;

        // If mode is 'child', we should redirect them to use host:join_as_child if possible,
        // but for standalone dev, they might use this.
        // For now, we treat 'host:register' as creating a STANDALONE room or joining as master.

        let session = roomManager.getRoom(roomId);
        if (session) {
          // If room exists, we assume they are taking over or reconnecting as Master
          session.masterHostSocketId = socket.id;
          session.focus = "SYSTEM"; // Default to system/master focus
        } else {
          session = {
            roomId,
            masterHostSocketId: socket.id,
            focus: "SYSTEM",
            controllers: new Map(),
            maxPlayers,
            gameState: "paused",
          };
          roomManager.setRoom(roomId, session);
        }

        roomManager.setHostRoom(socket.id, roomId);
        socket.join(roomId);
        callback({ ok: true, roomId });
        io.to(roomId).emit("server:roomReady", { roomId });
      },
    );

    socket.on("controller:join", (payload: ControllerJoinPayload, callback) => {
      const parsed = controllerJoinSchema.safeParse(payload);
      if (!parsed.success) {
        callback({
          ok: false,
          message: parsed.error.message,
          code: ErrorCode.INVALID_PAYLOAD,
        });
        return;
      }
      const { roomId, controllerId, nickname } = parsed.data;
      const session = roomManager.getRoom(roomId);
      if (!session) {
        callback({
          ok: false,
          message: "Room not found",
          code: ErrorCode.ROOM_NOT_FOUND,
        });
        emitError(socket.id, {
          code: ErrorCode.ROOM_NOT_FOUND,
          message: "Room not found",
        });
        return;
      }

      if (session.controllers.size >= session.maxPlayers) {
        callback({
          ok: false,
          message: "Room full",
          code: ErrorCode.ROOM_FULL,
        });
        emitError(socket.id, {
          code: ErrorCode.ROOM_FULL,
          message: "Room is full",
        });
        return;
      }

      const existing = session.controllers.get(controllerId);
      if (existing) {
        roomManager.deleteController(existing.socketId);
      }

      const PLAYER_COLORS = [
        "#38bdf8",
        "#a78bfa",
        "#f472b6",
        "#34d399",
        "#fbbf24",
        "#60a5fa",
        "#c084fc",
        "#fb7185",
        "#4ade80",
        "#f87171",
        "#22d3ee",
        "#a855f7",
        "#ec4899",
        "#10b981",
        "#f59e0b",
        "#3b82f6",
        "#8b5cf6",
        "#ef4444",
        "#14b8a6",
        "#f97316",
      ];
      const colorHex =
        PLAYER_COLORS[session.controllers.size % PLAYER_COLORS.length];

      let color: string;
      try {
        color = Color(colorHex).hex();
      } catch {
        color = Color("#38bdf8").hex();
      }

      const playerProfile: PlayerProfile = {
        id: controllerId,
        label: nickname ?? `Player ${session.controllers.size}`,
        color,
      };

      const controllerSession: ControllerSession = {
        controllerId,
        nickname,
        socketId: socket.id,
        playerProfile,
      };

      session.controllers.set(controllerId, controllerSession);
      roomManager.setController(socket.id, { roomId, controllerId });
      socket.join(roomId);

      const notice: ControllerJoinedNotice = {
        controllerId,
        nickname,
        player: playerProfile,
      };

      // Emit to Active Host based on Focus
      io.to(roomManager.getActiveHostId(session)).emit(
        "server:controllerJoined",
        notice,
      );

      callback({ ok: true, controllerId, roomId });

      const welcomePayload = {
        controllerId,
        roomId,
        player: playerProfile,
      };

      socket.emit("server:welcome", welcomePayload);
    });

    socket.on("controller:leave", (payload: ControllerLeavePayload) => {
      const parsed = controllerLeaveSchema.safeParse(payload);
      if (!parsed.success) {
        return;
      }
      const { roomId, controllerId } = parsed.data;
      const session = roomManager.getRoom(roomId);
      if (!session) {
        return;
      }
      session.controllers.delete(controllerId);
      roomManager.deleteController(socket.id);
      const notice: ControllerLeftNotice = { controllerId };
      io.to(roomManager.getActiveHostId(session)).emit(
        "server:controllerLeft",
        notice,
      );
      socket.leave(roomId);
    });

    socket.on("controller:input", (payload: ControllerInputEvent) => {
      // Validate roomId and controllerId, but accept arbitrary input structure
      const result = controllerInputSchema.safeParse(payload);
      if (!result.success) return;

      const { roomId } = result.data;
      const session = roomManager.getRoom(roomId);
      if (!session) {
        return;
      }

      // Route based on FOCUS - pass through arbitrary input to host
      const targetHostId = roomManager.getActiveHostId(session);
      if (targetHostId) {
        io.to(targetHostId).emit("server:input", result.data);
      }
    });

    socket.on("controller:system", (payload) => {
      const parsed = controllerSystemSchema.safeParse(payload);
      if (!parsed.success) {
        return;
      }

      const { roomId, command } = parsed.data;
      const session = roomManager.getRoom(roomId);
      if (!session) {
        return;
      }

      if (command === "exit") {
        // Controller wants to exit the game - close the game on the server
        console.log(`[server] Controller exit request in room ${roomId}`);

        // Update session state
        session.focus = "SYSTEM";
        session.childHostSocketId = undefined;
        session.joinToken = undefined;
        session.activeControllerUrl = undefined;
        session.gameState = "paused"; // Reset game state on exit

        // Tell all controllers to unload UI
        io.to(roomId).emit("client:unloadUi");

        // Tell the system host (arcade) to return to browser view
        if (session.masterHostSocketId) {
          io.to(session.masterHostSocketId).emit("server:closeChild");
        }
      } else if (command === "toggle_pause") {
        // Toggle game state
        session.gameState =
          session.gameState === "playing" ? "paused" : "playing";
        console.log(
          `[server] Toggled game state to ${session.gameState} in room ${roomId}`,
        );

        // Broadcast new state to Room (Host + Controllers)
        const statePayload = {
          roomId,
          state: {
            gameState: session.gameState,
          },
        };

        io.to(roomId).emit("server:state", statePayload);
      }
    });

    socket.on("host:state", (payload: ControllerStateMessage) => {
      const result = controllerStateSchema.safeParse(payload);
      if (!result.success) return;

      const { roomId, state } = result.data;
      const session = roomManager.getRoom(roomId);
      if (session) {
        // Sync state if provided
        if (state.gameState) {
          session.gameState = state.gameState;
        }

        session.controllers.forEach((c) => {
          io.to(c.socketId).emit("server:state", result.data);
        });

        // Also reflect back to host(s) if needed, but usually host knows its state.
        // However, if we have multiple hosts (system + child), maybe they need sync?
        // For now, assume host is authoritative for its own state changes.
      }
    });

    socket.on("host:play_sound", (payload: PlaySoundEventPayload) => {
      const { roomId, targetControllerId, soundId, volume, loop } = payload;
      const session = roomManager.getRoom(roomId);
      if (!session) return;

      const message = { id: soundId, volume, loop };

      if (targetControllerId) {
        const controller = session.controllers.get(targetControllerId);
        if (controller) {
          io.to(controller.socketId).emit("server:playSound", message);
        }
      } else {
        socket.to(roomId).emit("server:playSound", message);
      }
    });

    socket.on("controller:play_sound", (payload: PlaySoundEventPayload) => {
      const { roomId, soundId, volume, loop } = payload;
      const session = roomManager.getRoom(roomId);
      if (!session) return;

      io.to(roomManager.getActiveHostId(session)).emit("server:playSound", {
        id: soundId,
        volume,
        loop,
      });
    });

    socket.on("disconnect", () => {
      const roomId = roomManager.getRoomByHostId(socket.id);
      if (roomId) {
        const session = roomManager.getRoom(roomId);
        if (!session) {
          roomManager.deleteHost(socket.id);
          return;
        }

        if (socket.id === session.childHostSocketId) {
          // Child disconnected
          console.log(
            `[server] Child Host disconnected from room ${roomId}. Reverting focus to SYSTEM.`,
          );
          session.childHostSocketId = undefined;
          session.focus = "SYSTEM";
          session.joinToken = undefined;

          // Tell controllers to unload UI
          io.to(roomId).emit("client:unloadUi");
        } else if (socket.id === session.masterHostSocketId) {
          // Master disconnected
          console.log(
            `[server] Master Host disconnected from room ${roomId}. Starting grace period.`,
          );

          setTimeout(() => {
            const currentSession = roomManager.getRoom(roomId);
            if (
              currentSession &&
              currentSession.masterHostSocketId === socket.id
            ) {
              console.log(
                `[server] Grace period expired. Removing room ${roomId}.`,
              );
              roomManager.removeRoom(roomId, io, "Host disconnected");
            }
          }, 3000);
        }

        roomManager.deleteHost(socket.id);
        return;
      }

      const controller = roomManager.getControllerInfo(socket.id);
      if (controller) {
        const session = roomManager.getRoom(controller.roomId);
        if (session) {
          session.controllers.delete(controller.controllerId);
          const notice: ControllerLeftNotice = {
            controllerId: controller.controllerId,
          };
          io.to(roomManager.getActiveHostId(session)).emit(
            "server:controllerLeft",
            notice,
          );
        }
        roomManager.deleteController(socket.id);
      }
    });
  },
);

httpServer.listen(PORT, () => {
  console.log(`[air-jam] server listening on ${PORT}`);
});

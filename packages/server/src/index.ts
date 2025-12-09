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
  SignalPayload,
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
            maxPlayers: 32, // Default increased to 32 to allow for observers/queue
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
        console.log(
          `[server] ========== system:launchGame RECEIVED ==========`,
          {
            payload,
            socketId: socket.id,
          },
        );

        const parsed = systemLaunchGameSchema.safeParse(payload);
        if (!parsed.success) {
          console.log(
            `[server] system:launchGame - invalid payload`,
            parsed.error,
          );
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
          console.log(`[server] system:launchGame - room not found: ${roomId}`);
          callback({
            ok: false,
            message: "Room not found",
            code: ErrorCode.ROOM_NOT_FOUND,
          });
          return;
        }

        if (session.masterHostSocketId !== socket.id) {
          console.log(`[server] system:launchGame - unauthorized`, {
            masterHostSocketId: session.masterHostSocketId,
            currentSocketId: socket.id,
          });
          callback({
            ok: false,
            message: "Unauthorized: Not System Host",
            code: ErrorCode.UNAUTHORIZED,
          });
          return;
        }

        // Check if game is already active
        if (session.childHostSocketId) {
          console.log(
            `[server] ========== system:launchGame BLOCKED - game already active ==========`,
            {
              roomId,
              existingChildHost: session.childHostSocketId,
              existingJoinToken: session.joinToken,
              existingFocus: session.focus,
            },
          );
          callback({
            ok: false,
            message: "Game already active",
            code: ErrorCode.ALREADY_CONNECTED,
          });
          return;
        }

        // Generate Join Token
        const joinToken = uuidv4();
        session.joinToken = joinToken;
        session.activeControllerUrl = gameUrl;

        console.log(
          `[server] ========== Launching game in room ${roomId}. Token: ${joinToken} ==========`,
          {
            gameUrl,
            focus: session.focus,
          },
        );

        // Broadcast to controllers to load UI
        console.log(`[server] Emitting client:loadUi to room ${roomId}`, {
          url: gameUrl,
        });
        io.to(roomId).emit("client:loadUi", { url: gameUrl });

        callback({ ok: true, joinToken });
        console.log(
          `[server] ========== system:launchGame ACK SENT ==========`,
        );
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

          // Send current game state to the child host
          const statePayload = {
            roomId,
            state: {
              gameState: session.gameState,
            },
          };
          socket.emit("server:state", statePayload);
        }, 100);

        callback({ ok: true, roomId });
      },
    );

    // --- CLOSE GAME (System -> Server) ---
    socket.on("system:closeGame", (payload: { roomId: string }) => {
      const { roomId } = payload;
      console.log(`[server] ========== system:closeGame RECEIVED ==========`, {
        roomId,
        socketId: socket.id,
      });
      const session = roomManager.getRoom(roomId);
      if (!session) {
        console.log(`[server] system:closeGame - room not found: ${roomId}`);
        return;
      }

      if (session.masterHostSocketId !== socket.id) {
        console.log(`[server] system:closeGame - unauthorized`, {
          masterHostSocketId: session.masterHostSocketId,
          currentSocketId: socket.id,
        });
        return;
      }

      console.log(
        `[server] ========== System closing game in room ${roomId} ==========`,
        {
          childHostSocketId: session.childHostSocketId,
          joinToken: session.joinToken,
          focus: session.focus,
        },
      );

      // Disconnect child host if still connected
      if (session.childHostSocketId) {
        const childSocket = io.sockets.sockets.get(session.childHostSocketId);
        if (childSocket) {
          console.log(
            `[server] Disconnecting child host socket ${session.childHostSocketId}`,
          );
          childSocket.disconnect(true);
        } else {
          console.log(
            `[server] Child host socket ${session.childHostSocketId} not found`,
          );
        }
      }

      session.focus = "SYSTEM";
      session.childHostSocketId = undefined;
      session.joinToken = undefined;
      session.activeControllerUrl = undefined;

      // Tell controllers to unload UI
      console.log(`[server] Emitting client:unloadUi to room ${roomId}`);
      io.to(roomId).emit("client:unloadUi");

      console.log(`[server] ========== system:closeGame COMPLETE ==========`);
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
          console.log(
            `[server] Standalone Host re-connected to room ${roomId} (Socket: ${socket.id})`,
            {
              previousMasterHostSocketId: session.masterHostSocketId,
              childHostSocketId: session.childHostSocketId,
              focus: session.focus,
            },
          );
          session.masterHostSocketId = socket.id;
          session.focus = "SYSTEM"; // Default to system/master focus
        } else {
          console.log(
            `[server] Creating standalone room ${roomId} (Socket: ${socket.id})`,
            {
              maxPlayers,
            },
          );
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
        console.log(`[server] Standalone Host registered`, {
          roomId,
          socketId: socket.id,
          focus: session.focus,
          childHostSocketId: session.childHostSocketId,
        });
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

      // When a controller joins, we usually check maxPlayers.
      // However, for the ARCADE room, we want to allow MORE players than the game might support,
      // so they can queue up or watch.
      // But the current logic enforces `session.maxPlayers`.
      // If we want to allow "observers" or "queue", we should increase maxPlayers for the Arcade room itself.
      // The GAME itself (Child Host) might enforce its own player limit logic by ignoring inputs from extra players.

      // For now, let's keep the hard limit on the Room but maybe bump the default.
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

      // Send current game state to the new controller
      const statePayload = {
        roomId,
        state: {
          gameState: session.gameState,
        },
      };
      socket.emit("server:state", statePayload);

      // IMPORTANT: If a game is already active (activeControllerUrl set),
      // we must tell the new controller to load the game UI immediately.
      // We check activeControllerUrl instead of childHostSocketId because the game might be
      // in the process of loading (launched but not yet connected) or momentarily disconnected.
      if (session.activeControllerUrl) {
        console.log(
          `[server] Late joiner ${controllerId}: sending client:loadUi for existing game`,
          {
            url: session.activeControllerUrl,
            hasChildHost: !!session.childHostSocketId,
          },
        );
        socket.emit("client:loadUi", { url: session.activeControllerUrl });
      } else {
        console.log(
          `[server] Controller ${controllerId} joined room ${roomId} (No active game)`,
          {
            activeControllerUrl: session.activeControllerUrl,
            childHostSocketId: session.childHostSocketId,
          },
        );
      }
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
      if (!result.success) {
        console.log(
          `[server] controller:input - invalid payload:`,
          result.error,
        );
        return;
      }

      const { roomId, controllerId } = result.data;
      const session = roomManager.getRoom(roomId);
      if (!session) {
        console.log(`[server] controller:input - room not found: ${roomId}`);
        return;
      }

      // Route based on FOCUS - pass through arbitrary input to host
      const targetHostId = roomManager.getActiveHostId(session);
      console.log(`[server] controller:input - routing input`, {
        roomId,
        controllerId,
        focus: session.focus,
        masterHostSocketId: session.masterHostSocketId,
        childHostSocketId: session.childHostSocketId,
        targetHostId,
        input: result.data.input,
      });

      if (targetHostId) {
        io.to(targetHostId).emit("server:input", result.data);
        console.log(
          `[server] controller:input - emitted to host ${targetHostId}`,
        );
      } else {
        console.log(`[server] controller:input - no target host ID found!`);
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
        console.log(
          `[server] ========== Controller exit request in room ${roomId} ==========`,
          {
            childHostSocketId: session.childHostSocketId,
            joinToken: session.joinToken,
            focus: session.focus,
            masterHostSocketId: session.masterHostSocketId,
          },
        );

        // Disconnect child host if still connected
        if (session.childHostSocketId) {
          const childSocket = io.sockets.sockets.get(session.childHostSocketId);
          if (childSocket) {
            console.log(
              `[server] Disconnecting child host on controller exit: ${session.childHostSocketId}`,
            );
            childSocket.disconnect(true);
          }
        }

        // Update session state
        session.focus = "SYSTEM";
        session.childHostSocketId = undefined;
        session.joinToken = undefined;
        session.activeControllerUrl = undefined;
        session.gameState = "paused"; // Reset game state on exit

        // Tell all controllers to unload UI
        console.log(
          `[server] Emitting client:unloadUi to room ${roomId} (controller exit)`,
        );
        io.to(roomId).emit("client:unloadUi");

        // Tell the system host (arcade) to return to browser view
        if (session.masterHostSocketId) {
          console.log(
            `[server] Emitting server:closeChild to master host ${session.masterHostSocketId}`,
          );
          io.to(session.masterHostSocketId).emit("server:closeChild");
        }

        console.log(
          `[server] ========== Controller exit handling COMPLETE ==========`,
        );
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

    socket.on("host:system", (payload) => {
      const parsed = controllerSystemSchema.safeParse(payload);
      if (!parsed.success) {
        return;
      }

      const { roomId, command } = parsed.data;
      const session = roomManager.getRoom(roomId);
      if (!session) {
        return;
      }

      if (command === "toggle_pause") {
        // Toggle game state - server is source of truth
        session.gameState =
          session.gameState === "playing" ? "paused" : "playing";
        console.log(
          `[server] Host toggled game state to ${session.gameState} in room ${roomId}`,
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

        // Broadcast to all controllers
        session.controllers.forEach((c) => {
          io.to(c.socketId).emit("server:state", result.data);
        });

        // Broadcast to all hosts (system + child) to keep them in sync
        if (session.masterHostSocketId) {
          io.to(session.masterHostSocketId).emit("server:state", result.data);
        }
        if (session.childHostSocketId) {
          io.to(session.childHostSocketId).emit("server:state", result.data);
        }
      }
    });

    socket.on("host:signal", (payload: SignalPayload) => {
      const roomId = roomManager.getRoomByHostId(socket.id);
      if (!roomId) return;

      const session = roomManager.getRoom(roomId);
      if (!session) return;

      if (payload.targetId) {
        const controller = session.controllers.get(payload.targetId);
        if (controller) {
          io.to(controller.socketId).emit("server:signal", payload);
        }
      } else {
        socket.to(roomId).emit("server:signal", payload);
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
          session.activeControllerUrl = undefined; // Clear active game URL

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

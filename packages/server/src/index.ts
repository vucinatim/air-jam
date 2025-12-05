import express from "express";
import cors from "cors";
import { createServer } from "node:http";
import { Server, type Socket } from "socket.io";
import Color from "color";
import { db, apiKeys } from "./db.js";
import { eq, and } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import {
  controllerInputSchema,
  controllerJoinSchema,
  controllerLeaveSchema,
  controllerStateSchema,
  hostRegistrationSchema,
  hostRegisterSystemSchema,
  systemLaunchGameSchema,
  hostJoinAsChildSchema,
  PlaySoundEventPayload,
  type ClientToServerEvents,
  type ControllerInputEvent,
  type ControllerJoinedNotice,
  type ControllerJoinPayload,
  type ControllerLeavePayload,
  type ControllerLeftNotice,
  type ControllerStateMessage,
  type HostLeftNotice,
  type HostRegistrationPayload,
  type HostRegisterSystemPayload,
  type SystemLaunchGamePayload,
  type HostJoinAsChildPayload,
  type InterServerEvents,
  type PlayerProfile,
  type RoomCode,
  type ServerErrorPayload,
  type ServerToClientEvents,
  type SocketData,
} from "@air-jam/sdk/protocol";

interface ControllerSession {
  controllerId: string;
  nickname?: string;
  socketId: string;
  playerProfile: PlayerProfile;
}

type RoomFocus = "SYSTEM" | "GAME";

interface RoomSession {
  roomId: RoomCode;
  masterHostSocketId: string; // The Arcade (System)
  childHostSocketId?: string; // The Game (Child)
  focus: RoomFocus;
  joinToken?: string; // Token required for a child to join
  activeControllerUrl?: string;
  controllers: Map<string, ControllerSession>;
  maxPlayers: number;
}

const rooms = new Map<RoomCode, RoomSession>();
const hostIndex = new Map<string, RoomCode>();
const controllerIndex = new Map<
  string,
  { roomId: RoomCode; controllerId: string }
>();

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

const getActiveHostId = (session: RoomSession): string => {
  if (session.focus === "GAME" && session.childHostSocketId) {
    return session.childHostSocketId;
  }
  return session.masterHostSocketId;
};

const removeRoom = (roomId: RoomCode, reason: string): void => {
  const session = rooms.get(roomId);
  if (!session) return;

  const hostNotice: HostLeftNotice = { roomId, reason };
  io.to(roomId).emit("server:host_left", hostNotice);

  session.controllers.forEach((controller) => {
    controllerIndex.delete(controller.socketId);
  });

  hostIndex.delete(session.masterHostSocketId);
  if (session.childHostSocketId) {
    hostIndex.delete(session.childHostSocketId);
  }
  rooms.delete(roomId);
};

io.on(
  "connection",
  (
    socket: Socket<
      ClientToServerEvents,
      ServerToClientEvents,
      InterServerEvents,
      SocketData
    >
  ) => {
    // --- SYSTEM HOST REGISTRATION (Arcade) ---
    socket.on(
      "host:register_system",
      async (payload: HostRegisterSystemPayload, callback) => {
        const parsed = hostRegisterSystemSchema.safeParse(payload);
        if (!parsed.success) {
          callback({ ok: false, message: parsed.error.message });
          return;
        }

        const { roomId, apiKey } = parsed.data;

        // API Key Validation
        let isVerified = false;
        const MASTER_KEY = process.env.AIR_JAM_MASTER_KEY;

        if (MASTER_KEY && apiKey === MASTER_KEY) {
          isVerified = true;
        } else if (apiKey) {
          try {
            const [keyRecord] = await db
              .select()
              .from(apiKeys)
              .where(and(eq(apiKeys.key, apiKey), eq(apiKeys.isActive, true)))
              .limit(1);

            if (keyRecord) {
              isVerified = true;
              db.update(apiKeys)
                .set({ lastUsedAt: new Date() })
                .where(eq(apiKeys.id, keyRecord.id))
                .catch((err: unknown) =>
                  console.error("[server] Failed to update lastUsedAt", err)
                );
            }
          } catch (error) {
            console.error(
              "[server] Database error during key verification",
              error
            );
            callback({ ok: false, message: "Internal Server Error" });
            return;
          }
        }

        if (!isVerified) {
          console.warn(
            `[server] Unauthorized host registration attempt for room ${roomId}`
          );
          callback({
            ok: false,
            message: "Unauthorized: Invalid or Missing API Key",
          });
          return;
        }

        let session = rooms.get(roomId);

        if (session) {
          // Reconnect logic for System Host
          console.log(
            `[server] System Host re-connected to room ${roomId} (Socket: ${socket.id})`
          );
          session.masterHostSocketId = socket.id;
        } else {
          // Create new room
          console.log(
            `[server] Creating new room ${roomId} (Socket: ${socket.id})`
          );
          session = {
            roomId,
            masterHostSocketId: socket.id,
            focus: "SYSTEM",
            controllers: new Map(),
            maxPlayers: 8, // Default
          };
          rooms.set(roomId, session);
        }

        hostIndex.set(socket.id, roomId);
        socket.join(roomId);

        callback({ ok: true, roomId });
        io.to(roomId).emit("server:room_ready", { roomId });
      }
    );

    // --- LAUNCH GAME (System -> Server) ---
    socket.on(
      "system:launch_game",
      (payload: SystemLaunchGamePayload, callback) => {
        const parsed = systemLaunchGameSchema.safeParse(payload);
        if (!parsed.success) {
          callback({ ok: false, message: parsed.error.message });
          return;
        }

        const { roomId, gameUrl } = parsed.data;
        const session = rooms.get(roomId);

        if (!session) {
          callback({ ok: false, message: "Room not found" });
          return;
        }

        if (session.masterHostSocketId !== socket.id) {
          callback({ ok: false, message: "Unauthorized: Not System Host" });
          return;
        }

        // Generate Join Token
        const joinToken = uuidv4();
        session.joinToken = joinToken;
        session.activeControllerUrl = gameUrl; // Assuming gameUrl is base, logic might need refinement for controller specific URL

        console.log(
          `[server] Launching game in room ${roomId}. Token: ${joinToken}`
        );

        // Broadcast to controllers to load UI
        // NOTE: In a real scenario, gameUrl might be different from controllerUrl.
        // For now, we assume the game handles the controller logic or we pass the game URL.
        // Ideally, the game manifest should provide the controller URL.
        // We will send the gameUrl for now.
        io.to(roomId).emit("client:load_ui", { url: gameUrl });

        callback({ ok: true, joinToken });
      }
    );

    // --- JOIN AS CHILD (Game -> Server) ---
    socket.on(
      "host:join_as_child",
      (payload: HostJoinAsChildPayload, callback) => {
        const parsed = hostJoinAsChildSchema.safeParse(payload);
        if (!parsed.success) {
          callback({ ok: false, message: parsed.error.message });
          return;
        }

        const { roomId, joinToken } = parsed.data;
        const session = rooms.get(roomId);

        if (!session) {
          callback({ ok: false, message: "Room not found" });
          return;
        }

        if (session.joinToken !== joinToken) {
          console.warn(
            `[server] Invalid join token for room ${roomId}. Expected ${session.joinToken}, got ${joinToken}`
          );
          callback({ ok: false, message: "Invalid Join Token" });
          return;
        }

        console.log(
          `[server] Child Host joined room ${roomId} (Socket: ${socket.id})`
        );
        session.childHostSocketId = socket.id;
        session.focus = "GAME"; // Auto-focus on join

        hostIndex.set(socket.id, roomId);
        socket.join(roomId);

        // Send initial state to the game
        console.log(`[server] Syncing ${session.controllers.size} players to Child Host`);
        
        // Small delay to ensure client is ready to receive events after ack
        setTimeout(() => {
            session.controllers.forEach((c) => {
              const notice: ControllerJoinedNotice = {
                controllerId: c.controllerId,
                nickname: c.nickname,
                player: c.playerProfile,
              };
              socket.emit("server:controller_joined", notice);
            });
        }, 100);

        callback({ ok: true, roomId });
      }
    );

    // --- CLOSE GAME (System -> Server) ---
    socket.on("system:close_game", (payload: { roomId: string }) => {
      const { roomId } = payload;
      const session = rooms.get(roomId);
      if (!session) return;

      if (session.masterHostSocketId !== socket.id) return;

      console.log(`[server] System closing game in room ${roomId}`);
      session.focus = "SYSTEM";
      session.childHostSocketId = undefined;
      session.joinToken = undefined;
      session.activeControllerUrl = undefined;

      // Tell controllers to unload UI
      io.to(roomId).emit("client:unload_ui");
      
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
          callback({ ok: false, message: parsed.error.message });
          return;
        }
        const { roomId, maxPlayers } = parsed.data;
        
        // If mode is 'child', we should redirect them to use host:join_as_child if possible,
        // but for standalone dev, they might use this.
        // For now, we treat 'host:register' as creating a STANDALONE room or joining as master.
        
        let session = rooms.get(roomId);
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
            };
            rooms.set(roomId, session);
        }
        
        hostIndex.set(socket.id, roomId);
        socket.join(roomId);
        callback({ ok: true, roomId });
        io.to(roomId).emit("server:room_ready", { roomId });
      }
    );

    socket.on("controller:join", (payload: ControllerJoinPayload, callback) => {
      const parsed = controllerJoinSchema.safeParse(payload);
      if (!parsed.success) {
        callback({ ok: false, message: parsed.error.message });
        return;
      }
      const { roomId, controllerId, nickname } = parsed.data;
      const session = rooms.get(roomId);
      if (!session) {
        callback({ ok: false, message: "Room not found" });
        emitError(socket.id, {
          code: "ROOM_NOT_FOUND",
          message: "Room not found",
        });
        return;
      }

      if (session.controllers.size >= session.maxPlayers) {
        callback({ ok: false, message: "Room full" });
        emitError(socket.id, { code: "ROOM_FULL", message: "Room is full" });
        return;
      }

      const existing = session.controllers.get(controllerId);
      if (existing) {
        controllerIndex.delete(existing.socketId);
      }

      const PLAYER_COLORS = [
        "#38bdf8", "#a78bfa", "#f472b6", "#34d399", "#fbbf24",
        "#60a5fa", "#c084fc", "#fb7185", "#4ade80", "#f87171",
        "#22d3ee", "#a855f7", "#ec4899", "#10b981", "#f59e0b",
        "#3b82f6", "#8b5cf6", "#ef4444", "#14b8a6", "#f97316",
      ];
      const colorHex =
        PLAYER_COLORS[session.controllers.size % PLAYER_COLORS.length];

      let color: string;
      try {
        color = Color(colorHex).hex();
      } catch (error) {
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
      controllerIndex.set(socket.id, { roomId, controllerId });
      socket.join(roomId);

      const notice: ControllerJoinedNotice = {
        controllerId,
        nickname,
        player: playerProfile,
      };

      // Emit to Active Host based on Focus
      io.to(getActiveHostId(session)).emit("server:controller_joined", notice);

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
      const session = rooms.get(roomId);
      if (!session) {
        return;
      }
      session.controllers.delete(controllerId);
      controllerIndex.delete(socket.id);
      const notice: ControllerLeftNotice = { controllerId };
      io.to(getActiveHostId(session)).emit("server:controller_left", notice);
      socket.leave(roomId);
    });

    socket.on("controller:input", (payload: ControllerInputEvent) => {
      const result = controllerInputSchema.safeParse(payload);
      if (!result.success) return;
      
      const { roomId } = result.data;
      const session = rooms.get(roomId);
      if (!session) {
        return;
      }

      // Route based on FOCUS
      const targetHostId = getActiveHostId(session);
      if (targetHostId) {
        io.to(targetHostId).emit("server:input", result.data);
      }
    });

    socket.on("host:state", (payload: ControllerStateMessage) => {
      const result = controllerStateSchema.safeParse(payload);
      if (!result.success) return;
      
      const { roomId } = result.data;
      const session = rooms.get(roomId);
      if (session) {
        session.controllers.forEach((c) => {
          io.to(c.socketId).emit("server:state", result.data);
        });
      }
    });

    socket.on("host:play_sound", (payload: PlaySoundEventPayload) => {
      const { roomId, targetControllerId, soundId, volume, loop } = payload;
      const session = rooms.get(roomId);
      if (!session) return;

      const message = { id: soundId, volume, loop };

      if (targetControllerId) {
        const controller = session.controllers.get(targetControllerId);
        if (controller) {
          io.to(controller.socketId).emit("server:play_sound", message);
        }
      } else {
        socket.to(roomId).emit("server:play_sound", message);
      }
    });

    socket.on("controller:play_sound", (payload: PlaySoundEventPayload) => {
      const { roomId, soundId, volume, loop } = payload;
      const session = rooms.get(roomId);
      if (!session) return;

      io.to(getActiveHostId(session)).emit("server:play_sound", {
        id: soundId,
        volume,
        loop,
      });
    });

    socket.on("disconnect", () => {
      const roomId = hostIndex.get(socket.id);
      if (roomId) {
        const session = rooms.get(roomId);
        if (!session) {
          hostIndex.delete(socket.id);
          return;
        }

        if (socket.id === session.childHostSocketId) {
          // Child disconnected
          console.log(
            `[server] Child Host disconnected from room ${roomId}. Reverting focus to SYSTEM.`
          );
          session.childHostSocketId = undefined;
          session.focus = "SYSTEM";
          session.joinToken = undefined;
          
          // Tell controllers to unload UI
          io.to(roomId).emit("client:unload_ui");

        } else if (socket.id === session.masterHostSocketId) {
          // Master disconnected
          console.log(
            `[server] Master Host disconnected from room ${roomId}. Starting grace period.`
          );
          
          setTimeout(() => {
            const currentSession = rooms.get(roomId);
            if (
              currentSession &&
              currentSession.masterHostSocketId === socket.id
            ) {
              console.log(
                `[server] Grace period expired. Removing room ${roomId}.`
              );
              removeRoom(roomId, "Host disconnected");
            }
          }, 3000);
        }

        hostIndex.delete(socket.id);
        return;
      }

      const controller = controllerIndex.get(socket.id);
      if (controller) {
        const session = rooms.get(controller.roomId);
        if (session) {
          session.controllers.delete(controller.controllerId);
          const notice: ControllerLeftNotice = {
            controllerId: controller.controllerId,
          };
          io.to(getActiveHostId(session)).emit(
            "server:controller_left",
            notice
          );
        }
        controllerIndex.delete(socket.id);
      }
    });
  }
);

httpServer.listen(PORT, () => {
  console.log(`[air-jam] server listening on ${PORT}`);
});

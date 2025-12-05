import express from "express";
import cors from "cors";
import { createServer } from "node:http";
import { Server, type Socket } from "socket.io";
import Color from "color";
import { db, apiKeys } from "./db";
import { eq, and } from "drizzle-orm";
import {
  controllerInputSchema,
  controllerJoinSchema,
  controllerLeaveSchema,
  controllerStateSchema,
  hostRegistrationSchema,
  type ClientToServerEvents,
  type ControllerJoinedNotice,
  type ControllerLeftNotice,
  type HostLeftNotice,
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

interface RoomSession {
  roomId: RoomCode;
  hostSocketId: string;
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

const removeRoom = (roomId: RoomCode, reason: string): void => {
  const session = rooms.get(roomId);
  if (!session) return;

  const hostNotice: HostLeftNotice = { roomId, reason };
  io.to(roomId).emit("server:host_left", hostNotice);

  session.controllers.forEach((controller) => {
    controllerIndex.delete(controller.socketId);
  });

  hostIndex.delete(session.hostSocketId);
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
    socket.on("host:register", async (payload, callback) => {
      const parsed = hostRegistrationSchema.safeParse(payload);
      if (!parsed.success) {
        callback({ ok: false, message: parsed.error.message });
        return;
      }

      const { roomId, maxPlayers, apiKey } = parsed.data;

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
            // Optional: Update lastUsedAt asynchronously
            db.update(apiKeys)
              .set({ lastUsedAt: new Date() })
              .where(eq(apiKeys.id, keyRecord.id))
              .catch((err) =>
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

      // Check if room exists for takeover logic
      const existingSession = rooms.get(roomId);
      let nextSession: RoomSession;

      if (existingSession) {
        // --- TAKEOVER MODE ---
        console.log(
          `[server] Host takeover for room ${roomId} by socket ${socket.id}`
        );

        // Update host index to point to new socket
        // Note: We don't remove the old host from hostIndex here immediately,
        // because it might be the one initiating the takeover (unlikely)
        // or it might disconnect later.
        // Actually, if we just overwrite hostIndex for the new socket, that's fine.
        // But we need to make sure the OLD socket doesn't kill the room when it disconnects.
        // We handle that in the disconnect handler by checking session.hostSocketId.

        existingSession.hostSocketId = socket.id;
        existingSession.maxPlayers = maxPlayers;
        nextSession = existingSession;

        hostIndex.set(socket.id, roomId);
      } else {
        // --- NEW ROOM MODE ---
        nextSession = {
          roomId,
          hostSocketId: socket.id,
          controllers: new Map(),
          maxPlayers,
        };
        rooms.set(roomId, nextSession);
        hostIndex.set(socket.id, roomId);
      }

      socket.join(roomId);

      callback({ ok: true, roomId });
      io.to(roomId).emit("server:room_ready", { roomId });

      // If takeover, emit existing controllers to the new host
      if (existingSession) {
        existingSession.controllers.forEach((c) => {
          const notice: ControllerJoinedNotice = {
            controllerId: c.controllerId,
            nickname: c.nickname,
            player: c.playerProfile,
          };
          // Emit only to the new host
          io.to(socket.id).emit("server:controller_joined", notice);
        });
      }
    });

    socket.on("controller:join", (payload, callback) => {
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

      // Assign color based on join order (single source of truth)
      // 20 distinct colors to support up to 20 players
      const PLAYER_COLORS = [
        "#38bdf8", // Sky blue
        "#a78bfa", // Purple
        "#f472b6", // Pink
        "#34d399", // Emerald
        "#fbbf24", // Amber
        "#60a5fa", // Blue
        "#c084fc", // Violet
        "#fb7185", // Rose
        "#4ade80", // Green
        "#f87171", // Red
        "#22d3ee", // Cyan
        "#a855f7", // Purple
        "#ec4899", // Fuchsia
        "#10b981", // Green
        "#f59e0b", // Orange
        "#3b82f6", // Blue
        "#8b5cf6", // Indigo
        "#ef4444", // Red
        "#14b8a6", // Teal
        "#f97316", // Orange
      ];
      const colorHex =
        PLAYER_COLORS[session.controllers.size % PLAYER_COLORS.length];

      // Validate and normalize color using color package
      let color: string;
      try {
        color = Color(colorHex).hex();
      } catch (error) {
        console.error(
          `[server] Invalid color in PLAYER_COLORS: ${colorHex}`,
          error
        );
        color = Color("#38bdf8").hex(); // Fallback to first color
      }

      const controllerSession: ControllerSession = {
        controllerId,
        nickname,
        socketId: socket.id,
        playerProfile,
      };

      session.controllers.set(controllerId, controllerSession);
      controllerIndex.set(socket.id, { roomId, controllerId });
      socket.join(roomId);

      // Create player profile with color (single source of truth)
      const playerProfile: PlayerProfile = {
        id: controllerId,
        label: nickname ?? `Player ${session.controllers.size}`,
        color, // Validated and normalized hex color
      };

      const notice: ControllerJoinedNotice = {
        controllerId,
        nickname,
        player: playerProfile,
      };
      io.to(session.hostSocketId).emit("server:controller_joined", notice);
      callback({ ok: true, controllerId, roomId });

      const welcomePayload = {
        controllerId,
        roomId,
        player: playerProfile,
      };

      if (!playerProfile.color) {
        console.error(
          "[server] ERROR: Player profile missing color!",
          playerProfile
        );
      }

      socket.emit("server:welcome", welcomePayload);
    });

    socket.on("controller:leave", (payload) => {
      const parsed = controllerLeaveSchema.safeParse(payload);
      if (!parsed.success) {
        emitError(socket.id, {
          code: "INVALID_PAYLOAD",
          message: parsed.error.message,
        });
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
      io.to(session.hostSocketId).emit("server:controller_left", notice);
      socket.leave(roomId);
    });

    socket.on("controller:input", (payload) => {
      const parsed = controllerInputSchema.safeParse(payload);
      if (!parsed.success) {
        emitError(socket.id, {
          code: "INVALID_PAYLOAD",
          message: parsed.error.message,
        });
        return;
      }
      const { roomId, controllerId } = parsed.data;
      const session = rooms.get(roomId);
      if (!session) {
        emitError(socket.id, {
          code: "ROOM_NOT_FOUND",
          message: "Room not found",
        });
        return;
      }
      if (!session.controllers.has(controllerId)) {
        emitError(socket.id, {
          code: "INVALID_PAYLOAD",
          message: "Controller not registered",
        });
        return;
      }
      io.to(session.hostSocketId).emit("server:input", parsed.data);
    });

    socket.on("host:state", (payload) => {
      const parsed = controllerStateSchema.safeParse(payload);
      if (!parsed.success) {
        emitError(socket.id, {
          code: "INVALID_PAYLOAD",
          message: parsed.error.message,
        });
        return;
      }
      const { roomId } = parsed.data;
      const session = rooms.get(roomId);
      if (!session) {
        return;
      }

      socket.to(roomId).emit("server:state", parsed.data);
    });

    socket.on("host:play_sound", (payload) => {
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
        // Broadcast to all controllers in the room
        socket.to(roomId).emit("server:play_sound", message);
      }
    });

    socket.on("controller:play_sound", (payload) => {
      const { roomId, soundId, volume, loop } = payload;
      const session = rooms.get(roomId);
      if (!session) return;

      // Forward to Host
      io.to(session.hostSocketId).emit("server:play_sound", {
        id: soundId,
        volume,
        loop,
      });
    });

    socket.on("disconnect", () => {
      const roomId = hostIndex.get(socket.id);
      if (roomId) {
        // Only remove room if the disconnecting socket is the CURRENT host
        // This handles the takeover case where the old host disconnects after the new one takes over
        const session = rooms.get(roomId);
        if (session && session.hostSocketId === socket.id) {
          // Add a small grace period?
          // For now, let's just remove it.
          // If we want "seamless" Arcade -> Game -> Arcade, the Arcade should reconnect FAST.
          // Or we rely on the fact that Arcade reconnects *after* Game disconnects?
          // If Game disconnects, room dies. Arcade reconnects -> New Room.
          // Controllers get disconnected.
          // We need a "Grace Period".

          console.log(
            `[server] Host ${socket.id} disconnected from room ${roomId}. Starting grace period.`
          );

          // Use a timeout to allow a new host to reconnect
          setTimeout(() => {
            const currentSession = rooms.get(roomId);
            if (currentSession && currentSession.hostSocketId === socket.id) {
              console.log(
                `[server] Grace period expired. Removing room ${roomId}.`
              );
              removeRoom(roomId, "Host disconnected");
            } else {
              console.log(
                `[server] Room ${roomId} survived (Host updated to ${currentSession?.hostSocketId}).`
              );
            }
          }, 3000); // 3 seconds grace period
        } else {
          console.log(
            `[server] Old host ${socket.id} disconnected from room ${roomId} (Current host: ${session?.hostSocketId}). Ignoring.`
          );
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
          io.to(session.hostSocketId).emit("server:controller_left", notice);
        }
        controllerIndex.delete(socket.id);
      }
    });
  }
);

httpServer.listen(PORT, () => {
  console.log(`[air-jam] server listening on ${PORT}`);
});

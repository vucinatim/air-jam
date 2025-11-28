import express from "express";
import cors from "cors";
import { createServer } from "node:http";
import { Server, type Socket } from "socket.io";
import Color from "color";
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
    socket.on("host:register", (payload, callback) => {
      const parsed = hostRegistrationSchema.safeParse(payload);
      if (!parsed.success) {
        callback({ ok: false, message: parsed.error.message });
        return;
      }

      const { roomId, maxPlayers } = parsed.data;
      const nextSession: RoomSession = {
        roomId,
        hostSocketId: socket.id,
        controllers: new Map(),
        maxPlayers,
      };

      rooms.set(roomId, nextSession);
      hostIndex.set(socket.id, roomId);
      socket.join(roomId);

      callback({ ok: true, roomId });
      io.to(roomId).emit("server:room_ready", { roomId });
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
        removeRoom(roomId, "Host disconnected");
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

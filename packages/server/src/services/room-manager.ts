import type { RoomCode } from "@air-jam/sdk/protocol";
import type { Server } from "socket.io";
import type { RoomSession, ControllerIndexEntry } from "../types.js";

/**
 * Room manager service
 * Handles all room state management and lookup operations
 */
export class RoomManager {
  private rooms = new Map<RoomCode, RoomSession>();
  private hostIndex = new Map<string, RoomCode>();
  private controllerIndex = new Map<string, ControllerIndexEntry>();

  /**
   * Get a room by ID
   */
  getRoom(roomId: RoomCode): RoomSession | undefined {
    return this.rooms.get(roomId);
  }

  /**
   * Create or update a room
   */
  setRoom(roomId: RoomCode, session: RoomSession): void {
    this.rooms.set(roomId, session);
  }

  /**
   * Delete a room
   */
  deleteRoom(roomId: RoomCode): void {
    this.rooms.delete(roomId);
  }

  /**
   * Get room ID by host socket ID
   */
  getRoomByHostId(socketId: string): RoomCode | undefined {
    return this.hostIndex.get(socketId);
  }

  /**
   * Associate a host socket with a room
   */
  setHostRoom(socketId: string, roomId: RoomCode): void {
    this.hostIndex.set(socketId, roomId);
  }

  /**
   * Remove host association
   */
  deleteHost(socketId: string): void {
    this.hostIndex.delete(socketId);
  }

  /**
   * Get controller info by socket ID
   */
  getControllerInfo(socketId: string): ControllerIndexEntry | undefined {
    return this.controllerIndex.get(socketId);
  }

  /**
   * Associate a controller socket with room and controller ID
   */
  setController(socketId: string, entry: ControllerIndexEntry): void {
    this.controllerIndex.set(socketId, entry);
  }

  /**
   * Remove controller association
   */
  deleteController(socketId: string): void {
    this.controllerIndex.delete(socketId);
  }

  /**
   * Get the active host socket ID based on focus
   */
  getActiveHostId(session: RoomSession): string {
    if (session.focus === "GAME" && session.childHostSocketId) {
      return session.childHostSocketId;
    }
    return session.masterHostSocketId;
  }

  /**
   * Remove a room and clean up all associations
   */
  removeRoom(roomId: RoomCode, io: Server, reason: string): void {
    const session = this.rooms.get(roomId);
    if (!session) return;

    // Notify all clients
    io.to(roomId).emit("server:hostLeft", { roomId, reason });

    // Clean up controller indices
    session.controllers.forEach((controller) => {
      this.controllerIndex.delete(controller.socketId);
    });

    // Clean up host indices
    this.hostIndex.delete(session.masterHostSocketId);
    if (session.childHostSocketId) {
      this.hostIndex.delete(session.childHostSocketId);
    }

    // Remove room
    this.rooms.delete(roomId);
  }

  /**
   * Get all rooms (for debugging/monitoring)
   */
  getAllRooms(): Map<RoomCode, RoomSession> {
    return this.rooms;
  }
}

/**
 * Singleton instance
 */
export const roomManager = new RoomManager();

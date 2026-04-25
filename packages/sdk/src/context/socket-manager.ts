import { io, type Socket } from "socket.io-client";
import type {
  ClientToServerEvents,
  ConnectionRole,
  ServerToClientEvents,
} from "../protocol";

export type AirJamSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

/**
 * Manages socket connections per role within a provider instance.
 * Unlike the global singleton, each SocketManager is scoped to its provider.
 */
export class SocketManager {
  private sockets: Partial<Record<ConnectionRole, AirJamSocket>> = {};
  private socketOrigin: string;

  constructor(socketOrigin: string) {
    this.socketOrigin = this.normalizeOrigin(socketOrigin);
  }

  /**
   * Get or create a socket for the specified role.
   * Sockets are lazily created and cached per role.
   */
  getSocket(role: ConnectionRole): AirJamSocket {
    const existing = this.sockets[role];
    if (existing) {
      return existing;
    }

    const socket = io(this.socketOrigin, {
      autoConnect: false,
      query: { role },
    }) as AirJamSocket;

    this.sockets[role] = socket;
    return socket;
  }

  /**
   * Disconnect a socket by role.
   * NOTE: We intentionally do NOT delete the socket from cache.
   * This ensures all hooks using getSocket() get the same instance,
   * even during React Strict Mode remounts. The socket can be reconnected
   * by calling socket.connect() again.
   */
  disconnect(role: ConnectionRole): void {
    const socket = this.sockets[role];
    if (socket) {
      socket.disconnect();
      // DO NOT delete from cache - keep the same socket instance
      // so all components can reconnect to it
    }
  }

  /**
   * Disconnect all sockets managed by this instance
   */
  disconnectAll(): void {
    for (const role of Object.keys(this.sockets) as ConnectionRole[]) {
      this.disconnect(role);
    }
  }

  /**
   * Deprecated compatibility alias. Returns the resolved socket origin.
   */
  getServerUrl(): string {
    return this.socketOrigin;
  }

  private normalizeOrigin(origin: string): string {
    if (!origin.includes("://")) {
      return `http://${origin}`;
    }
    return origin;
  }
}

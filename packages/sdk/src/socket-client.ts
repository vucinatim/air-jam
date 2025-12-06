import { io, type Socket } from "socket.io-client";
import type {
  ClientToServerEvents,
  ConnectionRole,
  ServerToClientEvents,
} from "./protocol";
import { urlBuilder } from "./utils/url-builder";

const sockets: Partial<
  Record<ConnectionRole, Socket<ServerToClientEvents, ClientToServerEvents>>
> = {};

export const getSocketClient = (
  role: ConnectionRole,
  serverUrl?: string,
): Socket<ServerToClientEvents, ClientToServerEvents> => {
  const existing = sockets[role];
  if (existing) {
    return existing;
  }

  const url = urlBuilder.resolveServerUrl(serverUrl);
  const socket = io(url, {
    autoConnect: false,
    transports: ["websocket"],
    query: { role },
  }) as Socket<ServerToClientEvents, ClientToServerEvents>;
  sockets[role] = socket;
  return socket;
};

export const disconnectSocket = (role: ConnectionRole): void => {
  const socket = sockets[role];
  if (socket) {
    socket.disconnect();
    delete sockets[role];
  }
};

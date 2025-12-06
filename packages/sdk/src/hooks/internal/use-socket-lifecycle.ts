import { useEffect, useState } from "react";
import type { ConnectionRole } from "../../protocol";
import { getSocketClient } from "../../socket-client";

/**
 * Manages socket connection lifecycle
 * Handles socket initialization, connection, and cleanup
 *
 * @param role - Connection role (host or controller)
 * @param serverUrl - Optional server URL override
 * @param shouldConnect - Whether to establish connection
 * @returns Socket instance and connection state
 */
export function useSocketLifecycle(
  role: ConnectionRole,
  serverUrl?: string,
  shouldConnect: boolean = true,
): {
  socket: ReturnType<typeof getSocketClient> | null;
  isConnected: boolean;
} {
  const [isConnected, setIsConnected] = useState(false);
  const [socket] = useState(() =>
    shouldConnect ? getSocketClient(role, serverUrl) : null,
  );

  useEffect(() => {
    if (!socket || !shouldConnect) {
      setIsConnected(false);
      return;
    }

    const handleConnect = () => setIsConnected(true);
    const handleDisconnect = () => setIsConnected(false);

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);

    // Connect the socket
    socket.connect();

    // Initial state based on current connection
    setIsConnected(socket.connected);

    return () => {
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
    };
  }, [socket, shouldConnect]);

  return { socket, isConnected };
}

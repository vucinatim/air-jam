import { useEffect, useMemo, useState } from "react";
import type { ConnectionRole } from "../../protocol";
import { useAirJamContext } from "../../context/air-jam-context";
import type { AirJamSocket } from "../../context/socket-manager";

/**
 * Manages socket connection lifecycle using context
 * Handles socket initialization, connection, and cleanup
 *
 * @param role - Connection role (host or controller)
 * @param shouldConnect - Whether to establish connection
 * @returns Socket instance and connection state
 */
export function useSocketLifecycle(
  role: ConnectionRole,
  shouldConnect: boolean = true,
): {
  socket: AirJamSocket | null;
  isConnected: boolean;
} {
  const { getSocket } = useAirJamContext();
  const [isConnected, setIsConnected] = useState(false);

  const socket = useMemo(
    () => (shouldConnect ? getSocket(role) : null),
    [shouldConnect, getSocket, role],
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

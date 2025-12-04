import { useEffect } from "react";
import type { Socket } from "socket.io-client";
import type {
  AirJamProxyMessage,
  ClientToServerEvents,
  ControllerInputEvent,
  ControllerJoinedNotice,
  ControllerLeftNotice,
  PlayerProfile,
  RoomCode,
  ServerToClientEvents,
} from "../protocol";

interface UseAirJamProxyOptions {
  socket: Socket<ServerToClientEvents, ClientToServerEvents> | null;
  iframeRef: React.RefObject<HTMLIFrameElement | null>;
  players: PlayerProfile[];
  roomId: RoomCode;
  isEnabled: boolean;
}

export const useAirJamProxy = ({
  socket,
  iframeRef,
  players,
  roomId,
  isEnabled,
}: UseAirJamProxyOptions) => {
  useEffect(() => {
    if (!isEnabled || !iframeRef.current || !socket) return;

    const iframeWindow = iframeRef.current.contentWindow;
    if (!iframeWindow) return;

    // 1. Forward Socket Events to Iframe
    const handleInput = (payload: ControllerInputEvent) => {
      iframeWindow.postMessage(
        {
          type: "AIRJAM_INPUT",
          payload,
        } as AirJamProxyMessage,
        "*"
      );
    };

    const handleJoin = (payload: ControllerJoinedNotice) => {
      iframeWindow.postMessage(
        {
          type: "AIRJAM_PLAYER_JOIN",
          payload,
        } as AirJamProxyMessage,
        "*"
      );
    };

    const handleLeave = (payload: ControllerLeftNotice) => {
      iframeWindow.postMessage(
        {
          type: "AIRJAM_PLAYER_LEAVE",
          payload,
        } as AirJamProxyMessage,
        "*"
      );
    };

    socket.on("server:input", handleInput);
    socket.on("server:controller_joined", handleJoin);
    socket.on("server:controller_left", handleLeave);

    // 2. Listen for Iframe Messages (Handshake & State)
    const handleMessage = (event: MessageEvent) => {
      if (event.source !== iframeWindow) return;

      const data = event.data as AirJamProxyMessage;
      if (!data || typeof data.type !== "string") return;

      if (data.type === "AIRJAM_READY") {
        // Send initial state
        iframeWindow.postMessage(
          {
            type: "AIRJAM_INIT",
            payload: { players, roomId },
          } as AirJamProxyMessage,
          "*"
        );
      }

      if (data.type === "AIRJAM_STATE") {
        // Forward state from Game to Server (via Parent Socket)
        socket.emit("host:state", { roomId, state: data.payload });
      }
    };

    window.addEventListener("message", handleMessage);

    return () => {
      socket.off("server:input", handleInput);
      socket.off("server:controller_joined", handleJoin);
      socket.off("server:controller_left", handleLeave);
      window.removeEventListener("message", handleMessage);
    };
  }, [isEnabled, socket, iframeRef]); // intentionally omitting players/roomId from dependency to avoid re-binding listeners too often, assuming they are stable or handled via closure if needed.
  // Actually, players changes often. But we only use players in AIRJAM_READY response.
  // If we want to send updated players list to iframe, we should do it when players change.
  // But standard SDK listens to server events. So we just need to forward the events (which we do).
  // The AIRJAM_INIT is only for initial sync.
};

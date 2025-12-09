import { useEffect } from "react";
import type { Socket } from "socket.io-client";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  SignalPayload,
} from "../protocol";

type AirJamSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

export const useAirJamHaptics = (socket: AirJamSocket | null) => {
  useEffect(() => {
    if (!socket) return;

    const handleSignal = (signal: SignalPayload) => {
      if (signal.type !== "HAPTIC") return;

      // Browser compatibility check
      if (typeof navigator === "undefined" || !navigator.vibrate) return;

      const payload = signal.payload;

      switch (payload.pattern) {
        case "light":
          navigator.vibrate(10);
          break;
        case "medium":
          navigator.vibrate(30);
          break;
        case "heavy":
          navigator.vibrate([50, 20, 50]); // Pulse
          break;
        case "success":
          navigator.vibrate([10, 30, 10]);
          break;
        case "failure":
          navigator.vibrate([50, 50, 50, 50]);
          break;
        case "custom":
          if (Array.isArray(payload.sequence)) {
            navigator.vibrate(payload.sequence);
          } else if (typeof payload.sequence === "number") {
            navigator.vibrate(payload.sequence);
          }
          break;
      }
    };

    socket.on("server:signal", handleSignal);
    return () => {
      socket.off("server:signal", handleSignal);
    };
  }, [socket]);
};

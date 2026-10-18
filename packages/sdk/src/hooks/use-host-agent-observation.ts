import { useEffect, useRef } from "react";
import type { HostObservationSurface } from "../runtime/contracts/observation";
import { registerHostObservationSurface } from "../runtime/host-observation";
import { useAirJamHost } from "./use-air-jam-host";

/** Bind a read-only projection of host-local simulation to the live game. */
export function useHostAgentObservation(surface: HostObservationSurface) {
  const roomId = useAirJamHost((state) => state.roomId);
  const current = useRef(surface);
  current.current = surface;
  const hasCapture = Boolean(surface.capture);
  useEffect(() => {
    if (!roomId) return;
    return registerHostObservationSurface(window, roomId, {
      read: (context) => current.current.read(context),
      ...(hasCapture
        ? { capture: () => current.current.capture?.() ?? null }
        : {}),
    });
  }, [roomId, hasCapture]);
}

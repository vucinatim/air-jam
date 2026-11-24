import { useContext } from "react";
import { useAssertSessionScope } from "../context/session-scope";
import { createAirJamDiagnosticError } from "../diagnostics";
import type { HapticSignalPayload, ToastSignalPayload } from "../room-protocol";
import { hostRuntimeContext } from "../runtime/runtime-owner-contexts";
import type { AirJamHostRuntimeControls } from "./use-air-jam-host";

export interface SendSignalFn {
  /** Vibrates one phone, or every phone when no target is given. */
  (type: "HAPTIC", payload: HapticSignalPayload, targetId?: string): void;
  /** Shows a toast on one phone, or on every phone. */
  (type: "TOAST", payload: ToastSignalPayload, targetId?: string): void;
}

/**
 * Sends one-shot signals from the host to players' phones: haptics and
 * toasts. A signal is never stored, so one sent while the room is away is lost.
 */
export const useSendSignal = (): SendSignalFn => {
  useAssertSessionScope("host", "useSendSignal");
  const runtime = useContext(
    hostRuntimeContext,
  ) as AirJamHostRuntimeControls | null;
  if (!runtime)
    throw createAirJamDiagnosticError(
      "AJ_SCOPE_MISMATCH",
      "useSendSignal requires a mounted host runtime boundary. Wrap the host tree with <airjam.Host>.",
      {
        hookName: "useSendSignal",
        expectedScope: "host",
        receivedScope: "host",
      },
    );
  return runtime.sendSignal;
};

import { useStore } from "zustand";
import { useShallow } from "zustand/react/shallow";
import { useAirJamContext } from "../context/air-jam-context";
import { useAssertSessionScope } from "../context/session-scope";
import type { HostArcadeSessionSnapshot } from "../protocol";

export interface HostArcadeRestoreStateView {
  phase: "idle" | "awaiting_ack" | "pending_restore";
  session: HostArcadeSessionSnapshot | null;
  clear: () => void;
}

/**
 * Advanced host-only Arcade reconnect restore seam.
 *
 * This is intended for the platform Arcade shell, not normal game code.
 */
export const useHostArcadeRestore = (): HostArcadeRestoreStateView => {
  useAssertSessionScope("host", "useHostArcadeRestore");

  const { store } = useAirJamContext();
  return useStore(
    store,
    useShallow((s) => ({
      phase: s.hostArcadeRestore.phase,
      session: s.hostArcadeRestore.session,
      clear: s.clearHostArcadeRestore,
    })),
  );
};

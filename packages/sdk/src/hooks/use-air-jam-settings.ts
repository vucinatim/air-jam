import { useContext, useSyncExternalStore } from "react";
import { useAssertSessionScope } from "../context/session-scope";
import type { AirJamSettings, AirJamSettingsValues } from "../core/settings";
import { hostRuntimeContext } from "../runtime/runtime-owner-contexts";
import type { AirJamHostRuntimeControls } from "./use-air-jam-host";

/** Reads this host's current settings; controllers read only replicated game state. */
export function useAirJamSettings<Declaration extends AirJamSettings>(
  declaration: Declaration,
): AirJamSettingsValues<Declaration> {
  useAssertSessionScope("host", "useAirJamSettings");
  const runtime = useContext(
    hostRuntimeContext,
  ) as AirJamHostRuntimeControls | null;
  if (!runtime)
    throw new Error("useAirJamSettings requires a mounted game Host.");
  if (runtime.settings.declaration !== declaration)
    throw new Error(
      "useAirJamSettings must read this game's declared settings.",
    );
  const snapshot = useSyncExternalStore(
    runtime.settings.subscribe,
    runtime.settings.read,
    runtime.settings.read,
  );
  return snapshot.values as AirJamSettingsValues<Declaration>;
}

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { flushSync } from "react-dom";
import { AirJamContext, useAirJamContext } from "../context/air-jam-context";
import { HostRuntime } from "../core/host-runtime";
import type { AirJamReplay } from "../core/replay-input-log";
import type { AirJamHostRuntimeControls } from "../hooks/use-air-jam-host";
import { bindBrowserReplay } from "./browser-replay";
import { embeddedRuntimeParent } from "./embedded-parent";
import {
  declaredStoresContext,
  hostRuntimeContext,
} from "./runtime-owner-contexts";
import type { AirJamHostRuntimeProps } from "./session-runtimes";

const NO_STORES: NonNullable<AirJamHostRuntimeProps["stores"]> = [];

export function ReplayRuntime({
  children,
  stores = NO_STORES,
  simulation,
  settings,
  input,
  agent,
  gameId,
  fixedControllerOrientation,
}: AirJamHostRuntimeProps & { children: ReactNode }) {
  const context = useAirJamContext();
  const [replay, setReplay] = useState<AirJamReplay | null>(null);
  const declared = useMemo(() => new Set(stores), [stores]);
  useEffect(() => {
    const parent = embeddedRuntimeParent(context.config.topology);
    if (!parent)
      throw new Error(
        "A browser replay requires its declared embedding parent.",
      );
    return bindBrowserReplay({
      parent: parent.window,
      parentOrigin: parent.origin,
      createHostRuntime: (dependencies, options) =>
        new HostRuntime(
          {
            ...dependencies,
            fixedControllerOrientation,
            stores,
            simulation,
            settings,
            input,
            agent: agent && { contract: agent, gameId: gameId ?? "game" },
          },
          options,
        ),
      // Commit the game tree and its layout effects before the first observation.
      mounted: (value) => flushSync(() => setReplay(value)),
      listen: (listener) => {
        window.addEventListener("message", listener);
        return () => window.removeEventListener("message", listener);
      },
    });
  }, [
    context.config.topology,
    stores,
    simulation,
    settings,
    input,
    agent,
    gameId,
    fixedControllerOrientation,
  ]);
  if (!replay) return null;
  const runtime = replay.runtime;
  const controls: AirJamHostRuntimeControls = {
    roomId: replay.roomId,
    joinUrl: "",
    joinUrlStatus: "ready",
    pauseRuntime: runtime.pauseRuntime,
    resumeRuntime: runtime.resumeRuntime,
    setRuntimeState: runtime.setRuntimeState,
    sendState: runtime.sendState,
    sendSignal: runtime.sendSignal,
    reconnect: runtime.reconnect,
    removeController: runtime.removeController,
    resetRoom: runtime.resetRoom,
    socket: runtime.socket,
    simulation: runtime.simulation,
    setObservationCapture: runtime.setObservationCapture,
    settings: runtime.settings,
  };
  return (
    <AirJamContext.Provider
      value={{
        ...context,
        store: runtime.store,
        getSocket: () => runtime.socket,
        disconnectSocket: () => {
          runtime.socket.disconnect();
        },
      }}
    >
      <hostRuntimeContext.Provider value={controls}>
        <declaredStoresContext.Provider value={declared}>
          {children}
        </declaredStoresContext.Provider>
      </hostRuntimeContext.Provider>
    </AirJamContext.Provider>
  );
}

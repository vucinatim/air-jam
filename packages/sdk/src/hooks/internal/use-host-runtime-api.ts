import { useEffect, useMemo, useState } from "react";
import { useStore } from "zustand";
import { useAirJamContext } from "../../context/air-jam-context";
import {
  useAssertSessionScope,
  useClaimSessionRuntimeOwner,
} from "../../context/session-scope";
import {
  HostRuntime,
  type HostRuntimeDependencies,
} from "../../core/host-runtime";
import { airJamSettingsValuesSchema } from "../../core/settings";
import type { RoomCode } from "../../protocol";
import { createBrowserHostEnvironment } from "../../runtime/browser-host-environment";
import type {
  AirJamHostOptions,
  AirJamHostRuntimeControls,
} from "../use-air-jam-host";

/** What the game declares for its host runtime. */
export type HostGameDeclaration = Pick<
  HostRuntimeDependencies,
  | "stores"
  | "simulation"
  | "agent"
  | "input"
  | "settings"
  | "fixedControllerOrientation"
>;

/** Binds one core host runtime to this provider tree for as long as it is mounted. */
export const useHostRuntimeApi = (
  options: AirJamHostOptions,
  hookName: string,
  {
    stores,
    simulation,
    agent,
    input,
    settings,
    fixedControllerOrientation,
  }: HostGameDeclaration,
): AirJamHostRuntimeControls => {
  useAssertSessionScope("host", hookName);
  useClaimSessionRuntimeOwner("host-runtime", hookName);

  const { config, store, getSocket, disconnectSocket } = useAirJamContext();

  // Phone reach can arrive after the room starts; it does not identify the session.
  const { publicHost, ...sessionTopology } = config.topology;
  const sessionConfigKey = JSON.stringify({
    ...config,
    topology: sessionTopology,
  });
  const sessionConfig = useMemo(
    () => JSON.parse(sessionConfigKey) as typeof config,
    [sessionConfigKey],
  );

  const runtime = useMemo(
    () =>
      new HostRuntime(
        {
          fixedControllerOrientation,
          config: sessionConfig,
          store,
          getSocket,
          disconnectSocket,
          input,
          environment: createBrowserHostEnvironment(),
          stores,
          settings,
          simulation,
          agent,
        },
        {
          settings: airJamSettingsValuesSchema.parse(
            JSON.parse(
              new URLSearchParams(window.location.search).get(
                "airjamSettings",
              ) ?? "{}",
            ),
          ),
        },
      ),
    [
      sessionConfig,
      store,
      getSocket,
      disconnectSocket,
      input,
      stores,
      settings,
      simulation,
      agent,
      fixedControllerOrientation,
    ],
  );

  useEffect(() => {
    runtime.setTopology({ ...sessionConfig.topology, publicHost });
  }, [runtime, sessionConfig, publicHost]);

  // Declared before start so the runtime starts with the current options.
  useEffect(() => {
    runtime.setOptions({
      roomId: options.roomId,
      onPlayerJoin: options.onPlayerJoin,
      onPlayerLeave: options.onPlayerLeave,
    });
  }, [runtime, options.roomId, options.onPlayerJoin, options.onPlayerLeave]);

  useEffect(() => runtime.start(), [runtime]);

  // A loaded simulation appears on the runtime; render again to hand it out.
  const [, setLoaded] = useState<HostRuntime | null>(null);
  const [loadError, setLoadError] = useState<unknown>(null);
  useEffect(() => {
    let current = true;
    runtime.ready.then(
      () => current && setLoaded(runtime),
      (error: unknown) => current && setLoadError(error),
    );
    return () => {
      current = false;
    };
  }, [runtime]);
  if (loadError) throw loadError;
  const clock = runtime.simulation;

  const roomId = useStore(store, () => runtime.roomId);
  const localControllerUrl = useStore(
    store,
    (state) => state.localControllerUrl,
  );
  const joinUrl = useStore(store, (state) => state.joinUrl);
  const joinUrlStatus = useStore(store, (state) => state.joinUrlStatus);

  return useMemo(
    () => ({
      roomId: roomId ?? ("" as RoomCode),
      localControllerUrl,
      joinUrl,
      joinUrlStatus,
      pauseRuntime: runtime.pauseRuntime,
      resumeRuntime: runtime.resumeRuntime,
      setRuntimeState: runtime.setRuntimeState,
      sendState: runtime.sendState,
      sendSignal: runtime.sendSignal,
      reconnect: runtime.reconnect,
      removeController: runtime.removeController,
      resetRoom: runtime.resetRoom,
      socket: runtime.socket,
      simulation: clock,
      setObservationCapture: runtime.setObservationCapture,
      settings: runtime.settings,
    }),
    [runtime, roomId, localControllerUrl, joinUrl, joinUrlStatus, clock],
  );
};

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

  const { config, store } = useAirJamContext();

  const { publicHost, ...sessionTopology } = config.topology;
  const { reportError, ...serializableConfig } = config;
  const sessionConfigKey = JSON.stringify({
    ...serializableConfig,
    topology: sessionTopology,
  });
  const sessionConfig = useMemo(
    () => ({
      ...(JSON.parse(sessionConfigKey) as typeof config),
      reportError,
    }),
    [sessionConfigKey, reportError],
  );

  const runtime = useMemo(
    () =>
      new HostRuntime(
        {
          fixedControllerOrientation,
          config: sessionConfig,
          store,
          input,
          environment: createBrowserHostEnvironment(sessionConfig),
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
  const room = useStore(store, () => runtime.room);
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
      sendSignal: runtime.sendSignal,
      removeController: runtime.removeController,
      setPlayerColor: runtime.setPlayerColor,
      setRoomLocked: runtime.setRoomLocked,
      resetRoom: runtime.resetRoom,
      room,
      simulation: clock,
      setObservationCapture: runtime.setObservationCapture,
      playSoundOnControllers: runtime.playSoundOnControllers,
      settings: runtime.settings,
    }),
    [runtime, roomId, room, localControllerUrl, joinUrl, joinUrlStatus, clock],
  );
};

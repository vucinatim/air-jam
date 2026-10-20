import { useEffect, useMemo } from "react";
import type { z } from "zod";
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
import type { RoomCode } from "../../protocol";
import { createBrowserHostEnvironment } from "../../runtime/browser-host-environment";
import type {
  AirJamHostOptions,
  AirJamHostRuntimeControls,
} from "../use-air-jam-host";

/** What the game declares for its host runtime. */
export type HostGameDeclaration = Pick<
  HostRuntimeDependencies,
  "stores" | "simulation" | "agent"
>;

/** Binds one core host runtime to this provider tree for as long as it is mounted. */
export const useHostRuntimeApi = <TSchema extends z.ZodSchema = z.ZodSchema>(
  options: AirJamHostOptions,
  hookName: string,
  { stores, simulation, agent }: HostGameDeclaration,
): AirJamHostRuntimeControls<TSchema> => {
  useAssertSessionScope("host", hookName);
  useClaimSessionRuntimeOwner("host-runtime", hookName);

  const { config, store, getSocket, disconnectSocket, input } =
    useAirJamContext();

  const runtime = useMemo(
    () =>
      new HostRuntime<TSchema>({
        config,
        store,
        getSocket,
        disconnectSocket,
        input: input as HostRuntimeDependencies<TSchema>["input"],
        environment: createBrowserHostEnvironment(config),
        stores,
        simulation,
        agent,
      }),
    [
      config,
      store,
      getSocket,
      disconnectSocket,
      input,
      stores,
      simulation,
      agent,
    ],
  );

  // Declared before start so the runtime starts with the current options.
  useEffect(() => {
    runtime.setOptions({
      roomId: options.roomId,
      onPlayerJoin: options.onPlayerJoin,
      onPlayerLeave: options.onPlayerLeave,
    });
  }, [runtime, options.roomId, options.onPlayerJoin, options.onPlayerLeave]);

  useEffect(() => runtime.start(), [runtime]);

  const roomId = useStore(store, () => runtime.roomId);
  const joinUrl = useStore(store, (state) => state.joinUrl);
  const joinUrlStatus = useStore(store, (state) => state.joinUrlStatus);

  return useMemo(
    () => ({
      roomId: roomId ?? ("" as RoomCode),
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
      getInput: runtime.getInput,
      simulation: runtime.simulation,
      setObservationCapture: runtime.setObservationCapture,
    }),
    [runtime, roomId, joinUrl, joinUrlStatus],
  );
};

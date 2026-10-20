import { useEffect, useMemo } from "react";
import type { z } from "zod";
import { useStore } from "zustand";
import { useAirJamContext } from "../../context/air-jam-context";
import {
  useAssertSessionScope,
  useClaimSessionRuntimeOwner,
} from "../../context/session-scope";
import { HostRuntime } from "../../core/host-runtime";
import type { AttachableStore } from "../../core/replicated-store";
import type { AirJamSimulation } from "../../core/simulation";
import type { RoomCode } from "../../protocol";
import { createBrowserHostEnvironment } from "../../runtime/browser-host-environment";
import type {
  AirJamHostOptions,
  AirJamHostRuntimeControls,
} from "../use-air-jam-host";

/** Binds one core host runtime to this provider tree for as long as it is mounted. */
export const useHostRuntimeApi = <TSchema extends z.ZodSchema = z.ZodSchema>(
  options: AirJamHostOptions,
  hookName: string,
  stores: readonly AttachableStore[],
  simulation: AirJamSimulation<unknown, unknown, unknown> | undefined,
): AirJamHostRuntimeControls<TSchema> => {
  useAssertSessionScope("host", hookName);
  useClaimSessionRuntimeOwner("host-runtime", hookName);

  const { config, store, getSocket, disconnectSocket, inputManager } =
    useAirJamContext();

  const runtime = useMemo(
    () =>
      new HostRuntime<TSchema>({
        config,
        store,
        getSocket,
        disconnectSocket,
        inputManager: inputManager as HostRuntime<TSchema>["inputManager"],
        environment: createBrowserHostEnvironment(config),
        stores,
        simulation,
      }),
    [
      config,
      store,
      getSocket,
      disconnectSocket,
      inputManager,
      stores,
      simulation,
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
    }),
    [runtime, roomId, joinUrl, joinUrlStatus],
  );
};

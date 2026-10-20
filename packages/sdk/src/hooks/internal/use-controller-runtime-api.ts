import { useEffect, useMemo } from "react";
import { useAirJamContext } from "../../context/air-jam-context";
import {
  useAssertSessionScope,
  useClaimSessionRuntimeOwner,
} from "../../context/session-scope";
import { ControllerRuntime } from "../../core/controller-runtime";
import type { AttachableStore } from "../../core/replicated-store";
import {
  createBrowserControllerEnvironment,
  listenForPreviewClose,
} from "../../runtime/browser-controller-environment";
import type {
  AirJamControllerOptions,
  AirJamControllerRuntimeControls,
} from "../use-air-jam-controller";

/** Binds one core controller runtime to this provider tree for as long as it is mounted. */
export const useControllerRuntimeApi = (
  options: AirJamControllerOptions,
  hookName: string,
  stores: readonly AttachableStore[],
): AirJamControllerRuntimeControls => {
  useAssertSessionScope("controller", hookName);
  useClaimSessionRuntimeOwner("controller-runtime", hookName);

  const { store, getSocket, disconnectSocket } = useAirJamContext();
  const { roomId, controllerId, capabilityToken } = options;

  const runtime = useMemo(
    () =>
      new ControllerRuntime(
        {
          store,
          getSocket,
          disconnectSocket,
          environment: createBrowserControllerEnvironment(),
          stores,
        },
        { roomId, controllerId, capabilityToken },
      ),
    [
      store,
      getSocket,
      disconnectSocket,
      stores,
      roomId,
      controllerId,
      capabilityToken,
    ],
  );

  // Declared before start so the runtime joins with the current profile.
  useEffect(
    () => runtime.setNickname(options.nickname ?? ""),
    [runtime, options.nickname],
  );
  useEffect(
    () => runtime.setAvatarId(options.avatarId ?? ""),
    [runtime, options.avatarId],
  );
  useEffect(
    () => runtime.setStateListener(options.onState),
    [runtime, options.onState],
  );

  useEffect(() => runtime.start(), [runtime]);

  useEffect(
    () => listenForPreviewClose(runtime, disconnectSocket),
    [runtime, disconnectSocket],
  );

  return useMemo(
    () => ({
      sendSystemCommand: runtime.sendSystemCommand,
      setNickname: runtime.setNickname,
      setAvatarId: runtime.setAvatarId,
      updatePlayerProfile: runtime.updatePlayerProfile,
      leave: runtime.leave,
      reconnect: runtime.reconnect,
      socket: runtime.socket,
    }),
    [runtime],
  );
};

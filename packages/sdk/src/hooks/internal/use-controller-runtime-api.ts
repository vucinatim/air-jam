import { useEffect, useMemo } from "react";
import {
  useAirJamConfig,
  useAirJamContext,
} from "../../context/air-jam-context";
import {
  useAssertSessionScope,
  useClaimSessionRuntimeOwner,
} from "../../context/session-scope";
import { ControllerRuntime } from "../../core/controller-runtime";
import type { AirJamInput } from "../../core/input";
import type { AttachableStore } from "../../core/replicated-store";
import {
  createBrowserControllerEnvironment,
  listenForPreviewClose,
} from "../../runtime/browser-controller-environment";
import {
  listenForLocalSeatInput,
  readLocalSeatLabel,
} from "../../runtime/local-seats";
import type {
  AirJamControllerOptions,
  AirJamControllerRuntimeControls,
} from "../use-air-jam-controller";

/** Binds one core controller runtime to this provider tree for as long as it is mounted. */
export const useControllerRuntimeApi = (
  options: AirJamControllerOptions,
  hookName: string,
  stores: readonly AttachableStore[],
  input: AirJamInput | undefined,
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
          input,
        },
        { roomId, controllerId, capabilityToken },
      ),
    [
      store,
      getSocket,
      disconnectSocket,
      stores,
      input,
      roomId,
      controllerId,
      capabilityToken,
    ],
  );

  // Declared before start so the runtime joins with the current profile.
  useEffect(
    () => runtime.setNickname(options.nickname ?? readLocalSeatLabel() ?? ""),
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

  // A phone that loses focus can no longer release what it holds.
  useEffect(() => {
    const controls = runtime.input;
    if (!controls) return;
    const release = () => controls.releaseAll();
    const releaseWhenHidden = () => {
      if (document.hidden) release();
    };
    window.addEventListener("blur", release);
    document.addEventListener("visibilitychange", releaseWhenHidden);
    return () => {
      window.removeEventListener("blur", release);
      document.removeEventListener("visibilitychange", releaseWhenHidden);
    };
  }, [runtime]);

  useEffect(
    () => listenForPreviewClose(runtime, disconnectSocket),
    [runtime, disconnectSocket],
  );

  // A local player's phone takes its keys or gamepad from the host page.
  const { topology } = useAirJamConfig();
  useEffect(
    () => listenForLocalSeatInput(runtime.input, topology),
    [runtime, topology],
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
      input: runtime.input,
    }),
    [runtime],
  );
};

import { useEffect, useMemo } from "react";
import { useStore } from "zustand";
import { useAirJamContext } from "../../context/air-jam-context";
import {
  useAssertSessionScope,
  useClaimSessionRuntimeOwner,
} from "../../context/session-scope";
import { ControllerRuntime } from "../../core/controller-runtime";
import type { AirJamInput } from "../../core/input";
import type { AttachableStore } from "../../core/replicated-store";
import {
  createBrowserControllerEnvironment,
  followPreviewParent,
} from "../../runtime/browser-controller-environment";
import { publishEmbeddedControllerAgent } from "../../runtime/controller-agent-bridge";
import { listenForLocalSeatInput } from "../../runtime/local-seats";
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

  const { config, store } = useAirJamContext();
  const { roomId } = options;

  const runtime = useMemo(
    () =>
      new ControllerRuntime(
        {
          store,
          environment: createBrowserControllerEnvironment(config),
          stores,
          input,
        },
        { roomId },
      ),
    [config, store, stores, input, roomId],
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

  useEffect(() => runtime.start(), [runtime]);
  useEffect(() => publishEmbeddedControllerAgent(runtime), [runtime]);

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

  useEffect(() => followPreviewParent(runtime), [runtime]);

  // A local player's phone takes its keys or gamepad from the host page.
  useEffect(() => listenForLocalSeatInput(runtime.input), [runtime]);

  const session = useStore(store, () => runtime.session);

  return useMemo(
    () => ({
      sendSystemCommand: runtime.sendSystemCommand,
      setNickname: runtime.setNickname,
      setAvatarId: runtime.setAvatarId,
      updatePlayerProfile: runtime.updatePlayerProfile,
      leave: runtime.leave,
      session,
      input: runtime.input,
    }),
    [runtime, session],
  );
};

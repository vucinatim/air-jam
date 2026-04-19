import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useStore } from "zustand";
import { useAirJamContext } from "../context/air-jam-context";
import { useAssertSessionScope } from "../context/session-scope";
import type { PlaySoundPayload } from "../protocol";
import { getControllerRealtimeClient } from "../runtime/controller-realtime-client";
import { getHostRealtimeClient } from "../runtime/host-realtime-client";
import { useResolvedPlatformSettingsSnapshot } from "../settings/platform-settings-runtime";
import {
  AudioManager,
  type AudioHandle,
  type SoundManifest,
} from "./audio-manager";

let globalInitialized = false;
const audioManagerContext = createContext<AudioHandle<string> | null>(null);
const audioRuntimeStatusContext = createContext<AudioRuntimeStatus | null>(
  null,
);
const audioRuntimeControlsContext = createContext<AudioRuntimeControls | null>(
  null,
);

export type AudioRuntimeStatus = "idle" | "blocked" | "ready";

export interface AudioRuntimeControls {
  retry: () => Promise<boolean>;
}

export interface AudioRuntimeProps<M extends SoundManifest = SoundManifest> {
  manifest: M;
  children: ReactNode;
}

export function AudioRuntime<M extends SoundManifest>({
  manifest,
  children,
}: AudioRuntimeProps<M>) {
  const { manager, status, controls } = useOwnedAudio(manifest);

  return (
    <audioRuntimeStatusContext.Provider value={status}>
      <audioRuntimeControlsContext.Provider value={controls}>
        <audioManagerContext.Provider value={manager as AudioHandle<string>}>
          {children}
        </audioManagerContext.Provider>
      </audioRuntimeControlsContext.Provider>
    </audioRuntimeStatusContext.Provider>
  );
}

export interface ControllerRemoteAudioRuntimeProps<
  M extends SoundManifest = SoundManifest,
> extends AudioRuntimeProps<M> {
  enabled?: boolean;
}

export function ControllerRemoteAudioRuntime<M extends SoundManifest>({
  manifest,
  enabled = true,
  children,
}: ControllerRemoteAudioRuntimeProps<M>) {
  const { manager, status, controls } = useOwnedAudio(manifest);

  useRemoteSound(manifest, manager, { enabled });

  return (
    <audioRuntimeStatusContext.Provider value={status}>
      <audioRuntimeControlsContext.Provider value={controls}>
        <audioManagerContext.Provider value={manager as AudioHandle<string>}>
          {children}
        </audioManagerContext.Provider>
      </audioRuntimeControlsContext.Provider>
    </audioRuntimeStatusContext.Provider>
  );
}

export function useAudio<T extends string = string>(): AudioHandle<T> {
  const manager = useContext(audioManagerContext);

  if (!manager) {
    throw new Error(
      "useAudio must be used within an AudioRuntime or ControllerRemoteAudioRuntime",
    );
  }

  return manager as AudioHandle<T>;
}

export function useAudioRuntimeStatus(): AudioRuntimeStatus {
  const status = useContext(audioRuntimeStatusContext);

  if (!status) {
    throw new Error(
      "useAudioRuntimeStatus must be used within an AudioRuntime or ControllerRemoteAudioRuntime",
    );
  }

  return status;
}

export function useAudioRuntimeControls(): AudioRuntimeControls {
  const controls = useContext(audioRuntimeControlsContext);

  if (!controls) {
    throw new Error(
      "useAudioRuntimeControls must be used within an AudioRuntime or ControllerRemoteAudioRuntime",
    );
  }

  return controls;
}

function useOwnedAudio<M extends SoundManifest>(
  manifest: M,
): {
  manager: AudioManager<keyof M & string>;
  status: AudioRuntimeStatus;
  controls: AudioRuntimeControls;
} {
  const { store, getSocket } = useAirJamContext();
  const roomId = useStore(store, (state) => state.roomId);
  const role = useStore(store, (state) => state.role);
  const platformSettings = useResolvedPlatformSettingsSnapshot();
  type SoundId = keyof M & string;
  const manager = useMemo(
    () => new AudioManager<SoundId>(manifest),
    [manifest],
  );
  const [status, setStatus] = useState<AudioRuntimeStatus>(() =>
    globalInitialized ? "ready" : "idle",
  );

  const retry = useCallback(async () => {
    const ready = await manager.init();
    if (ready) {
      globalInitialized = true;
      setStatus("ready");
      return true;
    }

    setStatus((current) => (current === "ready" ? current : "blocked"));
    return false;
  }, [manager]);

  useEffect(() => {
    manager.applyPlatformAudioSettings(platformSettings.audio);
  }, [manager, platformSettings.audio]);

  useEffect(() => {
    if (role && roomId) {
      const socket =
        role === "controller"
          ? getControllerRealtimeClient((runtimeRole) => getSocket(runtimeRole))
          : getHostRealtimeClient((runtimeRole) => getSocket(runtimeRole));
      manager.setSocket(socket, roomId, role);
    }
  }, [manager, role, roomId, getSocket]);

  useEffect(() => {
    return () => {
      manager.destroy();
    };
  }, [manager]);

  useEffect(() => {
    void retry();
  }, [retry]);

  useEffect(() => {
    if (status === "ready") {
      return;
    }

    const handleInteraction = () => {
      void retry();
    };

    window.addEventListener("click", handleInteraction);
    window.addEventListener("touchstart", handleInteraction);
    window.addEventListener("keydown", handleInteraction);
    window.addEventListener("pointerdown", handleInteraction);
    window.addEventListener("mousedown", handleInteraction);

    return () => {
      window.removeEventListener("click", handleInteraction);
      window.removeEventListener("touchstart", handleInteraction);
      window.removeEventListener("keydown", handleInteraction);
      window.removeEventListener("pointerdown", handleInteraction);
      window.removeEventListener("mousedown", handleInteraction);
    };
  }, [retry, status]);

  return {
    manager,
    status,
    controls: {
      retry,
    },
  };
}

const isManifestSoundId = <M extends SoundManifest>(
  manifest: M,
  soundId: unknown,
): soundId is keyof M & string =>
  typeof soundId === "string" &&
  Object.prototype.hasOwnProperty.call(manifest, soundId);

export interface UseRemoteSoundOptions {
  enabled?: boolean;
}

function useRemoteSound<M extends SoundManifest>(
  manifest: M,
  audio: Pick<AudioHandle<keyof M & string>, "play">,
  options: UseRemoteSoundOptions = {},
): void {
  useAssertSessionScope("controller", "useRemoteSound");

  const { getSocket } = useAirJamContext();
  const socket = useMemo(
    () => getControllerRealtimeClient((role) => getSocket(role)),
    [getSocket],
  );
  const enabled = options.enabled ?? true;

  useEffect(() => {
    if (!socket || !enabled) {
      return;
    }

    const handlePlaySound = (payload: PlaySoundPayload): void => {
      if (!isManifestSoundId(manifest, payload.id)) {
        return;
      }

      audio.play(payload.id, {
        volume: payload.volume,
        loop: payload.loop,
      });
    };

    socket.on("server:playSound", handlePlaySound);
    return () => {
      socket.off("server:playSound", handlePlaySound);
    };
  }, [audio, enabled, manifest, socket]);
}

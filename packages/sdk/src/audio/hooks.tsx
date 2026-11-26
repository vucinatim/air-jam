import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useState,
  type ReactNode,
} from "react";
import type { AirJamControllerRuntimeControls } from "../hooks/use-air-jam-controller";
import type { AirJamHostRuntimeControls } from "../hooks/use-air-jam-host";
import { parseAirJamSignal } from "../room-protocol";
import {
  controllerRuntimeContext,
  hostRuntimeContext,
} from "../runtime/runtime-owner-contexts";
import {
  useAirJamSurfaceSettings,
  usePlatformSettingsRuntimeStatus,
} from "../settings/platform-settings-runtime";
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
  const [manager, setManager] = useState<AudioManager<keyof M & string> | null>(
    null,
  );

  // Nested host drawing and capture hooks must mount within this layout commit.
  useLayoutEffect(() => {
    const manager = new AudioManager<keyof M & string>(manifest);
    setManager(manager);
    return () => manager.destroy();
  }, [manifest]);

  if (!manager) {
    return null;
  }

  return (
    <MountedAudioRuntime manifest={manifest} manager={manager}>
      {children}
    </MountedAudioRuntime>
  );
}

function MountedAudioRuntime<M extends SoundManifest>({
  manifest,
  manager,
  children,
}: AudioRuntimeProps<M> & { manager: AudioManager<keyof M & string> }) {
  const { status, controls } = useAudioRuntimeState(manager);

  useRemoteSound(manifest, manager);

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
    throw new Error("useAudio must be used within an AudioRuntime");
  }

  return manager as AudioHandle<T>;
}

export function useAudioRuntimeStatus(): AudioRuntimeStatus {
  const status = useContext(audioRuntimeStatusContext);

  if (!status) {
    throw new Error(
      "useAudioRuntimeStatus must be used within an AudioRuntime",
    );
  }

  return status;
}

export function useAudioRuntimeControls(): AudioRuntimeControls {
  const controls = useContext(audioRuntimeControlsContext);

  if (!controls) {
    throw new Error(
      "useAudioRuntimeControls must be used within an AudioRuntime",
    );
  }

  return controls;
}

function useAudioRuntimeState(manager: AudioManager): {
  status: AudioRuntimeStatus;
  controls: AudioRuntimeControls;
} {
  const host = useContext(
    hostRuntimeContext,
  ) as AirJamHostRuntimeControls | null;
  const platformSettings = useAirJamSurfaceSettings();
  const platformSettingsStatus = usePlatformSettingsRuntimeStatus();
  const platformSettingsReady = platformSettingsStatus === "ready";
  const [status, setStatus] = useState<AudioRuntimeStatus>(() =>
    globalInitialized && platformSettingsReady ? "ready" : "idle",
  );

  const retry = useCallback(async () => {
    if (!platformSettingsReady) {
      setStatus("idle");
      return false;
    }

    const ready = await manager.init();
    if (ready) {
      globalInitialized = true;
      setStatus("ready");
      return true;
    }

    setStatus((current) => (current === "ready" ? current : "blocked"));
    return false;
  }, [manager, platformSettingsReady]);

  useEffect(() => {
    if (!platformSettingsReady) {
      return;
    }

    manager.applyAudioLevels(platformSettings.audio);
  }, [manager, platformSettings.audio, platformSettingsReady]);

  useEffect(() => {
    if (platformSettingsReady) {
      return;
    }

    setStatus("idle");
  }, [platformSettingsReady]);

  useEffect(() => {
    manager.setControllerSounds(host?.playSoundOnControllers ?? null);
    return () => manager.setControllerSounds(null);
  }, [manager, host]);

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

function useRemoteSound<M extends SoundManifest>(
  manifest: M,
  audio: Pick<AudioHandle<keyof M & string>, "play">,
): void {
  const session =
    (
      useContext(
        controllerRuntimeContext,
      ) as AirJamControllerRuntimeControls | null
    )?.session ?? null;

  useEffect(() => {
    if (!session) {
      return;
    }

    return session.on("signal", (received) => {
      const signal = parseAirJamSignal(received);
      if (signal?.kind !== "sound") return;
      if (!isManifestSoundId(manifest, signal.payload.soundId)) return;
      audio.play(signal.payload.soundId, {
        volume: signal.payload.volume,
        loop: signal.payload.loop,
      });
    });
  }, [audio, manifest, session]);
}

import {
  ControllerRemoteAudioRuntime,
  PlatformSettingsRuntime,
  useAudio,
  type AudioHandle,
  type PlayOptions,
} from "@air-jam/sdk";
import { useMemo, type ReactNode } from "react";
import {
  CONTROLLER_SOUND_MANIFEST,
  type ControllerSoundId,
} from "./sounds";

type ControllerAudioDriver = Pick<
  AudioHandle<ControllerSoundId>,
  "init" | "isMuted" | "mute" | "play" | "stop"
>;

export interface ControllerAudioFacade {
  init(): Promise<boolean>;
  isMuted(): boolean;
  mute(muted: boolean): void;
  play(id: ControllerSoundId, options?: PlayOptions): number | null;
  stop(id?: ControllerSoundId, soundId?: number): void;
}

export function createControllerAudioFacade(
  audio: ControllerAudioDriver,
): ControllerAudioFacade {
  return {
    init: () => audio.init(),
    isMuted: () => audio.isMuted(),
    mute: (muted) => audio.mute(muted),
    play: (id, options) => audio.play(id, options),
    stop: (id, soundId) => audio.stop(id, soundId),
  };
}

export function ControllerAudioProvider({
  children,
  remoteEnabled,
}: {
  children: ReactNode;
  remoteEnabled: boolean;
}) {
  return (
    <PlatformSettingsRuntime>
      <ControllerRemoteAudioRuntime
        manifest={CONTROLLER_SOUND_MANIFEST}
        enabled={remoteEnabled}
      >
        {children}
      </ControllerRemoteAudioRuntime>
    </PlatformSettingsRuntime>
  );
}

export function useControllerAudio(): ControllerAudioFacade {
  const audio = useAudio<ControllerSoundId>();
  return useMemo(() => createControllerAudioFacade(audio), [audio]);
}

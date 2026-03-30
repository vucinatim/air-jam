import {
  AudioProvider,
  useAudio,
  useProvidedAudio,
  useRemoteSound,
  type AudioManager,
  type PlayOptions,
} from "@air-jam/sdk";
import { useMemo, type ReactNode } from "react";
import {
  CONTROLLER_SOUND_MANIFEST,
  type ControllerSoundId,
} from "./sounds";

type ControllerAudioDriver = Pick<
  AudioManager<ControllerSoundId>,
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
  const audio = useAudio(CONTROLLER_SOUND_MANIFEST);

  useRemoteSound(CONTROLLER_SOUND_MANIFEST, audio, {
    enabled: remoteEnabled,
  });

  return <AudioProvider manager={audio}>{children}</AudioProvider>;
}

export function useControllerAudio(): ControllerAudioFacade {
  const audio = useProvidedAudio<ControllerSoundId>();
  return useMemo(() => createControllerAudioFacade(audio), [audio]);
}

import { useAudio, type AudioHandle, type PlayOptions } from "@air-jam/sdk";
import { useMemo } from "react";
import type { ControllerSoundId } from "./sounds";

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

export function useControllerAudio(): ControllerAudioFacade {
  const audio = useAudio<ControllerSoundId>();
  return useMemo(() => createControllerAudioFacade(audio), [audio]);
}

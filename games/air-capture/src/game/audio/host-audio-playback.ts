import { type AudioHandle, type PlayOptions } from "@air-jam/sdk";
import { type HostSfxId } from "./sounds";

type HostAudioDriver = Pick<
  AudioHandle<HostSfxId>,
  "init" | "isMuted" | "mute" | "play" | "stop"
>;

export interface HostAudioFacade {
  init(): Promise<boolean>;
  isMuted(): boolean;
  mute(muted: boolean): void;
  play(id: HostSfxId, options?: PlayOptions): number | null;
  stop(id?: HostSfxId, soundId?: number): void;
}

export function createHostAudioFacade(audio: HostAudioDriver): HostAudioFacade {
  return {
    init: () => audio.init(),
    isMuted: () => audio.isMuted(),
    mute: (muted) => audio.mute(muted),
    play: (id, options) => audio.play(id, options),
    stop: (id, soundId) => audio.stop(id, soundId),
  };
}

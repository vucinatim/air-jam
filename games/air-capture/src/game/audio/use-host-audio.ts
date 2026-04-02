import { useAudio } from "@air-jam/sdk";
import { useMemo } from "react";
import {
  createHostAudioFacade,
  type HostAudioFacade,
} from "./host-audio-playback";
import type { HostSfxId } from "./sounds";

export function useHostAudio(): HostAudioFacade {
  const audio = useAudio<HostSfxId>();
  return useMemo(() => createHostAudioFacade(audio), [audio]);
}

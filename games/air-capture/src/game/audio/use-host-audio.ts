import { useAudio } from "@air-jam/sdk";
import { useMemo } from "react";
import type { HostSfxId } from "../assets";
import {
  createHostAudioFacade,
  type HostAudioFacade,
} from "./host-audio-playback";

export function useHostAudio(): HostAudioFacade {
  const audio = useAudio<HostSfxId>();
  return useMemo(() => createHostAudioFacade(audio), [audio]);
}

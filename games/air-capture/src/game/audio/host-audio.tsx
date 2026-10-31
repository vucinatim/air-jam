import { MusicPlaylist, useAudio } from "@air-jam/sdk";
import { useEffect, useMemo, type ReactNode } from "react";
import { HOST_MUSIC_TRACKS, type HostSfxId } from "../assets";
import { createHostAudioFacade } from "./host-audio-playback";

export function HostAudioProvider({
  children,
  muted,
}: {
  children: ReactNode;
  muted: boolean;
}) {
  const sfxAudio = useAudio<HostSfxId>();
  const facade = useMemo(() => createHostAudioFacade(sfxAudio), [sfxAudio]);

  useEffect(() => {
    facade.mute(muted);
  }, [facade, muted]);

  return (
    <>
      <MusicPlaylist
        fadeMs={1200}
        order="shuffle"
        playing={!muted}
        tracks={HOST_MUSIC_TRACKS}
      />
      {children}
    </>
  );
}

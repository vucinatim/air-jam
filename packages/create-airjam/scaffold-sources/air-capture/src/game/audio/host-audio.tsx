import {
  AudioRuntime,
  MusicPlaylist,
  useAudio,
  useAudioRuntimeControls,
  useAudioRuntimeStatus,
} from "@air-jam/sdk";
import { useEffect, useMemo, type ReactNode } from "react";
import { createHostAudioFacade } from "./host-audio-playback";
import {
  HOST_AUDIO_MANIFEST,
  HOST_MUSIC_TRACKS,
  type HostSfxId,
} from "./sounds";

export function HostAudioProvider({
  children,
  muted,
}: {
  children: ReactNode;
  muted: boolean;
}) {
  return (
    <AudioRuntime manifest={HOST_AUDIO_MANIFEST}>
      <HostAudioLifecycle muted={muted}>{children}</HostAudioLifecycle>
    </AudioRuntime>
  );
}

function HostAudioLifecycle({
  children,
  muted,
}: {
  children: ReactNode;
  muted: boolean;
}) {
  const sfxAudio = useAudio<HostSfxId>();
  const audioRuntimeStatus = useAudioRuntimeStatus();
  const audioRuntimeControls = useAudioRuntimeControls();
  const facade = useMemo(() => createHostAudioFacade(sfxAudio), [sfxAudio]);

  useEffect(() => {
    facade.mute(muted);
  }, [facade, muted]);

  useEffect(() => {
    void audioRuntimeControls.retry();
  }, [audioRuntimeControls]);

  return (
    <>
      <MusicPlaylist
        fadeMs={1200}
        order="shuffle"
        playing={audioRuntimeStatus === "ready" && !muted}
        tracks={HOST_MUSIC_TRACKS}
      />
      {children}
    </>
  );
}

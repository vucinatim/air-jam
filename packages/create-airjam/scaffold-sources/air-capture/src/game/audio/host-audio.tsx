import {
  AudioRuntime,
  PlatformSettingsRuntime,
  useAudio,
  useAudioRuntimeControls,
  useAudioRuntimeStatus,
  useInheritedPlatformSettings,
} from "@air-jam/sdk";
import { useEffect, useMemo, useRef, type ReactNode } from "react";
import {
  createHostAudioFacade,
  createHostMusicDriver,
  createRotatingMusicPlayback,
  type RotatingMusicPlayback,
} from "./host-audio-playback";
import { HOST_SFX_MANIFEST, type HostSfxId } from "./sounds";

export function HostAudioProvider({
  children,
  muted,
}: {
  children: ReactNode;
  muted: boolean;
}) {
  return (
    <PlatformSettingsRuntime>
      <AudioRuntime manifest={HOST_SFX_MANIFEST}>
        <HostAudioLifecycle muted={muted}>{children}</HostAudioLifecycle>
      </AudioRuntime>
    </PlatformSettingsRuntime>
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
  const platformSettings = useInheritedPlatformSettings();
  const facade = useMemo(() => createHostAudioFacade(sfxAudio), [sfxAudio]);
  const musicAudioRef = useRef<ReturnType<typeof createHostMusicDriver> | null>(
    null,
  );
  if (!musicAudioRef.current) {
    musicAudioRef.current = createHostMusicDriver();
  }
  const musicAudio = musicAudioRef.current;
  const musicPlaybackRef = useRef<RotatingMusicPlayback | null>(null);

  if (!musicPlaybackRef.current) {
    musicPlaybackRef.current = createRotatingMusicPlayback(musicAudio);
  }

  useEffect(() => {
    facade.mute(muted);
    musicAudio.setMuted(muted);
    musicPlaybackRef.current?.sync(audioRuntimeStatus === "ready" && !muted);
  }, [audioRuntimeStatus, facade, musicAudio, muted]);

  useEffect(() => {
    musicAudio.applyPlatformAudioSettings(platformSettings.audio);
  }, [musicAudio, platformSettings.audio]);

  useEffect(() => {
    void audioRuntimeControls.retry();
  }, [audioRuntimeControls]);

  useEffect(() => {
    return () => {
      musicPlaybackRef.current?.dispose();
      musicAudio.destroy();
    };
  }, [musicAudio]);

  return <>{children}</>;
}

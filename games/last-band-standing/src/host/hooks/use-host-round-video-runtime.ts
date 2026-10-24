import { useAirJamHost, useAirJamStore } from "@air-jam/sdk";
import { useMemo } from "react";
import { getSongById } from "../../game/content/song-bank";
import { toShellMatchPhase } from "../../game/domain/match-phase";
import { gameStore } from "../../game/stores";
import { getYouTubeEmbedUrl, useYouTubePlayer } from "../youtube";
import { useHostAudioCues } from "./use-host-audio-cues";
import { useHostPlayerSync } from "./use-host-player-sync";

export function useHostRoundVideoRuntime() {
  const host = useAirJamHost();
  const players = useAirJamHost((state) => state.players);
  const connectionStatus = useAirJamHost((state) => state.connectionStatus);
  const runtimeState = useAirJamHost((state) => state.runtimeState);

  const phase = useAirJamStore(gameStore, (state) => state.phase);
  const revealDurationSec = useAirJamStore(
    gameStore,
    (state) => state.revealDurationSec,
  );
  const currentRound = useAirJamStore(gameStore, (state) => state.currentRound);
  const roundReveal = useAirJamStore(gameStore, (state) => state.roundReveal);
  const secondsLeft = useAirJamStore(gameStore, (state) => state.secondsLeft);
  const actions = gameStore.actions;

  const activeSong = useMemo(() => {
    if (phase === "round-active" && currentRound) {
      return getSongById(currentRound.songId);
    }

    if (phase === "round-reveal" && roundReveal) {
      return getSongById(roundReveal.songId);
    }

    return null;
  }, [phase, currentRound, roundReveal]);

  const activeClipStartSeconds =
    currentRound?.clipStartSeconds ?? roundReveal?.clipStartSeconds ?? null;
  const embedUrl = activeSong
    ? getYouTubeEmbedUrl(activeSong.youtubeUrl, true, activeClipStartSeconds)
    : null;

  useHostPlayerSync(players, actions, connectionStatus === "connected");

  const hostAudio = useHostAudioCues({ phase, roundReveal, secondsLeft });

  const { youtubePlayerRef, onIframeLoad } = useYouTubePlayer({
    phase,
    embedUrl,
    muted: hostAudio.muted,
    currentRound,
    roundReveal,
    revealDurationSec,
    skipRound: actions.skipRound,
  });

  const shellPhase = toShellMatchPhase(phase);
  const showVideo = shellPhase === "playing" && activeSong && embedUrl;
  const videoStage = showVideo
    ? {
        activeSong,
        embedUrl,
        youtubePlayerRef,
        onIframeLoad,
      }
    : null;

  return {
    host,
    runtimeState,
    phase,
    shellPhase,
    actions,
    hostAudio,
    videoStage,
  };
}

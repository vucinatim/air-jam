import { useAirJamHost } from "@air-jam/sdk";
import { useMemo } from "react";
import { NOW_TICK_MS } from "../../game/constants";
import { getSongById } from "../../game/content/song-bank";
import { toShellMatchPhase } from "../../game/domain/match-phase";
import { useNowTick } from "../../game/hooks/use-now-tick";
import { useGameStore } from "../../game/stores";
import { getYouTubeEmbedUrl, useYouTubePlayer } from "../youtube";
import { useHostAudioCues } from "./use-host-audio-cues";
import { useHostPlayerSync } from "./use-host-player-sync";
import { useHostRoundEffects } from "./use-host-round-effects";

export function useHostRoundVideoRuntime() {
  const host = useAirJamHost();
  const players = useAirJamHost((state) => state.players);
  const runtimeState = useAirJamHost((state) => state.runtimeState);
  const nowMs = useNowTick(NOW_TICK_MS);

  const phase = useGameStore((state) => state.phase);
  const revealDurationSec = useGameStore((state) => state.revealDurationSec);
  const currentRound = useGameStore((state) => state.currentRound);
  const roundReveal = useGameStore((state) => state.roundReveal);
  const actions = useGameStore.useActions();

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

  const countdownSeconds = currentRound
    ? Math.max(0, Math.ceil((currentRound.endsAtMs - nowMs) / 1000))
    : 0;
  const matchCountdownSeconds =
    phase === "match-countdown" && currentRound
      ? Math.max(0, Math.ceil((currentRound.startedAtMs - nowMs) / 1000))
      : 0;

  useHostPlayerSync(players, actions);
  useHostRoundEffects({ actions, phase, currentRound, roundReveal });

  const hostAudio = useHostAudioCues({
    phase,
    roundReveal,
    matchCountdownSeconds,
    countdownSeconds,
  });

  const { youtubePlayerRef, onIframeLoad } = useYouTubePlayer({
    phase,
    embedUrl,
    muted: hostAudio.muted,
    currentRound,
    roundReveal,
    revealDurationSec,
    finalizeRound: actions.finalizeRound,
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

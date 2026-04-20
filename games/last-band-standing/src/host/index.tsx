/**
 * Host surface for last-band-standing.
 *
 * This host drives a round-based music quiz: a YouTube clip plays on the
 * main screen, controllers buzz in, and the host advances the round
 * lifecycle through the networked `useGameStore`. The YouTube player
 * wrapper in `./youtube` handles cued playback without exposing
 * the iframe API directly to the rest of the code.
 */
import { AudioRuntime, useAirJamHost } from "@air-jam/sdk";
import { HostPreviewControllerWorkspace } from "@air-jam/sdk/preview";
import { HostMuteButton, SurfaceViewport } from "@air-jam/sdk/ui";
import { VisualHarnessRuntime } from "@air-jam/visual-harness/runtime";
import { AnimatePresence } from "framer-motion";
import { useMemo } from "react";
import { lastBandStandingVisualHarnessBridge } from "../../visual/contract";
import { NOW_TICK_MS } from "../game/constants";
import { getSongById } from "../game/content/song-bank";
import { gameInputSchema } from "../game/contracts/input";
import { soundManifest } from "../game/contracts/sounds";
import { toShellMatchPhase } from "../game/domain/match-phase";
import { useNowTick } from "../game/hooks/use-now-tick";
import { useGameStore } from "../game/stores";
import { FullscreenToggle } from "./components/fullscreen-toggle";
import { HostGameOver } from "./components/host-game-over";
import { HostLobby } from "./components/host-lobby";
import { HostPlayerStrip } from "./components/host-player-strip";
import { HostTimerBar } from "./components/host-timer-bar";
import { HostTopBar } from "./components/host-top-bar";
import { HostVideoStage } from "./components/host-video-stage";
import { useHostAudioCues } from "./hooks/use-host-audio-cues";
import { useHostPlayerSync } from "./hooks/use-host-player-sync";
import { useHostRoundEffects } from "./hooks/use-host-round-effects";
import { getYouTubeEmbedUrl, useYouTubePlayer } from "./youtube";

export const HostView = () => {
  return (
    <AudioRuntime manifest={soundManifest}>
      <HostScreen />
    </AudioRuntime>
  );
};

const HostScreen = () => {
  const host = useAirJamHost<typeof gameInputSchema>();
  const players = useAirJamHost((state) => state.players);
  const runtimeState = useAirJamHost((state) => state.runtimeState);
  const nowMs = useNowTick(NOW_TICK_MS);

  const phase = useGameStore((state) => state.phase);
  const revealDurationSec = useGameStore((state) => state.revealDurationSec);
  const currentRound = useGameStore((state) => state.currentRound);
  const roundReveal = useGameStore((state) => state.roundReveal);
  const actions = useGameStore.useActions();

  const activeSong = useMemo(() => {
    if (phase === "round-active" && currentRound)
      return getSongById(currentRound.songId);
    if (phase === "round-reveal" && roundReveal)
      return getSongById(roundReveal.songId);
    return null;
  }, [phase, currentRound, roundReveal]);

  const embedUrl = activeSong
    ? getYouTubeEmbedUrl(activeSong.youtubeUrl, true)
    : null;

  const countdownSeconds = currentRound
    ? Math.max(0, Math.ceil((currentRound.endsAtMs - nowMs) / 1000))
    : 0;

  useHostPlayerSync(players, actions);
  useHostRoundEffects({ actions, phase, roundReveal });
  const hostAudio = useHostAudioCues({
    phase,
    roundReveal,
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
  const isPlaying = shellPhase === "playing";
  const showVideo = isPlaying && activeSong && embedUrl;

  return (
    <>
      <VisualHarnessRuntime
        bridge={lastBandStandingVisualHarnessBridge}
        context={{
          host,
          matchPhase: shellPhase,
          runtimeState,
          actions,
        }}
      />
      <SurfaceViewport className="bg-background">
        <main className="bg-background text-foreground flex h-full w-full flex-col overflow-hidden">
          {phase !== "lobby" && <HostTopBar />}

          {phase === "round-active" && <HostTimerBar />}

          <div className="relative flex flex-1 items-center justify-center overflow-hidden">
            <AnimatePresence mode="wait">
              {phase === "lobby" && <HostLobby />}

              {showVideo && (
                <HostVideoStage
                  activeSong={activeSong}
                  embedUrl={embedUrl}
                  youtubePlayerRef={youtubePlayerRef}
                  onIframeLoad={onIframeLoad}
                />
              )}

              {phase === "game-over" && <HostGameOver />}
            </AnimatePresence>
          </div>

          {phase !== "lobby" && <HostPlayerStrip />}
        </main>
      </SurfaceViewport>
      <HostPreviewControllerWorkspace
        dockAccessory={
          <div className="flex items-center gap-2">
            <HostMuteButton
              muted={hostAudio.muted}
              onToggle={hostAudio.toggleMuted}
            />
            <FullscreenToggle className="border border-white/25 bg-black/35 text-white backdrop-blur-sm hover:bg-black/55" />
          </div>
        }
      />
    </>
  );
};

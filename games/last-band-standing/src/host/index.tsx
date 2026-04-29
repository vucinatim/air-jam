/**
 * Host surface for last-band-standing.
 *
 * This host drives a round-based music quiz: a YouTube clip plays on the
 * main screen, controllers buzz in, and the host advances the round
 * lifecycle through the networked `useGameStore`. The YouTube player
 * wrapper in `./youtube` handles cued playback without exposing
 * the iframe API directly to the rest of the code.
 */
import { VisualHarnessRuntime } from "@air-jam/harness/runtime";
import { AudioRuntime } from "@air-jam/sdk";
import { HostPreviewControllerWorkspace } from "@air-jam/sdk/preview";
import { HostMuteButton, SurfaceViewport } from "@air-jam/sdk/ui";
import { AnimatePresence } from "framer-motion";
import { lastBandStandingVisualHarnessBridge } from "../../visual/contract";
import { gameMetadata } from "../airjam.config";
import { soundManifest } from "../game/contracts/sounds";
import { FullscreenToggle } from "./components/fullscreen-toggle";
import { HostGameOver } from "./components/host-game-over";
import { HostLobby } from "./components/host-lobby";
import { HostMatchCountdown } from "./components/host-match-countdown";
import { HostTimerBar } from "./components/host-timer-bar";
import { HostTopBar } from "./components/host-top-bar";
import { HostVideoStage } from "./components/host-video-stage";
import { useHostRoundVideoRuntime } from "./hooks/use-host-round-video-runtime";

export const HostView = () => {
  return (
    <AudioRuntime manifest={soundManifest}>
      <HostScreen />
    </AudioRuntime>
  );
};

const HostScreen = () => {
  const runtime = useHostRoundVideoRuntime();

  return (
    <>
      <VisualHarnessRuntime
        gameId={gameMetadata.slug}
        bridge={lastBandStandingVisualHarnessBridge}
        context={{
          host: runtime.host,
          matchPhase: runtime.shellPhase,
          runtimeState: runtime.runtimeState,
          actions: runtime.actions,
        }}
      />
      <SurfaceViewport className="bg-background">
        <main className="bg-background text-foreground flex h-full w-full flex-col overflow-hidden">
          {runtime.phase !== "lobby" && <HostTopBar />}

          {runtime.phase === "round-active" && <HostTimerBar />}

          <div className="relative flex flex-1 items-center justify-center overflow-hidden">
            <AnimatePresence mode="wait">
              {runtime.phase === "lobby" && <HostLobby />}

              {runtime.phase === "match-countdown" && <HostMatchCountdown />}

              {runtime.videoStage && (
                <HostVideoStage
                  activeSong={runtime.videoStage.activeSong}
                  embedUrl={runtime.videoStage.embedUrl}
                  youtubePlayerRef={runtime.videoStage.youtubePlayerRef}
                  onIframeLoad={runtime.videoStage.onIframeLoad}
                />
              )}

              {runtime.phase === "game-over" && <HostGameOver />}
            </AnimatePresence>
          </div>
        </main>
      </SurfaceViewport>
      <HostPreviewControllerWorkspace
        dockAccessory={
          <div className="flex items-center gap-2">
            <HostMuteButton
              muted={runtime.hostAudio.muted}
              onToggle={runtime.hostAudio.toggleMuted}
            />
            <FullscreenToggle className="border border-white/25 bg-black/35 text-white backdrop-blur-sm hover:bg-black/55" />
          </div>
        }
      />
    </>
  );
};

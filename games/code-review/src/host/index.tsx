/**
 * Host surface for Code Review. The declared simulation
 * (`game/engine/code-review-simulation.ts`) plays the fight; this surface
 * draws it, plays its sounds and hosts the preview controls.
 * Runtime details live in host hooks so this route stays a small composition
 * hub instead of a mixed engine/UI file.
 */
import { MusicPlaylist, useAirJamHost, useAirJamStore } from "@air-jam/sdk";
import { HostPreviewControllerWorkspace } from "@air-jam/sdk/preview";
import { HostMuteButton, SurfaceViewport } from "@air-jam/sdk/ui";
import { CODE_REVIEW_MUSIC_TRACKS } from "../game/assets";
import { gameStore } from "../game/stores";
import { EndedScreen } from "./components/ended-screen";
import { LobbyScreen } from "./components/lobby-screen";
import { PausedOverlay } from "./components/paused-overlay";
import { PlayingScreen } from "./components/playing-screen";
import { useCodeReviewAudio } from "./hooks/use-code-review-audio";
import { useCodeReviewCanvas } from "./hooks/use-code-review-canvas";
import { useCodeReviewHostTeams } from "./hooks/use-code-review-host-teams";
import { useCodeReviewMatchView } from "./hooks/use-code-review-match-view";
import { useCodeReviewSprites } from "./hooks/use-code-review-sprites";

export function HostView() {
  const host = useAirJamHost();
  const matchPhase = useAirJamStore(gameStore, (state) => state.matchPhase);
  const actions = gameStore.actions;

  const canvas = useCodeReviewCanvas();
  const sprites = useCodeReviewSprites();
  const teams = useCodeReviewHostTeams();
  const audio = useCodeReviewAudio(matchPhase);
  const runtime = useCodeReviewMatchView({
    participantBySlot: teams.participantBySlot,
    spritesRef: sprites.spritesRef,
    getContext: canvas.getContext,
    getArenaColors: canvas.getArenaColors,
    getTintedOverlaySprite: sprites.getTintedOverlaySprite,
    playSfxFromRef: audio.playSfxFromRef,
  });

  return (
    <div className="host-view-shell">
      <MusicPlaylist
        fadeMs={800}
        playing={!audio.audioMuted}
        tracks={CODE_REVIEW_MUSIC_TRACKS}
      />
      <SurfaceViewport className="bg-(--ring-mat-color)">
        <div className="relative h-full w-full">
          <PlayingScreen
            canvasRef={canvas.canvasRef}
            hpDisplay={runtime.hpDisplay}
          />

          {matchPhase === "lobby" ? (
            <LobbyScreen
              joinUrl={host.joinUrl}
              roomId={host.roomId}
              connectionStatus={host.connectionStatus}
              players={host.players}
              teams={teams}
              onStartMatch={() => actions.startMatch()}
            />
          ) : null}

          {matchPhase === "ended" ? <EndedScreen /> : null}

          {matchPhase === "playing" && host.runtimeState !== "playing" ? (
            <PausedOverlay />
          ) : null}
        </div>
      </SurfaceViewport>
      <HostPreviewControllerWorkspace
        dockAccessory={
          <HostMuteButton
            muted={audio.audioMuted}
            onToggle={audio.toggleAudioMuted}
          />
        }
      />
    </div>
  );
}

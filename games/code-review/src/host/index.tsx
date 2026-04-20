/**
 * Host surface for Code Review. The host owns the authoritative simulation,
 * canvas renderer, visual harness context, and host-only preview controls.
 * Runtime details live in host hooks so this route stays a small composition
 * hub instead of a mixed engine/UI file.
 */
import { AudioRuntime, MusicPlaylist, useAirJamHost } from "@air-jam/sdk";
import { HostPreviewControllerWorkspace } from "@air-jam/sdk/preview";
import { HostMuteButton, SurfaceViewport } from "@air-jam/sdk/ui";
import { VisualHarnessRuntime } from "@air-jam/visual-harness/runtime";
import { codeReviewVisualHarnessBridge } from "../../visual/contract";
import { gameInputSchema } from "../game/contracts/input";
import {
  CODE_REVIEW_MUSIC_TRACKS,
  CODE_REVIEW_SOUND_MANIFEST,
} from "../game/contracts/sounds";
import { useGameStore } from "../game/stores";
import { EndedScreen } from "./components/ended-screen";
import { LobbyScreen } from "./components/lobby-screen";
import { PausedOverlay } from "./components/paused-overlay";
import { PlayingScreen } from "./components/playing-screen";
import { useCodeReviewAudio } from "./hooks/use-code-review-audio";
import { useCodeReviewCanvas } from "./hooks/use-code-review-canvas";
import { useCodeReviewHostRuntime } from "./hooks/use-code-review-host-runtime";
import { useCodeReviewHostTeams } from "./hooks/use-code-review-host-teams";
import { useCodeReviewSprites } from "./hooks/use-code-review-sprites";

export function HostView() {
  return (
    <AudioRuntime manifest={CODE_REVIEW_SOUND_MANIFEST}>
      <CodeReviewHost />
    </AudioRuntime>
  );
}

function CodeReviewHost() {
  const host = useAirJamHost<typeof gameInputSchema>();
  const matchPhase = useGameStore((state) => state.matchPhase);
  const scores = useGameStore((state) => state.scores);
  const actions = useGameStore.useActions();

  const canvas = useCodeReviewCanvas();
  const sprites = useCodeReviewSprites();
  const teams = useCodeReviewHostTeams();
  const audio = useCodeReviewAudio(matchPhase);
  const runtime = useCodeReviewHostRuntime({
    matchPhase,
    participantBySlot: teams.participantBySlot,
    slotParticipants: teams.slotParticipants,
    spritesRef: sprites.spritesRef,
    getContext: canvas.getContext,
    getArenaColors: canvas.getArenaColors,
    getTintedOverlaySprite: sprites.getTintedOverlaySprite,
    playSfxFromRef: audio.playSfxFromRef,
  });

  return (
    <div className="host-view-shell">
      <VisualHarnessRuntime
        bridge={codeReviewVisualHarnessBridge}
        context={{
          host,
          matchPhase,
          runtimeState: host.runtimeState,
          actions,
          scores,
        }}
      />
      <MusicPlaylist
        fadeMs={800}
        playing={!audio.audioMuted}
        tracks={CODE_REVIEW_MUSIC_TRACKS}
      />
      <SurfaceViewport className="bg-(--ring-mat-color,#e5e7eb)">
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

/**
 * Host surface for pong. Renders on the TV / laptop / big-screen host.
 *
 * Flow:
 *  1. `HostView` mounts the audio runtime and delegates to `HostScreen`.
 *  2. `HostScreen` pulls the networked `usePongStore` slice through
 *     `useTeamsSnapshot` and wires up the host-side feedback (audio + haptic
 *     signals to controllers).
 *  3. `useHostRuntimeStateBridge` keeps transport pause/play aligned with the
 *     store's `matchPhase` — entering `playing` starts the countdown, exiting
 *     clears it, and returning to lobby resets the ball.
 *  4. The canvas `useEffect` runs the 60fps game loop: `stepGame` advances
 *     simulation from controller inputs, `drawFrame` renders the scene, and
 *     `onScore` dispatches the networked `scorePoint` action.
 *  5. The lobby / match / ended screens are picked by `matchPhase` and wrap
 *     the canvas + score strip when the match is active.
 *
 * Everything authoritative about the game state lives in `usePongStore`;
 * this file only orchestrates the local rendering and side-effects.
 */
import {
  AudioRuntime,
  useAirJamHost,
  useAudio,
  useHostRuntimeStateBridge,
} from "@air-jam/sdk";
import { HostPreviewControllerWorkspace } from "@air-jam/sdk/preview";
import {
  HostMuteButton,
  SurfaceViewport,
  useHostLobbyShell,
} from "@air-jam/sdk/ui";
import { useVisualHarnessBridge } from "@air-jam/visual-harness/runtime";
import type { JSX } from "react";
import { useEffect, useRef, useState } from "react";
import { pongVisualHarnessBridge } from "../../visual/contract";
import {
  createRuntimeState,
  drawFrame,
  FIELD_HEIGHT,
  FIELD_WIDTH,
  resetBall,
  stepGame,
} from "../game/engine";
import { gameInputSchema } from "../game/input";
import { PONG_SOUND_MANIFEST } from "../game/sounds";
import { usePongStore } from "../game/stores";
import { useTeamsSnapshot } from "../game/use-teams-snapshot";
import { EndedScreen } from "./components/ended-screen";
import { LobbyScreen } from "./components/lobby-screen";
import { MatchOverlay } from "./components/match-overlay";
import { ScoreStrip } from "./components/score-strip";
import { usePongFeedback } from "./use-pong-feedback";

/** Countdown length (seconds) shown when a match begins or the ball resets. */
const COUNTDOWN_SECONDS = 3;

export function HostView() {
  return (
    <AudioRuntime manifest={PONG_SOUND_MANIFEST}>
      <HostScreen />
    </AudioRuntime>
  );
}

function HostScreen() {
  const host = useAirJamHost<typeof gameInputSchema>();
  const audio = useAudio<keyof typeof PONG_SOUND_MANIFEST & string>();
  const { runtimeState, toggleRuntimeState } = host;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [audioMuted, setAudioMuted] = useState(false);

  const scores = usePongStore((state) => state.scores);
  const actions = usePongStore.useActions();

  const {
    teamAssignments,
    botCounts,
    pointsToWin,
    matchPhase,
    matchSummary,
    team1Players,
    team2Players,
    readiness,
  } = useTeamsSnapshot(host.players, "host");
  const canStartMatch = readiness.canStart;

  const { triggerPaddleHitFeedback, triggerScoreFeedback } = usePongFeedback({
    matchPhase,
    matchSummaryWinner: matchSummary?.winner ?? null,
    matchSummary,
  });

  // Host-authoritative runtime state lives in a ref (not React state) so the
  // 60fps game loop can mutate it without triggering renders.
  const runtimeStateRef = useRef(createRuntimeState());

  const hostLobbyShell = useHostLobbyShell({
    joinUrl: host.joinUrl,
    canStartMatch,
    onStartMatch: () => actions.startMatch(),
  });

  // Preview controllers are a dev-only affordance. Never shown in production.
  const previewControllersEnabled = import.meta.env.DEV;

  useVisualHarnessBridge(pongVisualHarnessBridge, {
    host,
    matchPhase,
    runtimeState,
    actions,
  });

  const showPausedOverlay =
    matchPhase === "playing" && runtimeState !== "playing";

  useEffect(() => {
    audio.mute(audioMuted);
  }, [audio, audioMuted]);

  // Keep transport pause/play aligned with store phase transitions.
  useHostRuntimeStateBridge({
    matchPhase,
    runtimeState,
    toggleRuntimeState,
    onEnterActivePhase: () => {
      setCountdown(COUNTDOWN_SECONDS);
      Object.assign(runtimeStateRef.current, createRuntimeState());
    },
    onExitActivePhase: () => {
      setCountdown(null);
    },
    onPhaseTransition: ({ previousPhase, matchPhase: nextPhase }) => {
      if (previousPhase === "ended" && nextPhase === "lobby") {
        resetBall(runtimeStateRef.current);
      }
    },
  });

  // Countdown tick. Once it hits 0 the ball launches, and we clear countdown
  // on the next microtask so the next frame's `stepGame` sees `null`.
  useEffect(() => {
    if (countdown === null) return;
    if (runtimeState !== "playing" || matchPhase !== "playing") return;

    if (countdown === 0) {
      resetBall(runtimeStateRef.current);
      setTimeout(() => {
        setCountdown(null);
      }, 0);
      return;
    }

    const timer = setTimeout(() => {
      setCountdown((previous) => (previous === null ? null : previous - 1));
    }, 1000);

    return () => clearTimeout(timer);
  }, [countdown, runtimeState, matchPhase]);

  // Main game loop. Runs at ~60fps via requestAnimationFrame. Simulation reads
  // controller inputs via `host.getInput`, so this stays host-authoritative:
  // controllers publish intent, the host decides the world.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = FIELD_WIDTH * dpr;
    canvas.height = FIELD_HEIGHT * dpr;
    canvas.style.width = `${FIELD_WIDTH}px`;
    canvas.style.height = `${FIELD_HEIGHT}px`;
    ctx.scale(dpr, dpr);

    let animationFrameId: number;

    const loop = () => {
      stepGame({
        state: runtimeStateRef.current,
        players: host.players,
        teamAssignments,
        getInput: host.getInput,
        isPlaying: runtimeState === "playing" && matchPhase === "playing",
        countdown,
        botCounts,
        onPaddleHit: (event) => {
          triggerPaddleHitFeedback(event);
        },
        onScore: (team) => {
          triggerScoreFeedback();
          actions.scorePoint({ team });
          setCountdown(COUNTDOWN_SECONDS);
        },
      });

      drawFrame({
        ctx,
        state: runtimeStateRef.current,
        players: host.players,
        teamAssignments,
        countdown,
        botCounts,
      });

      animationFrameId = requestAnimationFrame(loop);
    };

    loop();
    return () => cancelAnimationFrame(animationFrameId);
  }, [
    actions,
    countdown,
    runtimeState,
    host.getInput,
    host.players,
    matchPhase,
    triggerPaddleHitFeedback,
    triggerScoreFeedback,
    botCounts,
    teamAssignments,
  ]);

  let content: JSX.Element;

  if (matchPhase === "lobby") {
    content = (
      <LobbyScreen
        joinQrValue={hostLobbyShell.joinUrlValue}
        copiedJoinUrl={hostLobbyShell.copied}
        onCopyJoinUrl={hostLobbyShell.handleCopy}
        onOpenJoinUrl={hostLobbyShell.handleOpen}
        joinQrVisible={hostLobbyShell.joinQrVisible}
        onToggleJoinQr={hostLobbyShell.toggleJoinQr}
        onCloseJoinQr={hostLobbyShell.hideJoinQr}
        roomId={host.roomId}
        botCounts={botCounts}
        pointsToWin={pointsToWin}
        connectedPlayers={host.players}
        team1Players={team1Players}
        team2Players={team2Players}
        canStartMatch={canStartMatch}
        onStartMatch={hostLobbyShell.handleStart}
      />
    );
  } else if (matchPhase === "ended") {
    content = (
      <EndedScreen
        roomId={host.roomId}
        matchSummary={matchSummary}
        team1Players={team1Players}
        team2Players={team2Players}
        botCounts={botCounts}
      />
    );
  } else {
    content = (
      <div className="pong-app-shell h-full w-full text-white">
        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 px-4 sm:px-6">
          <ScoreStrip
            team1Players={team1Players}
            team2Players={team2Players}
            botCounts={botCounts}
            pointsToWin={pointsToWin}
            scores={scores}
          />
        </div>

        <div className="absolute inset-0 flex items-center justify-center px-4 pt-28 pb-6 sm:px-6 sm:pt-32 sm:pb-8">
          <div className="pong-stage-frame flex max-h-full max-w-full items-center justify-center">
            <canvas
              ref={canvasRef}
              className="block max-h-full max-w-full rounded-[22px] border border-white/16 bg-black"
            />
          </div>
        </div>

        {showPausedOverlay ? (
          <MatchOverlay
            joinQrValue={hostLobbyShell.joinUrlValue}
            roomId={host.roomId}
          />
        ) : null}
      </div>
    );
  }

  return (
    <>
      <SurfaceViewport preset="host-standard" className="bg-[#02030a]">
        {content}
      </SurfaceViewport>
      <HostPreviewControllerWorkspace
        enabled={previewControllersEnabled}
        dockAccessory={
          <HostMuteButton
            muted={audioMuted}
            onToggle={() => setAudioMuted((previous) => !previous)}
          />
        }
      />
    </>
  );
}

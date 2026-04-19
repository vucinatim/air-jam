/**
 * Host surface for pong. Renders on the TV / laptop / big-screen host.
 *
 * Flow:
 *  1. `HostView` mounts the audio runtime and delegates to `HostScreen`.
 *  2. `HostScreen` pulls the networked `usePongStore` slice through
 *     `useTeamsSnapshot` and wires up the host-side feedback (audio + haptic
 *     signals to controllers).
 *  3. Local phase transition effects reset the simulation buffers when a match
 *     starts, ends, or returns to lobby.
 *  4. `useHostTick` runs a fixed-step host simulation: `stepGame` advances from
 *     controller inputs, `drawFrame` renders the scene, and `onScore` dispatches
 *     the networked `scorePoint` action.
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
  useHostTick,
} from "@air-jam/sdk";
import { HostPreviewControllerWorkspace } from "@air-jam/sdk/preview";
import {
  HostMuteButton,
  SurfaceViewport,
  useHostJoinControls,
} from "@air-jam/sdk/ui";
import { VisualHarnessRuntime } from "@air-jam/visual-harness/runtime";
import type { JSX } from "react";
import { useEffect, useRef, useState } from "react";
import { pongVisualHarnessBridge } from "../../visual/contract";
import {
  captureRuntimeStateStep,
  createRuntimeStateBuffers,
  drawFrame,
  FIELD_HEIGHT,
  FIELD_WIDTH,
  resetRuntimeStateBufferBall,
  resetRuntimeStateBuffers,
  stepGame,
  updateRuntimeRenderState,
} from "../game/engine";
import { gameInputSchema } from "../game/input";
import { PONG_SOUND_MANIFEST, type PongSoundId } from "../game/sounds";
import { usePongStore } from "../game/stores";
import { useTeamsSnapshot } from "../game/use-teams-snapshot";
import { EndedScreen } from "./components/ended-screen";
import { LobbyScreen } from "./components/lobby-screen";
import { MatchOverlay } from "./components/match-overlay";
import { ScoreStrip } from "./components/score-strip";
import { usePongFeedback } from "./use-pong-feedback";

/** Countdown length (seconds) shown when a match begins or the ball resets. */
const COUNTDOWN_SECONDS = 3;
const PONG_SIMULATION_STEP_MS = 1000 / 60;

export function HostView() {
  return (
    <AudioRuntime manifest={PONG_SOUND_MANIFEST}>
      <HostScreen />
    </AudioRuntime>
  );
}

function HostScreen() {
  const host = useAirJamHost<typeof gameInputSchema>();
  const audio = useAudio<PongSoundId>();
  const { runtimeState } = host;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const canvasContextRef = useRef<CanvasRenderingContext2D | null>(null);
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

  // Host-authoritative simulation buffers live in a ref so the 60fps game loop
  // can mutate them without triggering React renders.
  const runtimeBuffersRef = useRef(createRuntimeStateBuffers());
  const previousMatchPhaseRef = useRef(matchPhase);

  const hostJoinControls = useHostJoinControls({
    joinUrl: host.joinUrl,
    canStartMatch,
    onStartMatch: () => actions.startMatch(),
  });

  const showPausedOverlay =
    matchPhase === "playing" && runtimeState !== "playing";

  useEffect(() => {
    audio.mute(audioMuted);
  }, [audio, audioMuted]);

  useEffect(() => {
    const previousMatchPhase = previousMatchPhaseRef.current;
    if (previousMatchPhase === matchPhase) {
      return;
    }

    if (previousMatchPhase !== "playing" && matchPhase === "playing") {
      setCountdown(COUNTDOWN_SECONDS);
      resetRuntimeStateBuffers(runtimeBuffersRef.current);
    }

    if (previousMatchPhase === "playing" && matchPhase !== "playing") {
      setCountdown(null);
    }

    if (previousMatchPhase === "ended" && matchPhase === "lobby") {
      resetRuntimeStateBufferBall(runtimeBuffersRef.current);
    }

    previousMatchPhaseRef.current = matchPhase;
  }, [matchPhase]);

  // Countdown tick. Once it hits 0 the ball launches, and we clear countdown
  // on the next microtask so the next frame's `stepGame` sees `null`.
  useEffect(() => {
    if (countdown === null) return;
    if (runtimeState !== "playing" || matchPhase !== "playing") return;

    if (countdown === 0) {
      resetRuntimeStateBufferBall(runtimeBuffersRef.current);
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

  // Canvas backing store setup is separate from the loop so React renders do not
  // restart the host simulation.
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
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    canvasContextRef.current = ctx;

    return () => {
      canvasContextRef.current = null;
    };
  }, [matchPhase]);

  // Fixed-step host simulation. Controller input and browser rendering cadence
  // can vary, but simulation receives the same delta every step.
  useHostTick({
    enabled: matchPhase !== "lobby",
    mode: "fixed",
    intervalMs: PONG_SIMULATION_STEP_MS,
    onTick: ({ deltaSeconds }) => {
      const buffers = runtimeBuffersRef.current;
      captureRuntimeStateStep(buffers);

      stepGame({
        state: buffers.current,
        players: host.players,
        teamAssignments,
        getInput: host.getInput,
        isPlaying: runtimeState === "playing" && matchPhase === "playing",
        countdown,
        botCounts,
        deltaSeconds,
        onPaddleHit: (event) => {
          triggerPaddleHitFeedback(event);
        },
        onScore: (team) => {
          triggerScoreFeedback();
          actions.scorePoint({ team });
          setCountdown(COUNTDOWN_SECONDS);
        },
      });
    },
    onFrame: ({ fixedStepAlpha }) => {
      const ctx = canvasContextRef.current;
      if (!ctx) return;

      const renderState = updateRuntimeRenderState(
        runtimeBuffersRef.current,
        fixedStepAlpha,
      );

      drawFrame({
        ctx,
        state: renderState,
        players: host.players,
        teamAssignments,
        countdown,
        botCounts,
      });
    },
  });

  let content: JSX.Element;

  if (matchPhase === "lobby") {
    content = (
      <LobbyScreen
        joinQrValue={hostJoinControls.joinUrlValue}
        copiedJoinUrl={hostJoinControls.copied}
        onCopyJoinUrl={hostJoinControls.handleCopy}
        onOpenJoinUrl={hostJoinControls.handleOpen}
        joinQrVisible={hostJoinControls.joinQrVisible}
        onToggleJoinQr={hostJoinControls.toggleJoinQr}
        onCloseJoinQr={hostJoinControls.hideJoinQr}
        roomId={host.roomId}
        botCounts={botCounts}
        pointsToWin={pointsToWin}
        connectedPlayers={host.players}
        team1Players={team1Players}
        team2Players={team2Players}
        canStartMatch={canStartMatch}
        onStartMatch={hostJoinControls.handleStart}
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
            joinQrValue={hostJoinControls.joinUrlValue}
            roomId={host.roomId}
          />
        ) : null}
      </div>
    );
  }

  return (
    <>
      <VisualHarnessRuntime
        bridge={pongVisualHarnessBridge}
        context={{
          host,
          matchPhase,
          runtimeState,
          actions,
        }}
      />
      <SurfaceViewport className="bg-[#02030a]">{content}</SurfaceViewport>
      <HostPreviewControllerWorkspace
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

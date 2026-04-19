/**
 * Host surface for pong. The host owns the authoritative simulation loop,
 * local countdown, canvas renderer, visual harness, and host-only controls.
 * Screen components read the replicated store/session data they render instead
 * of receiving large prop bundles from this hub.
 */
import { AudioRuntime, useAirJamHost, useHostTick } from "@air-jam/sdk";
import { HostPreviewControllerWorkspace } from "@air-jam/sdk/preview";
import { SurfaceViewport } from "@air-jam/sdk/ui";
import { VisualHarnessRuntime } from "@air-jam/visual-harness/runtime";
import { pongVisualHarnessBridge } from "../../visual/contract";
import {
  captureRuntimeStateStep,
  drawFrame,
  FIELD_HEIGHT,
  FIELD_WIDTH,
  stepGame,
  updateRuntimeRenderState,
} from "../game/engine";
import { gameInputSchema } from "../game/input";
import { PONG_SOUND_MANIFEST } from "../game/sounds";
import { usePongStore } from "../game/stores";
import { EndedScreen } from "./components/ended-screen";
import { LobbyScreen } from "./components/lobby-screen";
import { PlayingScreen } from "./components/playing-screen";
import { PONG_SIMULATION_STEP_MS } from "./constants";
import { usePongCanvas } from "./use-pong-canvas";
import { usePongFeedback } from "./use-pong-feedback";
import { usePongHostRuntimeState } from "./use-pong-host-runtime-state";

export function HostView() {
  return (
    <AudioRuntime manifest={PONG_SOUND_MANIFEST}>
      <PongHost />
    </AudioRuntime>
  );
}

function PongHost() {
  const host = useAirJamHost<typeof gameInputSchema>();

  const matchPhase = usePongStore((state) => state.matchPhase);
  const teamAssignments = usePongStore((state) => state.teamAssignments);
  const botCounts = usePongStore((state) => state.botCounts);
  const actions = usePongStore.useActions();

  const { triggerPaddleHitFeedback, triggerScoreFeedback } = usePongFeedback();
  const { canvasRef, getContext } = usePongCanvas({
    width: FIELD_WIDTH,
    height: FIELD_HEIGHT,
    resetKey: matchPhase,
  });
  const hostRuntime = usePongHostRuntimeState({
    matchPhase,
    runtimeState: host.runtimeState,
  });

  useHostTick({
    enabled: matchPhase !== "lobby",
    mode: "fixed",
    intervalMs: PONG_SIMULATION_STEP_MS,
    onTick: ({ deltaSeconds }) => {
      const buffers = hostRuntime.runtimeBuffersRef.current;
      captureRuntimeStateStep(buffers);

      stepGame({
        state: buffers.current,
        players: host.players,
        teamAssignments,
        getInput: host.getInput,
        isPlaying: host.runtimeState === "playing" && matchPhase === "playing",
        countdown: hostRuntime.countdownValue,
        botCounts,
        deltaSeconds,
        onPaddleHit: (event) => {
          triggerPaddleHitFeedback(event);
        },
        onScore: (team) => {
          triggerScoreFeedback();
          actions.scorePoint({ team });
          hostRuntime.startCountdown();
        },
      });
    },
    onFrame: ({ fixedStepAlpha }) => {
      const ctx = getContext();
      if (!ctx) return;

      const renderState = updateRuntimeRenderState(
        hostRuntime.runtimeBuffersRef.current,
        fixedStepAlpha,
      );

      drawFrame({
        ctx,
        state: renderState,
        players: host.players,
        teamAssignments,
        countdown: hostRuntime.countdownValue,
        botCounts,
      });
    },
  });

  return (
    <>
      <VisualHarnessRuntime
        bridge={pongVisualHarnessBridge}
        context={{
          host,
          matchPhase,
          runtimeState: host.runtimeState,
          actions,
        }}
      />
      <SurfaceViewport className="bg-[#02030a]">
        {matchPhase === "lobby" ? (
          <LobbyScreen />
        ) : matchPhase === "ended" ? (
          <EndedScreen />
        ) : (
          <PlayingScreen canvasRef={canvasRef} />
        )}
      </SurfaceViewport>
      <HostPreviewControllerWorkspace />
    </>
  );
}

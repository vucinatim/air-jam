/**
 * Host surface for pong. The host owns the authoritative simulation loop,
 * local countdown, canvas renderer, and host-only controls.
 * Screen components read the replicated store/session data they render instead
 * of receiving large prop bundles from this hub.
 */
import {
  AudioRuntime,
  captureAgentCanvas,
  useAirJamHost,
  useGetInput,
  useHostAgentObservation,
  useHostTick,
} from "@air-jam/sdk";
import { HostPreviewControllerWorkspace } from "@air-jam/sdk/preview";
import { SurfaceViewport } from "@air-jam/sdk/ui";
import { useRef } from "react";
import { gameInputSchema } from "../game/contracts/input";
import { PONG_SOUND_MANIFEST } from "../game/contracts/sounds";
import type { TeamId } from "../game/domain/team";
import {
  captureRuntimeStateStep,
  drawFrame,
  FIELD_HEIGHT,
  FIELD_WIDTH,
  stepGame,
  updateRuntimeRenderState,
} from "../game/engine";
import { usePongStore } from "../game/stores";
import { EndedScreen } from "./components/ended-screen";
import { LobbyScreen } from "./components/lobby-screen";
import { PlayingScreen } from "./components/playing-screen";
import { usePongCanvas } from "./hooks/use-pong-canvas";
import { usePongFeedback } from "./hooks/use-pong-feedback";
import { usePongHostRuntimeState } from "./hooks/use-pong-host-runtime-state";

const PONG_SIMULATION_STEP_MS = 1000 / 60;

export function HostView() {
  return (
    <AudioRuntime manifest={PONG_SOUND_MANIFEST}>
      <PongHost />
    </AudioRuntime>
  );
}

function PongHost() {
  const players = useAirJamHost((state) => state.players);
  const runtimeState = useAirJamHost((state) => state.runtimeState);
  const getInput = useGetInput<typeof gameInputSchema>();

  const matchPhase = usePongStore((state) => state.matchPhase);
  const scores = usePongStore((state) => state.scores);
  const teamAssignments = usePongStore((state) => state.teamAssignments);
  const botCounts = usePongStore((state) => state.botCounts);
  const actions = usePongStore.useActions();

  const { triggerPaddleHitFeedback, triggerScoreFeedback } = usePongFeedback();
  const { canvasRef, getContext } = usePongCanvas({
    width: FIELD_WIDTH,
    height: FIELD_HEIGHT,
  });
  const hostRuntime = usePongHostRuntimeState({
    matchPhase,
    scores,
    runtimeState,
  });

  const tick = useRef(0);
  const serve = useRef(0);
  const awaitingServe = useRef(false);
  const goals = useRef<
    Array<{
      sequence: number;
      serve: number;
      tick: number;
      ballX: number;
      team: TeamId;
      before: Record<TeamId, number>;
      after: Record<TeamId, number>;
    }>
  >([]);
  useHostAgentObservation({
    read: () => ({
      ...(matchPhase === "lobby" ? {} : { tick: tick.current }),
      state: {
        field: { width: FIELD_WIDTH, height: FIELD_HEIGHT },
        simulation: { ...hostRuntime.runtimeBuffersRef.current.current },
        countdown: hostRuntime.countdownValue,
        goals: goals.current,
      },
    }),
    capture: () => captureAgentCanvas(getContext()?.canvas ?? null),
  });

  useHostTick({
    enabled: matchPhase !== "lobby",
    mode: "fixed",
    intervalMs: PONG_SIMULATION_STEP_MS,
    onTick: ({ deltaSeconds }) => {
      tick.current += 1;
      const buffers = hostRuntime.runtimeBuffersRef.current;
      if (awaitingServe.current && !buffers.current.awaitingServe)
        serve.current += 1;
      captureRuntimeStateStep(buffers);

      stepGame({
        state: buffers.current,
        players,
        teamAssignments,
        getInput,
        isPlaying: runtimeState === "playing" && matchPhase === "playing",
        countdown: hostRuntime.countdownValue,
        botCounts,
        deltaSeconds,
        onPaddleHit: (event) => {
          triggerPaddleHitFeedback(event);
        },
        onScore: (team) => {
          triggerScoreFeedback();
          const before = { ...usePongStore.getState().scores };
          actions.scorePoint({ team });
          const previous = goals.current.at(-1)?.sequence ?? 0;
          goals.current = [
            ...goals.current.slice(-15),
            {
              sequence: previous + 1,
              serve: serve.current,
              tick: tick.current,
              ballX: buffers.current.ballX,
              team,
              before,
              after: { ...usePongStore.getState().scores },
            },
          ];
        },
      });
      awaitingServe.current = buffers.current.awaitingServe;
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
        players,
        teamAssignments,
        countdown: hostRuntime.countdownValue,
        botCounts,
      });
    },
  });

  return (
    <>
      {/* Host tokens scale to a 1600×900 reference; in a small embedded host
          (e.g. 715×626) that made body text ~6px. A floor keeps scores and
          captions readable; the screens scroll or stack when content grows. */}
      <SurfaceViewport className="bg-[#02030a]" minScale={0.8}>
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

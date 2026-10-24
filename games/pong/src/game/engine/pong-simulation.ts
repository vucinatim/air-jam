/**
 * Pong's authoritative simulation, stepped by the SDK clock on the host. It
 * owns everything that decides the match: ball and paddles, the serve
 * countdown, reacting to match phase changes, and scoring. The host screen
 * only draws it, so the match also runs headless and faster than real time.
 */
import { defineAirJamSimulation } from "@air-jam/sdk/core";
import type { PongInput } from "../contracts/input";
import type { TeamId } from "../domain/team";
import { pongStore, type PongState } from "../stores";
import { FIELD_HEIGHT, FIELD_WIDTH } from "./constants";
import {
  captureRuntimeStateStep,
  createRuntimeStateBuffers,
  resetRuntimeStateBufferBall,
  resetRuntimeStateBuffers,
  type RuntimeStateBuffers,
} from "./runtime-state";
import { stepGame } from "./simulation";

export const PONG_STEP_MS = 1000 / 60;
const COUNTDOWN_SECONDS = 3;

export interface PongGoal {
  sequence: number;
  serve: number;
  tick: number;
  ballX: number;
  team: TeamId;
  before: Record<TeamId, number>;
  after: Record<TeamId, number>;
}

export interface PongSimulationState {
  buffers: RuntimeStateBuffers;
  /** Seconds left before the serve, or null when the ball is in play. */
  countdown: number | null;
  countdownElapsedMs: number;
  /** Steps of play, not counting the lobby. */
  tick: number;
  serve: number;
  awaitingServe: boolean;
  goals: PongGoal[];
  previousPhase: PongState["matchPhase"];
  previousScores: PongState["scores"];
}

export type PongSimulationEvent =
  | { type: "paddle-hit"; team: TeamId; playerId: string | null }
  | { type: "score"; team: TeamId };

type PongPhaseEffect =
  | "start-countdown"
  | "clear-countdown"
  | "reset-match-buffers"
  | "reset-ball";

/** What a change of match phase or score asks the simulation to do. */
export const getPongPhaseEffects = ({
  previousPhase,
  matchPhase,
  previousScores,
  scores,
}: {
  previousPhase: PongState["matchPhase"];
  matchPhase: PongState["matchPhase"];
  previousScores: PongState["scores"];
  scores: PongState["scores"];
}): PongPhaseEffect[] => {
  const effects: PongPhaseEffect[] = [];
  const phaseChanged = previousPhase !== matchPhase;
  if (phaseChanged && previousPhase !== "playing" && matchPhase === "playing")
    effects.push("reset-match-buffers", "start-countdown");
  if (phaseChanged && previousPhase === "playing" && matchPhase !== "playing")
    effects.push("clear-countdown");
  if (phaseChanged && previousPhase === "ended" && matchPhase === "lobby")
    effects.push("reset-ball");
  if (
    matchPhase === "playing" &&
    (previousScores.team1 !== scores.team1 ||
      previousScores.team2 !== scores.team2)
  )
    effects.push("start-countdown");
  return effects;
};

export const pongSimulation = defineAirJamSimulation<
  PongSimulationState,
  PongInput,
  PongSimulationEvent
>({
  stepMs: PONG_STEP_MS,
  create: () => {
    const { matchPhase, scores } = pongStore.getState();
    return {
      buffers: createRuntimeStateBuffers(),
      countdown: null,
      countdownElapsedMs: 0,
      tick: 0,
      serve: 0,
      awaitingServe: false,
      goals: [],
      previousPhase: matchPhase,
      previousScores: scores,
    };
  },
  step: (sim, context) => {
    const { matchPhase, scores, teamAssignments, botCounts } =
      pongStore.getState();
    for (const effect of getPongPhaseEffects({
      previousPhase: sim.previousPhase,
      matchPhase,
      previousScores: sim.previousScores,
      scores,
    })) {
      if (effect === "reset-match-buffers")
        resetRuntimeStateBuffers(sim.buffers);
      if (effect === "start-countdown") {
        sim.countdown = COUNTDOWN_SECONDS;
        sim.countdownElapsedMs = 0;
      }
      if (effect === "clear-countdown") sim.countdown = null;
      if (effect === "reset-ball")
        resetRuntimeStateBufferBall(sim.buffers, context.random);
    }
    sim.previousPhase = matchPhase;
    sim.previousScores = scores;
    if (matchPhase === "lobby") return;

    const isPlaying =
      context.runtimeState === "playing" && matchPhase === "playing";
    if (sim.countdown !== null && isPlaying) {
      sim.countdownElapsedMs += context.stepMs;
      if (sim.countdownElapsedMs >= 1000) {
        sim.countdownElapsedMs -= 1000;
        if (sim.countdown <= 1) {
          sim.countdown = null;
          resetRuntimeStateBufferBall(sim.buffers, context.random);
        } else sim.countdown -= 1;
      }
    }

    sim.tick += 1;
    if (sim.awaitingServe && !sim.buffers.current.awaitingServe) sim.serve += 1;
    captureRuntimeStateStep(sim.buffers);
    stepGame({
      state: sim.buffers.current,
      players: [...context.players],
      teamAssignments,
      getInput: context.input,
      isPlaying,
      countdown: sim.countdown,
      botCounts,
      deltaSeconds: context.dtSeconds,
      onPaddleHit: (event) => context.emit({ type: "paddle-hit", ...event }),
      onScore: (team) => {
        const before = { ...pongStore.getState().scores };
        void pongStore.actions.scorePoint({ team });
        const previous = sim.goals.at(-1)?.sequence ?? 0;
        sim.goals = [
          ...sim.goals.slice(-15),
          {
            sequence: previous + 1,
            serve: sim.serve,
            tick: sim.tick,
            ballX: sim.buffers.current.ballX,
            team,
            before,
            after: { ...pongStore.getState().scores },
          },
        ];
        context.emit({ type: "score", team });
      },
    });
    sim.awaitingServe = sim.buffers.current.awaitingServe;
  },
  observe: (sim) => ({
    field: { width: FIELD_WIDTH, height: FIELD_HEIGHT },
    simulation: { ...sim.buffers.current },
    countdown: sim.countdown,
    goals: sim.goals,
  }),
});

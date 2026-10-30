import type { CodeReviewSettings } from "../contracts/settings";
/**
 * Code Review's authoritative simulation, stepped by the SDK clock on the
 * host. It owns the fight: who stands in each slot, movement, punches, hit
 * points, knockouts, scoring and the end of the match. The host screen only
 * draws it and turns its events into sounds and haptics, so the match also
 * runs headless and faster than real time.
 */
import { defineAirJamSimulation } from "@air-jam/sdk/core";
import type { GameInput } from "../contracts/input";
import { gameStore } from "../stores";
import {
  HITBOX_CENTER,
  PUNCH_REACH,
  RING_MAX_X,
  RING_MAX_Y,
  RING_MIN_X,
  RING_MIN_Y,
} from "./constants";
import {
  createHpState,
  createKoState,
  createRuntimePlayerState,
} from "./runtime-state";
import { stepMatchFrame } from "./simulation";
import { resolveSlotParticipants } from "./slot-participants";
import type { HpState, PlayerKey, PlayerState, SlotParticipant } from "./types";

export const CODE_REVIEW_STEP_MS = 1000 / 60;

export interface CodeReviewSimulationState {
  fighters: Record<PlayerKey, PlayerState>;
  hp: HpState;
  ko: ReturnType<typeof createKoState>;
  /** Match time played; fight timers run on it and stop while paused. */
  clockMs: number;
  participants: SlotParticipant[];
  roster: string;
  matchPhase: ReturnType<typeof gameStore.getState>["matchPhase"];
}

export type CodeReviewSimulationEvent =
  | { type: "miss" }
  | { type: "hit"; variant: 1 | 2 }
  | { type: "bell" }
  | { type: "heavy-hit"; controllerId: string };

export const codeReviewSimulation = defineAirJamSimulation<
  CodeReviewSimulationState,
  GameInput,
  CodeReviewSimulationEvent,
  CodeReviewSettings
>({
  stepMs: CODE_REVIEW_STEP_MS,
  create: ({ settings }) => ({
    fighters: createRuntimePlayerState(),
    hp: createHpState(settings.maxHp),
    ko: createKoState(),
    clockMs: 0,
    participants: [],
    roster: "",
    matchPhase: gameStore.getState().matchPhase,
  }),
  step: (sim, context) => {
    const { matchPhase, scores, teamAssignments, botCounts, pointsToWin } =
      gameStore.getState();
    sim.participants = resolveSlotParticipants(
      context.players,
      teamAssignments,
      botCounts,
    );
    const playerIds = context.players.map((player) => player.id);
    const roster = playerIds.join("\u0000");
    if (roster !== sim.roster) {
      sim.roster = roster;
      void gameStore.actions.syncConnectedPlayers({
        connectedPlayerIds: playerIds,
      });
    }
    if (matchPhase !== sim.matchPhase) {
      sim.matchPhase = matchPhase;
      Object.assign(sim.fighters, createRuntimePlayerState());
      Object.assign(sim.hp, createHpState(context.settings.maxHp));
      Object.assign(sim.ko, createKoState());
    }
    if (matchPhase !== "playing") return;
    if (scores.team1 >= pointsToWin || scores.team2 >= pointsToWin) {
      void gameStore.actions.finishMatch();
      return;
    }

    sim.clockMs += context.stepMs;
    stepMatchFrame({
      settings: context.settings,
      state: sim.fighters,
      participants: sim.participants,
      hpState: sim.hp,
      koState: sim.ko,
      dt: context.stepMs,
      timestamp: sim.clockMs,
      getInput: context.input,
      onMiss: () => context.emit({ type: "miss" }),
      onHit: () =>
        context.emit({ type: "hit", variant: context.random() > 0.5 ? 1 : 2 }),
      onBell: () => context.emit({ type: "bell" }),
      onScore: (team) => void gameStore.actions.scorePoint({ team }),
      onHeavyHit: (controllerId) =>
        context.emit({ type: "heavy-hit", controllerId }),
    });
  },
  // Fight state lives only in the simulation; agents read it here.
  observe: (sim) => ({
    ring: {
      minX: RING_MIN_X + HITBOX_CENTER,
      maxX: RING_MAX_X + HITBOX_CENTER,
      minY: RING_MIN_Y + HITBOX_CENTER,
      maxY: RING_MAX_Y + HITBOX_CENTER,
    },
    punchReach: PUNCH_REACH,
    hp: { ...sim.hp },
    knockout: { active: sim.ko.active, winner: sim.ko.winner },
    fighters: sim.participants.map((participant) => {
      const fighter = sim.fighters[participant.slotKey];
      return {
        playerId: participant.id,
        team: participant.team,
        position: participant.position,
        isBot: participant.isBot,
        x: Math.round(fighter.x + HITBOX_CENTER),
        y: Math.round(fighter.y + HITBOX_CENTER),
        punching: fighter.punchingLeft || fighter.punchingRight,
        defending: fighter.defending,
        stunned: fighter.knockbackFrames > 0,
        empowered: fighter.empoweredUntil > sim.clockMs,
      };
    }),
  }),
});

/**
 * Air Capture's authoritative simulation, stepped by the SDK clock on the
 * host. It owns the whole match: the physics world, ships, weapons, pickups,
 * jump pads, flags and scoring, bots and the countdown. The 3D scene only
 * draws it and turns its events into sound, haptics and effects, so the
 * match also runs headless and faster than real time.
 */
import { defineAirJamSimulation } from "@air-jam/sdk/core";
import type { BotWorld } from "../bot-system/bot-world";
import type { GameLoopInput } from "../contracts/input";
import { generateRandomBasePositions } from "../domain/capture-the-flag";
import { createInitialCaptureTheFlagState } from "../stores/match/capture-the-flag-store-state";
import { prototypeMatchStore } from "../stores/match/match-store";
import { emptyTeamSets, stepArena } from "./arena";
import { stepLasers, stepRockets } from "./combat";
import {
  decideMatch,
  followMatchPhase,
  isMatchActive,
  syncRoster,
} from "./match";
import { createArenaPhysics, enforceArenaBounds } from "./physics";
import {
  beginShipStep,
  expireAbility,
  flyShip,
  readShipPosition,
  resolveDeathsAndRespawns,
} from "./ships";
import type { AirCaptureEvent, AirCaptureSim } from "./state";

export const AIR_CAPTURE_STEP_MS = 1000 / 60;

/** Everything a pilot knows about the arena, as plain data; bots and agents read it. */
export const readArena = (sim: AirCaptureSim): BotWorld => ({
  ships: [...sim.ships.values()].map((ship) => ({
    controllerId: ship.controllerId,
    teamId: sim.ctf.playerTeams[ship.controllerId] ?? ship.teamId,
    position: [ship.position.x, ship.position.y, ship.position.z],
    rotation: {
      x: ship.rotation.x,
      y: ship.rotation.y,
      z: ship.rotation.z,
      w: ship.rotation.w,
    },
    health: ship.health,
    queuedAbility: ship.queuedAbility?.id ?? null,
  })),
  flags: Object.values(sim.ctf.flags).map((flag) => ({
    teamId: flag.teamId,
    status: flag.status,
    position: [...flag.position],
    ...(flag.carrierId ? { carrierId: flag.carrierId } : {}),
  })),
  basePositions: { ...sim.ctf.basePositions },
  collectibles: [...sim.collectibles.values()].map((collectible) => ({
    id: collectible.id,
    type: "box" as const,
    position: collectible.position,
    timestamp: collectible.spawnedAt,
    abilityId: collectible.abilityId,
  })),
});

const TURN_DEADZONE = 0.08;

/** A thumb resting slightly off centre does not turn the ship. */
const withTurnDeadzone = (input: GameLoopInput): GameLoopInput =>
  Math.abs(input.vector.x) < TURN_DEADZONE
    ? { ...input, vector: { x: 0, y: input.vector.y } }
    : input;

/** During the countdown ships may turn but not thrust, fire or use abilities. */
const countdownInput = (input: GameLoopInput): GameLoopInput => ({
  ...input,
  vector: { x: input.vector.x, y: 0 },
  action: false,
  ability: false,
});

export const airCaptureSimulation = defineAirJamSimulation<
  AirCaptureSim,
  GameLoopInput,
  AirCaptureEvent
>({
  stepMs: AIR_CAPTURE_STEP_MS,
  create: ({ random }) => ({
    physics: createArenaPhysics(AIR_CAPTURE_STEP_MS / 1000),
    time: 0,
    ships: new Map(),
    lasers: new Map(),
    rockets: new Map(),
    collectibles: new Map(),
    lastCollectibleSpawnAt: 0,
    ctf: createInitialCaptureTheFlagState(generateRandomBasePositions(random)),
    baseOccupants: emptyTeamSets(),
    flagContacts: emptyTeamSets(),
    jumpPadContacts: new Map(),
    jumpPadCooldownUntil: new Map(),
    roundId: 0,
    matchPhase: prototypeMatchStore.getState().matchPhase,
    countdownEndsAt: null,
    roster: "",
    nextEntityId: 0,
  }),
  step: (sim, context) => {
    syncRoster(sim, context.players, context.random, context.emit);
    followMatchPhase(sim, context.random);
    if (!isMatchActive(sim.matchPhase)) return;

    const delta = context.dtSeconds;
    sim.time += delta;
    const arena = [...sim.ships.values()].some((ship) => ship.bot)
      ? readArena(sim)
      : null;
    for (const ship of sim.ships.values()) {
      beginShipStep(ship);
      expireAbility(sim, ship);
      if (ship.dead) continue;
      const raw =
        ship.bot && arena
          ? ship.bot.update(sim.time, arena)
          : withTurnDeadzone(context.input(ship.controllerId));
      const input = sim.matchPhase === "countdown" ? countdownInput(raw) : raw;
      flyShip(sim, ship, input, delta, context.emit);
    }
    sim.physics.world.step();
    enforceArenaBounds(sim.physics);
    for (const ship of sim.ships.values()) readShipPosition(ship);
    stepLasers(sim, delta, context.emit);
    stepRockets(sim, delta, context.emit);
    stepArena(sim, context.random, context.emit);
    resolveDeathsAndRespawns(sim, context.emit);
    decideMatch(sim, context.emit);
  },
  // The arena lives in the simulation; agents read the same snapshot bots fly by.
  observe: (sim) => ({ ...readArena(sim), scores: { ...sim.ctf.scores } }),
});

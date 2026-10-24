import type RAPIER from "@dimforge/rapier3d-compat";
import { Quaternion, Vector3 } from "three";
import type { AbilityData, AbilityId } from "../abilities/definitions";
import type { HostSfxId } from "../audio/sounds";
import { BotController } from "../bot-system/bot-controller";
import type { CaptureTheFlagSnapshot } from "../domain/capture-the-flag";
import type { TeamId } from "../domain/team";
import type { PlayerFlightState } from "../engine/ships/flight";
import type { MatchPhase } from "../stores/match/match-store-types";
import type { ArenaPhysics } from "./physics";

export const MAX_HEALTH = 100;
export const MAX_SHIPS = 4;

export type ShipSource = "connected" | "bot";

/** One ship in the arena, human or bot. */
export interface ShipSim {
  controllerId: string;
  label: string;
  teamId: TeamId;
  color: string;
  source: ShipSource;
  body: RAPIER.RigidBody;
  /** Where the ship was at the previous step, for interpolated drawing. */
  previousPosition: Vector3;
  position: Vector3;
  previousRotation: Quaternion;
  rotation: Quaternion;
  smoothedInput: { x: number; y: number };
  angularVelocity: number;
  pitchAngularVelocity: number;
  wingRoll: number;
  lastActionPressed: boolean;
  lastAbilityPressed: boolean;
  lastShotAt: number;
  health: number;
  dead: boolean;
  respawnAt: number;
  flight: PlayerFlightState;
  speedMultiplier: number;
  queuedAbility: AbilityData | null;
  activeAbility: AbilityData | null;
  thrusting: boolean;
  /** Engine glow for drawing, eased toward the thrust input. */
  thrustVisual: number;
  bot: BotController | null;
}

export interface LaserSim {
  id: string;
  controllerId: string;
  previousPosition: Vector3;
  position: Vector3;
  direction: Vector3;
  age: number;
}

export interface RocketSim extends LaserSim {
  detonate: boolean;
}

export interface CollectibleSim {
  id: string;
  abilityId: AbilityId;
  position: [number, number, number];
  spawnedAt: number;
}

export interface AirCaptureSim {
  physics: ArenaPhysics;
  /** Game seconds since the simulation began; every timer runs on it. */
  time: number;
  ships: Map<string, ShipSim>;
  lasers: Map<string, LaserSim>;
  rockets: Map<string, RocketSim>;
  collectibles: Map<string, CollectibleSim>;
  lastCollectibleSpawnAt: number;
  ctf: CaptureTheFlagSnapshot;
  /** Ships standing in each base, so entering scores once. */
  baseOccupants: Record<TeamId, Set<string>>;
  flagContacts: Record<TeamId, Set<string>>;
  jumpPadContacts: Map<string, Set<string>>;
  jumpPadCooldownUntil: Map<string, number>;
  /** Bumped when a new round places every ship back at its base. */
  roundId: number;
  matchPhase: MatchPhase;
  countdownEndsAt: number | null;
  roster: string;
  nextEntityId: number;
}

export type AirCaptureEvent =
  | { type: "sound"; sound: HostSfxId }
  | {
      type: "haptic";
      controllerId: string;
      pattern: "light" | "medium" | "heavy" | "success";
    }
  | {
      type: "impact";
      position: [number, number, number];
      normal: [number, number, number];
    }
  | { type: "ship-destroyed"; position: [number, number, number] }
  | { type: "rocket-exploded"; position: [number, number, number] }
  | {
      type: "collectible-taken";
      abilityId: AbilityId;
      position: [number, number, number];
    }
  | { type: "jump-pad"; padId: string }
  | { type: "flag-touched"; teamId: TeamId };

export type Emit = (event: AirCaptureEvent) => void;

export const nextEntityId = (sim: AirCaptureSim, prefix: string): string =>
  `${prefix}-${(sim.nextEntityId += 1)}`;

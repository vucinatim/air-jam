import { ARENA_RADIUS } from "../constants";
import { TEAM_IDS, type TeamId } from "./team";

export type FlagStatus = "atBase" | "carried" | "dropped";
export type FlagPickupOutcome =
  | "none"
  | "pickedUpEnemyFlag"
  | "returnedFriendlyFlag";
export type BaseEntryOutcome =
  | "none"
  | "pickedUpEnemyFlag"
  | "returnedFriendlyFlag"
  | "scoredPoint";
export type TeamPosition = [number, number, number];
export type TeamPositions = Record<TeamId, TeamPosition>;
export type TeamScores = Record<TeamId, number>;
export type PlayerTeams = Record<string, TeamId>;

export interface FlagState {
  teamId: TeamId;
  status: FlagStatus;
  position: TeamPosition;
  carrierId?: string;
}

export type FlagMap = Record<TeamId, FlagState>;

export interface CaptureTheFlagSnapshot {
  playerTeams: PlayerTeams;
  flags: FlagMap;
  scores: TeamScores;
  basePositions: TeamPositions;
}

export function createInitialFlags(basePositions: TeamPositions): FlagMap {
  return TEAM_IDS.reduce(
    (acc, teamId) => {
      acc[teamId] = {
        teamId,
        status: "atBase",
        position: [...basePositions[teamId]],
      };
      return acc;
    },
    {} as FlagMap,
  );
}

export function createInitialScores(): TeamScores {
  return TEAM_IDS.reduce(
    (acc, teamId) => {
      acc[teamId] = 0;
      return acc;
    },
    {} as TeamScores,
  );
}

export function getEnemyTeam(team: TeamId): TeamId {
  return TEAM_IDS.find((id) => id !== team) ?? team;
}

export function generateRandomBasePositions(
  random = Math.random,
): TeamPositions {
  const minDistance = ARENA_RADIUS * 0.65;
  const maxDistance = ARENA_RADIUS * 0.85;
  const maxSafeDistance = ARENA_RADIUS - 15;

  const firstBase = generateBasePosition(minDistance, maxDistance, maxSafeDistance, random);
  const oppositeAngle = Math.atan2(firstBase[2], firstBase[0]) + Math.PI;
  const secondBase = generateBasePositionAtAngle(
    oppositeAngle,
    minDistance,
    maxDistance,
    maxSafeDistance,
    random,
  );

  if (distanceFromCenter(firstBase) > ARENA_RADIUS || distanceFromCenter(secondBase) > ARENA_RADIUS) {
    return {
      solaris: [ARENA_RADIUS * 0.7, 0, 0],
      nebulon: [-ARENA_RADIUS * 0.7, 0, 0],
    };
  }

  return random() > 0.5
    ? {
        solaris: firstBase,
        nebulon: secondBase,
      }
    : {
        solaris: secondBase,
        nebulon: firstBase,
      };
}

function generateBasePosition(
  minDistance: number,
  maxDistance: number,
  maxSafeDistance: number,
  random: () => number,
): TeamPosition {
  const angle = random() * Math.PI * 2;
  return generateBasePositionAtAngle(
    angle,
    minDistance,
    maxDistance,
    maxSafeDistance,
    random,
  );
}

function generateBasePositionAtAngle(
  angle: number,
  minDistance: number,
  maxDistance: number,
  maxSafeDistance: number,
  random: () => number,
): TeamPosition {
  const distance = minDistance + random() * (maxDistance - minDistance);
  let x = Math.cos(angle) * distance;
  let z = Math.sin(angle) * distance;
  const radialDistance = Math.sqrt(x * x + z * z);

  if (radialDistance > maxSafeDistance) {
    const scale = maxSafeDistance / radialDistance;
    x *= scale;
    z *= scale;
  }

  return [x, 0, z];
}

function distanceFromCenter(position: TeamPosition) {
  return Math.sqrt(position[0] * position[0] + position[2] * position[2]);
}

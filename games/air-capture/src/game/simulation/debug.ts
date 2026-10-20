/**
 * Edits the debug panel makes to a running match, between steps. They are
 * developer tools: a replay of the match does not include them.
 */
import type { AbilityId } from "../abilities/definitions";
import type { TeamId } from "../domain/team";
import { reduceManualScore } from "../stores/match/capture-the-flag-store-state";
import { collectAbility } from "./ships";
import { MAX_HEALTH, type AirCaptureSim } from "./state";

export const debugSetHealth = (
  sim: AirCaptureSim,
  controllerId: string,
  health: number,
): void => {
  const ship = sim.ships.get(controllerId);
  if (ship) ship.health = Math.max(0, Math.min(MAX_HEALTH, health));
};

export const debugGiveAbility = (
  sim: AirCaptureSim,
  controllerId: string,
  abilityId: AbilityId,
): void => {
  const ship = sim.ships.get(controllerId);
  if (ship) collectAbility(ship, abilityId);
};

export const debugClearAbility = (
  sim: AirCaptureSim,
  controllerId: string,
): void => {
  const ship = sim.ships.get(controllerId);
  if (!ship) return;
  if (ship.activeAbility?.id === "speed_boost") ship.speedMultiplier = 1;
  ship.activeAbility = null;
  ship.queuedAbility = null;
};

export const debugAwardPoint = (sim: AirCaptureSim, teamId: TeamId): void => {
  sim.ctf = reduceManualScore(sim.ctf, teamId);
};

import { Vector3 } from "three";
import { SHIP_ENGINE_CONFIG } from "./flight";

export const SHIP_RESPAWN_DELAY_SECONDS = 2.0;
export const SHIP_RESPAWN_HEIGHT_OFFSET = 5;

export function getShipDeathPosition(
  shipWorldPosition: Vector3,
): [number, number, number] {
  return [
    shipWorldPosition.x,
    shipWorldPosition.y - SHIP_ENGINE_CONFIG.HOVER_HEIGHT,
    shipWorldPosition.z,
  ];
}

export function buildShipRespawnPosition(basePosition: [number, number, number]): [
  number,
  number,
  number,
] {
  return [
    basePosition[0],
    basePosition[1] + SHIP_RESPAWN_HEIGHT_OFFSET,
    basePosition[2],
  ];
}

export function scheduleShipRespawn(
  currentTime: number,
  delaySeconds = SHIP_RESPAWN_DELAY_SECONDS,
): number {
  return currentTime + delaySeconds;
}

export function shouldRespawnShip(
  currentTime: number,
  respawnAt: number,
): boolean {
  return respawnAt > 0 && currentTime >= respawnAt;
}

import { Quaternion, Vector3 } from "three";
import { SHIP_ENGINE_CONFIG } from "./flight";

const SHIP_GUN_OFFSETS = [
  new Vector3(-1.5, 0, 0.95),
  new Vector3(1.5, 0, 0.95),
];

const SHIP_MUZZLE_OFFSET = {
  forward: 3.5,
  up: 0.5,
} as const;

export interface ShipLaserShot {
  id: string;
  position: [number, number, number];
  direction: Vector3;
  controllerId: string;
  timestamp: number;
}

export function shouldFireShipWeapons(params: {
  actionPressed: boolean;
  wasActionPressed: boolean;
  time: number;
  lastShotAt: number;
  shootInterval?: number;
}): boolean {
  const {
    actionPressed,
    wasActionPressed,
    time,
    lastShotAt,
    shootInterval = SHIP_ENGINE_CONFIG.SHOOT_INTERVAL,
  } = params;

  const pressedThisFrame = actionPressed && !wasActionPressed;
  const heldLongEnough = actionPressed && time - lastShotAt >= shootInterval;
  return pressedThisFrame || heldLongEnough;
}

export function buildShipLaserShots(params: {
  controllerId: string;
  shipWorldPosition: Vector3;
  shipRotation: Quaternion;
  time: number;
}): ShipLaserShot[] {
  const { controllerId, shipWorldPosition, shipRotation, time } = params;

  const forward = new Vector3(0, 0, -1).applyQuaternion(shipRotation);
  const up = new Vector3(0, 1, 0).applyQuaternion(shipRotation);
  const muzzleOffset = forward
    .clone()
    .multiplyScalar(SHIP_MUZZLE_OFFSET.forward)
    .add(up.multiplyScalar(SHIP_MUZZLE_OFFSET.up));

  return SHIP_GUN_OFFSETS.map((gunOffset, index) => {
    const worldPosition = gunOffset
      .clone()
      .applyQuaternion(shipRotation)
      .add(shipWorldPosition)
      .add(muzzleOffset);

    return {
      id: `${controllerId}-${time}-${index === 0 ? "L" : "R"}`,
      position: [worldPosition.x, worldPosition.y, worldPosition.z],
      direction: forward.clone(),
      controllerId,
      timestamp: time,
    };
  });
}

import type { RapierRigidBody } from "@react-three/rapier";
import { Quaternion, Vector3 } from "three";

export const shipPositions = new Map<string, Vector3>();
export const shipRotations = new Map<string, Quaternion>();

export interface ShipRuntimeState {
  smoothedInput: {
    x: number;
    y: number;
  };
  wingRoll: number;
  velocity: Vector3;
  angularVelocity: number;
  pitchAngularVelocity: number;
  rotation: Quaternion;
  lastActionPressed: boolean;
  lastShotAt: number;
  respawnAt: number;
  pendingRespawnPosition: [number, number, number] | null;
  idleSoundId: number | null;
  thrustSoundId: number | null;
}

export interface ShipPhysicsSnapshot {
  position: { x: number; y: number; z: number };
  linearVelocity: { x: number; y: number; z: number };
  worldPosition: Vector3;
}

export function createShipRuntimeState(): ShipRuntimeState {
  return {
    smoothedInput: { x: 0, y: 0 },
    wingRoll: 0,
    velocity: new Vector3(),
    angularVelocity: 0,
    pitchAngularVelocity: 0,
    rotation: new Quaternion(),
    lastActionPressed: false,
    lastShotAt: 0,
    respawnAt: 0,
    pendingRespawnPosition: null,
    idleSoundId: null,
    thrustSoundId: null,
  };
}

export function clearTrackedShipPose(controllerId: string) {
  shipPositions.delete(controllerId);
  shipRotations.delete(controllerId);
}

export function updateTrackedShipPose(
  controllerId: string,
  position: Vector3,
  rotation: Quaternion,
) {
  shipPositions.set(controllerId, position.clone());
  shipRotations.set(controllerId, rotation.clone());
}

export function resetShipRuntimeMotion(runtime: ShipRuntimeState) {
  runtime.rotation.setFromAxisAngle(new Vector3(0, 1, 0), 0);
  runtime.velocity.set(0, 0, 0);
  runtime.angularVelocity = 0;
  runtime.pitchAngularVelocity = 0;
}

export function applyPendingShipRespawn(
  rigidBody: RapierRigidBody,
  runtime: ShipRuntimeState,
) {
  if (!runtime.pendingRespawnPosition) {
    return false;
  }

  const [x, y, z] = runtime.pendingRespawnPosition;
  rigidBody.setTranslation({ x, y, z }, true);
  rigidBody.setLinvel({ x: 0, y: 0, z: 0 }, true);
  rigidBody.setAngvel({ x: 0, y: 0, z: 0 }, true);
  resetShipRuntimeMotion(runtime);
  runtime.pendingRespawnPosition = null;
  return true;
}

export function readShipPhysicsSnapshot(
  rigidBody: RapierRigidBody,
): ShipPhysicsSnapshot {
  const position = rigidBody.translation();
  const linearVelocity = rigidBody.linvel();

  return {
    position,
    linearVelocity,
    worldPosition: new Vector3(position.x, position.y, position.z),
  };
}

export function applyShipPhysics(
  rigidBody: RapierRigidBody,
  velocity: Vector3,
  rotation: Quaternion,
) {
  rigidBody.setLinvel(velocity, true);
  rigidBody.setRotation(rotation, true);
  rigidBody.setAngvel({ x: 0, y: 0, z: 0 }, true);
}

import { Object3D, Vector3 } from "three";

export interface ProjectileDecalPlacement {
  position: [number, number, number];
  normal: Vector3;
}

export function findHitControllerId(object: Object3D | null): string | null {
  let currentObject = object;

  while (currentObject) {
    if (currentObject.userData?.controllerId) {
      return currentObject.userData.controllerId as string;
    }

    currentObject = currentObject.parent;
  }

  return null;
}

export function resolveImpactWorldNormal(
  object: Object3D,
  localNormal: Vector3,
): Vector3 {
  const worldNormal = localNormal.clone();
  object.updateMatrixWorld();
  worldNormal.transformDirection(object.matrixWorld);
  return worldNormal.normalize();
}

export function buildProjectileDecalPlacement(
  hitPoint: Vector3,
  worldNormal: Vector3,
  offset = 0.01,
): ProjectileDecalPlacement {
  const decalOffset = worldNormal.clone().multiplyScalar(offset);

  return {
    position: [
      hitPoint.x + decalOffset.x,
      hitPoint.y + decalOffset.y,
      hitPoint.z + decalOffset.z,
    ],
    normal: worldNormal.clone(),
  };
}

export function calculateLaserKnockbackImpulse(
  direction: Vector3,
  force: number,
): Vector3 {
  return direction.clone().normalize().multiplyScalar(force);
}

export function calculateExplosionDamage(
  distance: number,
  radius: number,
  maxDamage: number,
): number {
  if (distance > radius) {
    return 0;
  }

  return Math.ceil(maxDamage * (1 - distance / radius));
}

export function calculateDirectHitDamage(currentHealth: number): number {
  return Math.max(0, currentHealth);
}

export function calculateExplosionImpulse(params: {
  explosionOrigin: Vector3;
  targetPosition: Vector3;
  radius: number;
  maxForce: number;
}): Vector3 {
  const { explosionOrigin, targetPosition, radius, maxForce } = params;
  const distance = explosionOrigin.distanceTo(targetPosition);

  if (distance > radius) {
    return new Vector3();
  }

  const forceMultiplier = 1 - distance / radius;
  return targetPosition
    .clone()
    .sub(explosionOrigin)
    .normalize()
    .multiplyScalar(maxForce * forceMultiplier);
}

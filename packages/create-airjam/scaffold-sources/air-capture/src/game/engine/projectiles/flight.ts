import { Quaternion, Vector3 } from "three";

export interface ProjectileRaySegment {
  origin: Vector3;
  direction: Vector3;
  distance: number;
}

export function getProjectileRotation(direction: Vector3): Quaternion {
  const defaultForward = new Vector3(0, 0, -1);
  const targetDirection = direction.clone().normalize();
  const quaternion = new Quaternion();
  quaternion.setFromUnitVectors(defaultForward, targetDirection);
  return quaternion;
}

export function advanceProjectilePosition(
  currentPosition: Vector3,
  direction: Vector3,
  speed: number,
  delta: number,
): {
  normalizedDirection: Vector3;
  nextPosition: Vector3;
} {
  const normalizedDirection = direction.clone().normalize();
  const movement = normalizedDirection.clone().multiplyScalar(speed * delta);

  return {
    normalizedDirection,
    nextPosition: currentPosition.clone().add(movement),
  };
}

export function buildProjectileRaySegment(
  previousPosition: Vector3,
  nextPosition: Vector3,
): ProjectileRaySegment | null {
  const rayDelta = nextPosition.clone().sub(previousPosition);
  const distance = rayDelta.length();

  if (distance <= 0) {
    return null;
  }

  return {
    origin: previousPosition,
    direction: rayDelta.normalize(),
    distance,
  };
}

export function shouldExpireProjectile(
  lifetime: number,
  maxLifetime: number,
): boolean {
  return lifetime > maxLifetime;
}

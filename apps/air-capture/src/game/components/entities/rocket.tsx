import { memo, useMemo, useRef, useState } from "react";
import { Group, Vector3 } from "three";
import { getProjectileRotation } from "../../engine/projectiles/flight";
import { useRocketRuntime } from "../../engine/projectiles/use-rocket-runtime";
import { useRocketsStore } from "../../stores/projectiles/rockets-store";
import { RocketExplosion } from "../effects/rocket-explosion";
import { RocketModel } from "../models/rocket-model";

interface RocketProps {
  id: string;
  position: [number, number, number];
  direction: Vector3;
  controllerId: string;
}

const ROCKET_SPEED = 80; // Slower than lasers
const ROCKET_LIFETIME = 5; // Longer lifetime
const ROCKET_DAMAGE = 50; // More damage than lasers
const ROCKET_KNOCKBACK = 500; // More knockback
const EXPLOSION_RADIUS = 5; // Explosion radius for area damage

export function Rocket({ id, position, direction, controllerId }: RocketProps) {
  const [hasHit, setHasHit] = useState(false);
  const [explosionPosition, setExplosionPosition] = useState<
    [number, number, number] | null
  >(null);
  const removeRocket = useRocketsStore((state) => state.removeRocket);
  const groupRef = useRef<Group>(null);

  const rotationQuaternion = useMemo(
    () => getProjectileRotation(direction),
    [direction],
  );

  useRocketRuntime({
    id,
    position,
    direction,
    controllerId,
    groupRef,
    speed: ROCKET_SPEED,
    maxLifetime: ROCKET_LIFETIME,
    damage: ROCKET_DAMAGE,
    knockbackForce: ROCKET_KNOCKBACK,
    explosionRadius: EXPLOSION_RADIUS,
    hasHit,
    setHasHit,
    setExplosionPosition,
  });

  return (
    <>
      {!hasHit && (
        <group
          ref={groupRef}
          position={position}
          quaternion={rotationQuaternion}
        >
          <RocketModel showParticles={true} horizontal={true} />
        </group>
      )}
      {explosionPosition && (
        <RocketExplosion
          position={explosionPosition}
          onComplete={() => {
            removeRocket(id);
          }}
        />
      )}
    </>
  );
}

export const RocketEntity = memo(Rocket, (prev, next) => {
  return (
    prev.id === next.id &&
    prev.controllerId === next.controllerId &&
    prev.position[0] === next.position[0] &&
    prev.position[1] === next.position[1] &&
    prev.position[2] === next.position[2] &&
    prev.direction.equals(next.direction)
  );
});

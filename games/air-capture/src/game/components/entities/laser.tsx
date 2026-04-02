import { memo, useMemo, useRef } from "react";
import type { Mesh } from "three";
import {
  BoxGeometry,
  MeshStandardMaterial,
  Vector3,
} from "three";
import { getProjectileRotation } from "../../engine/projectiles/flight";
import { useLaserRuntime } from "../../engine/projectiles/use-laser-runtime";

interface LaserProps {
  id: string;
  position: [number, number, number];
  direction: Vector3;
  controllerId: string;
}

const LASER_SPEED = 150;
const LASER_LIFETIME = 2; // seconds
const KNOCKBACK_FORCE = 300; // Force applied when laser hits a ship
const LASER_DAMAGE = 20; // Health damage when laser hits a ship

const LaserComponent = ({
  id,
  position,
  direction,
  controllerId,
}: LaserProps) => {
  const meshRef = useRef<Mesh>(null);

  const geometry = useMemo(() => new BoxGeometry(0.2, 0.2, 5), []);
  const material = useMemo(
    () =>
      new MeshStandardMaterial({
        color: 0x00ffff,
        emissive: 0x00ffff,
        emissiveIntensity: 5,
        toneMapped: false,
      }),
    [],
  );

  const rotationQuaternion = useMemo(
    () => getProjectileRotation(direction),
    [direction],
  );

  useLaserRuntime({
    id,
    position,
    direction,
    controllerId,
    meshRef,
    speed: LASER_SPEED,
    maxLifetime: LASER_LIFETIME,
    damage: LASER_DAMAGE,
    knockbackForce: KNOCKBACK_FORCE,
  });

  return (
    <mesh
      ref={meshRef}
      position={position}
      geometry={geometry}
      material={material}
      castShadow
      quaternion={rotationQuaternion}
    />
  );
};
export const Laser = memo(LaserComponent, (prev, next) => {
  return (
    prev.id === next.id &&
    prev.controllerId === next.controllerId &&
    prev.position[0] === next.position[0] &&
    prev.position[1] === next.position[1] &&
    prev.position[2] === next.position[2] &&
    prev.direction.equals(next.direction)
  );
});

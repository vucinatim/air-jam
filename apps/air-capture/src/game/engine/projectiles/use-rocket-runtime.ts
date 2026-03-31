import { useFrame, useThree } from "@react-three/fiber";
import { useRapier } from "@react-three/rapier";
import { useRef, type RefObject } from "react";
import { Raycaster, Vector3, type Group } from "three";

import { useHostAudio } from "../../audio/use-host-audio";
import {
  buildProjectileDecalPlacement,
  calculateExplosionDamage,
  calculateExplosionImpulse,
  findHitControllerId,
  resolveImpactWorldNormal,
} from "./impact";
import {
  advanceProjectilePosition,
  buildProjectileRaySegment,
  getProjectileRotation,
  shouldExpireProjectile,
} from "./flight";
import {
  collectProjectileRuntimeTargets,
  forEachControllerRigidBody,
} from "./runtime";
import { useDecalsStore } from "../../stores/world/decals-store";
import { useHealthStore } from "../../stores/players/health-store";
import { useRocketsStore } from "../../stores/projectiles/rockets-store";

interface UseRocketRuntimeParams {
  id: string;
  position: [number, number, number];
  direction: Vector3;
  controllerId: string;
  groupRef: RefObject<Group | null>;
  speed: number;
  maxLifetime: number;
  damage: number;
  knockbackForce: number;
  explosionRadius: number;
  hasHit: boolean;
  setHasHit(value: boolean): void;
  setExplosionPosition(position: [number, number, number] | null): void;
}

export function useRocketRuntime({
  id,
  position,
  direction,
  controllerId,
  groupRef,
  speed,
  maxLifetime,
  damage,
  knockbackForce,
  explosionRadius,
  hasHit,
  setHasHit,
  setExplosionPosition,
}: UseRocketRuntimeParams) {
  const { scene } = useThree();
  const { world } = useRapier();
  const currentPositionRef = useRef(new Vector3(...position));
  const previousPositionRef = useRef(new Vector3(...position));
  const lifetimeRef = useRef(0);
  const audio = useHostAudio();
  const removeRocket = useRocketsStore((state) => state.removeRocket);
  const addDecal = useDecalsStore((state) => state.addDecal);
  const reduceHealth = useHealthStore((state) => state.reduceHealth);
  const raycasterRef = useRef(new Raycaster());

  useFrame((_state, delta) => {
    if (hasHit || !groupRef.current) {
      return;
    }

    groupRef.current.quaternion.copy(getProjectileRotation(direction));

    const { nextPosition } = advanceProjectilePosition(
      currentPositionRef.current,
      direction,
      speed,
      delta,
    );
    const raySegment = buildProjectileRaySegment(
      previousPositionRef.current,
      nextPosition,
    );

    if (raySegment) {
      raycasterRef.current.set(raySegment.origin, raySegment.direction);
      raycasterRef.current.far = raySegment.distance;

      const { ships, obstacles } = collectProjectileRuntimeTargets(
        scene,
        controllerId,
      );

      const shipIntersects = raycasterRef.current.intersectObjects(ships, true);
      if (shipIntersects.length > 0) {
        const hit = shipIntersects[0];
        const hitPoint = hit.point;
        const hitControllerId = findHitControllerId(hit.object);

        if (hitControllerId) {
          const hitPosition = new Vector3(hitPoint.x, hitPoint.y, hitPoint.z);
          setExplosionPosition([hitPosition.x, hitPosition.y, hitPosition.z]);

          forEachControllerRigidBody(world, ({ body, controllerId: targetId }) => {
            if (targetId === controllerId) {
              return;
            }

            const shipPos = body.translation();
            const shipWorldPos = new Vector3(shipPos.x, shipPos.y, shipPos.z);
            const distance = hitPosition.distanceTo(shipWorldPos);
            if (distance > explosionRadius) {
              return;
            }

            reduceHealth(
              targetId,
              calculateExplosionDamage(distance, explosionRadius, damage),
            );

            const knockback = calculateExplosionImpulse({
              explosionOrigin: hitPosition,
              targetPosition: shipWorldPos,
              radius: explosionRadius,
              maxForce: knockbackForce,
            });
            body.applyImpulse(
              { x: knockback.x, y: knockback.y, z: knockback.z },
              true,
            );
          });

          audio.play("rocket_explosion");

          const hitNormal = hit.face?.normal;
          if (hitNormal) {
            const worldNormal = resolveImpactWorldNormal(hit.object, hitNormal);
            addDecal(buildProjectileDecalPlacement(hitPoint, worldNormal));
          }

          setHasHit(true);
          return;
        }
      }

      const obstacleIntersects = raycasterRef.current.intersectObjects(
        obstacles,
        true,
      );
      if (obstacleIntersects.length > 0) {
        const hit = obstacleIntersects[0];
        const hitPoint = hit.point;
        const hitNormal = hit.face?.normal;

        if (hitNormal) {
          setExplosionPosition([hitPoint.x, hitPoint.y, hitPoint.z]);
          const worldNormal = resolveImpactWorldNormal(hit.object, hitNormal);
          addDecal(buildProjectileDecalPlacement(hitPoint, worldNormal));
          audio.play("rocket_explosion");
          setHasHit(true);
          return;
        }
      }
    }

    currentPositionRef.current.copy(nextPosition);
    previousPositionRef.current.copy(nextPosition);
    groupRef.current.position.copy(nextPosition);

    lifetimeRef.current += delta;
    if (shouldExpireProjectile(lifetimeRef.current, maxLifetime)) {
      removeRocket(id);
    }
  });
}

import { useFrame, useThree } from "@react-three/fiber";
import { useRapier } from "@react-three/rapier";
import { useRef, type RefObject } from "react";
import type { Mesh } from "three";
import { Raycaster, Vector3 } from "three";

import { useSendSignal } from "@air-jam/sdk";
import { useHostAudio } from "../../audio/host-audio";
import {
  buildProjectileDecalPlacement,
  calculateLaserKnockbackImpulse,
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
  findControllerRigidBody,
} from "./runtime";
import { useDecalsStore } from "../../stores/world/decals-store";
import { useHealthStore } from "../../stores/players/health-store";
import { useLasersStore } from "../../stores/projectiles/lasers-store";

interface UseLaserRuntimeParams {
  id: string;
  position: [number, number, number];
  direction: Vector3;
  controllerId: string;
  meshRef: RefObject<Mesh | null>;
  speed: number;
  maxLifetime: number;
  damage: number;
  knockbackForce: number;
}

export function useLaserRuntime({
  id,
  position,
  direction,
  controllerId,
  meshRef,
  speed,
  maxLifetime,
  damage,
  knockbackForce,
}: UseLaserRuntimeParams) {
  const { scene } = useThree();
  const { world } = useRapier();
  const currentPositionRef = useRef(new Vector3(...position));
  const previousPositionRef = useRef(new Vector3(...position));
  const lifetimeRef = useRef(0);
  const hasHitRef = useRef(false);
  const raycasterRef = useRef(new Raycaster());
  const removeLaser = useLasersStore((state) => state.removeLaser);
  const addDecal = useDecalsStore((state) => state.addDecal);
  const reduceHealth = useHealthStore((state) => state.reduceHealth);
  const audio = useHostAudio();
  const sendSignal = useSendSignal();

  useFrame((_state, delta) => {
    if (hasHitRef.current) {
      return;
    }

    if (meshRef.current) {
      meshRef.current.quaternion.copy(getProjectileRotation(direction));
    }

    const { normalizedDirection, nextPosition } = advanceProjectilePosition(
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

      const { obstacles, ships } = collectProjectileRuntimeTargets(
        scene,
        controllerId,
      );

      const shipIntersects = raycasterRef.current.intersectObjects(ships, true);
      if (shipIntersects.length > 0) {
        const hit = shipIntersects[0];
        const hitPoint = hit.point;
        const hitNormal = hit.face?.normal;

        if (hitNormal) {
          const worldNormal = resolveImpactWorldNormal(hit.object, hitNormal);
          const hitControllerId = findHitControllerId(hit.object);
          const shipRigidBody = hitControllerId
            ? findControllerRigidBody(world, hitControllerId)
            : null;

          if (hitControllerId && hitControllerId !== controllerId) {
            reduceHealth(hitControllerId, damage);
            audio.play("hit");
            sendSignal?.("HAPTIC", { pattern: "heavy" }, hitControllerId);
            sendSignal?.("HAPTIC", { pattern: "success" }, controllerId);
          }

          if (shipRigidBody) {
            const knockbackDirection = calculateLaserKnockbackImpulse(
              normalizedDirection,
              knockbackForce,
            );
            shipRigidBody.applyImpulse(
              {
                x: knockbackDirection.x,
                y: knockbackDirection.y,
                z: knockbackDirection.z,
              },
              true,
            );
          }

          hasHitRef.current = true;
          addDecal(buildProjectileDecalPlacement(hitPoint, worldNormal));
          removeLaser(id);
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
          const worldNormal = resolveImpactWorldNormal(hit.object, hitNormal);
          hasHitRef.current = true;
          addDecal(buildProjectileDecalPlacement(hitPoint, worldNormal));
          removeLaser(id);
          return;
        }
      }
    }

    currentPositionRef.current.copy(nextPosition);
    previousPositionRef.current.copy(nextPosition);
    if (meshRef.current) {
      meshRef.current.position.copy(nextPosition);
    }

    lifetimeRef.current += delta;
    if (shouldExpireProjectile(lifetimeRef.current, maxLifetime)) {
      removeLaser(id);
    }
  });
}

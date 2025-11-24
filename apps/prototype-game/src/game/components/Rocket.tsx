import { useFrame, useThree } from "@react-three/fiber";
import { useRef, useMemo, useState } from "react";
import { Vector3, Raycaster, Quaternion, Group, Object3D } from "three";
import { useRapier } from "@react-three/rapier";
import { useRocketsStore } from "../rockets-store";
import { useDecalsStore } from "../decals-store";
import { useHealthStore } from "../health-store";
import { RocketModel } from "./RocketModel";
import { RocketExplosion } from "./RocketExplosion";

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
  const { scene } = useThree();
  const { world } = useRapier();
  const [currentPosition, setCurrentPosition] = useState(
    () => new Vector3(...position)
  );
  const previousPositionRef = useRef(new Vector3(...position));
  const lifetimeRef = useRef(0);
  const [hasHit, setHasHit] = useState(false);
  const [explosionPosition, setExplosionPosition] = useState<
    [number, number, number] | null
  >(null);
  const removeRocket = useRocketsStore((state) => state.removeRocket);
  const addDecal = useDecalsStore((state) => state.addDecal);
  const reduceHealth = useHealthStore((state) => state.reduceHealth);
  const raycasterRef = useRef(new Raycaster());
  const groupRef = useRef<Group>(null);

  // Calculate rotation quaternion to align rocket with direction
  const rotationQuaternion = useMemo(() => {
    const defaultForward = new Vector3(0, 0, -1);
    const targetDirection = direction.clone().normalize();
    const quaternion = new Quaternion();
    quaternion.setFromUnitVectors(defaultForward, targetDirection);
    return quaternion;
  }, [direction]);

  useFrame((_state, delta) => {
    if (hasHit || !groupRef.current) return;

    // Update rotation
    const defaultForward = new Vector3(0, 0, -1);
    const targetDirection = direction.clone().normalize();
    const quaternion = new Quaternion();
    quaternion.setFromUnitVectors(defaultForward, targetDirection);
    groupRef.current.quaternion.copy(quaternion);

    // Update position
    const normalizedDir = direction.clone().normalize();
    const movement = normalizedDir.multiplyScalar(ROCKET_SPEED * delta);
    const newPosition = currentPosition.clone().add(movement);

    // Cast ray for hit detection
    const rayOrigin = previousPositionRef.current;
    const rayDirection = newPosition
      .clone()
      .sub(previousPositionRef.current)
      .normalize();
    const maxDistance = newPosition.distanceTo(previousPositionRef.current);

    if (maxDistance > 0) {
      raycasterRef.current.set(rayOrigin, rayDirection);
      raycasterRef.current.far = maxDistance;

      // Get all ships (same method as Laser)
      const ships: Object3D[] = [];
      scene.traverse((object) => {
        if (
          object.userData?.controllerId &&
          object.userData.controllerId !== controllerId
        ) {
          ships.push(object);
        }
      });

      const shipIntersects = raycasterRef.current.intersectObjects(ships, true);

      if (shipIntersects.length > 0) {
        const hit = shipIntersects[0];
        const hitPoint = hit.point;

        // Find controllerId by traversing up parent chain (same as Laser)
        let hitControllerId: string | null = null;
        let currentObject: Object3D | null = hit.object;
        while (currentObject) {
          if (currentObject.userData?.controllerId) {
            hitControllerId = currentObject.userData.controllerId;
            break;
          }
          currentObject = currentObject.parent;
        }

        if (hitControllerId) {
          // Area damage - damage all ships within explosion radius
          const hitPos = new Vector3(hitPoint.x, hitPoint.y, hitPoint.z);

          // Trigger explosion effect
          setExplosionPosition([hitPos.x, hitPos.y, hitPos.z]);

          // Get all ship positions from the world
          world.bodies.forEach((body) => {
            const bodyUserData = body.userData;
            if (
              bodyUserData &&
              typeof bodyUserData === "object" &&
              "controllerId" in bodyUserData
            ) {
              const userData = bodyUserData as { controllerId?: string };
              const shipControllerId = userData.controllerId;

              if (shipControllerId && shipControllerId !== controllerId) {
                const shipPos = body.translation();
                const shipWorldPos = new Vector3(
                  shipPos.x,
                  shipPos.y,
                  shipPos.z
                );
                const distance = hitPos.distanceTo(shipWorldPos);

                if (distance <= EXPLOSION_RADIUS) {
                  // Damage based on distance (more damage closer to center)
                  const damageMultiplier = 1 - distance / EXPLOSION_RADIUS;
                  const damage = Math.ceil(ROCKET_DAMAGE * damageMultiplier);
                  reduceHealth(shipControllerId, damage);

                  // Apply knockback
                  const knockbackDir = shipWorldPos
                    .clone()
                    .sub(hitPos)
                    .normalize();
                  const knockbackForce = knockbackDir.multiplyScalar(
                    ROCKET_KNOCKBACK * damageMultiplier
                  );
                  body.applyImpulse(
                    {
                      x: knockbackForce.x,
                      y: knockbackForce.y,
                      z: knockbackForce.z,
                    },
                    true
                  );
                }
              }
            }
          });

          // Spawn decal
          const hitNormal = hit.face?.normal;
          if (hitNormal) {
            const worldNormal = hitNormal.clone();
            if (hit.object.parent) {
              hit.object.parent.updateMatrixWorld();
              worldNormal.transformDirection(hit.object.parent.matrixWorld);
            }
            worldNormal.normalize();

            const offset = worldNormal.clone().multiplyScalar(0.01);
            const decalPosition: [number, number, number] = [
              hitPoint.x + offset.x,
              hitPoint.y + offset.y,
              hitPoint.z + offset.z,
            ];

            addDecal({
              position: decalPosition,
              normal: worldNormal,
            });
          }

          setHasHit(true);
          // Don't remove rocket immediately - let explosion play first
          // removeRocket will be called after explosion finishes
          return;
        }
      }

      // Check for obstacle/ground hits (both handled the same way)
      const obstacles: Object3D[] = [];
      scene.traverse((object) => {
        if (
          object.userData?.type === "obstacle" ||
          object.userData?.type === "ground"
        ) {
          obstacles.push(object);
        }
      });

      const obstacleIntersects = raycasterRef.current.intersectObjects(
        obstacles,
        true
      );

      if (obstacleIntersects.length > 0) {
        const hit = obstacleIntersects[0];
        const hitPoint = hit.point;
        const hitNormal = hit.face?.normal;

        if (hitNormal) {
          // Trigger explosion effect
          setExplosionPosition([hitPoint.x, hitPoint.y, hitPoint.z]);

          const worldNormal = hitNormal.clone();
          if (hit.object.parent) {
            hit.object.parent.updateMatrixWorld();
            worldNormal.transformDirection(hit.object.parent.matrixWorld);
          }
          worldNormal.normalize();

          const offset = worldNormal.clone().multiplyScalar(0.01);
          const decalPosition: [number, number, number] = [
            hitPoint.x + offset.x,
            hitPoint.y + offset.y,
            hitPoint.z + offset.z,
          ];

          addDecal({
            position: decalPosition,
            normal: worldNormal,
          });

          setHasHit(true);
          // Don't remove rocket immediately - let explosion play first
          // removeRocket will be called after explosion finishes
          return;
        }
      }
    }

    // Update position for next frame
    setCurrentPosition(newPosition);
    previousPositionRef.current.copy(newPosition);

    // Check lifetime (only if not hit)
    if (!hasHit) {
      lifetimeRef.current += delta;
      if (lifetimeRef.current > ROCKET_LIFETIME) {
        removeRocket(id);
      }
    }
  });

  return (
    <>
      {!hasHit && (
        <group
          ref={groupRef}
          position={currentPosition}
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

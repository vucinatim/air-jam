import { useAudio } from "@air-jam/sdk";
import { useFrame, useThree } from "@react-three/fiber";
import { useRapier, type RapierRigidBody } from "@react-three/rapier";
import { useMemo, useRef, useState } from "react";
import type { Mesh } from "three";
import {
  BoxGeometry,
  MeshStandardMaterial,
  Object3D,
  Quaternion,
  Raycaster,
  Vector3,
} from "three";
import { useSignalContext } from "../context/signal-context";
import { useDecalsStore } from "../decals-store";
import { useHealthStore } from "../health-store";
import { useLasersStore } from "../lasers-store";
import { SOUND_MANIFEST } from "../sounds";

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

export function Laser({ id, position, direction, controllerId }: LaserProps) {
  const { scene } = useThree();
  const { world } = useRapier();
  const [currentPosition, setCurrentPosition] = useState(
    () => new Vector3(...position),
  );
  const previousPositionRef = useRef(new Vector3(...position));
  const lifetimeRef = useRef(0);
  const hasHitRef = useRef(false);
  const removeLaser = useLasersStore((state) => state.removeLaser);
  const addDecal = useDecalsStore((state) => state.addDecal);
  const reduceHealth = useHealthStore((state) => state.reduceHealth);
  const raycasterRef = useRef(new Raycaster());
  const meshRef = useRef<Mesh>(null);
  const audio = useAudio(SOUND_MANIFEST);
  const sendSignal = useSignalContext();

  // Create elongated box geometry (width, height, length)
  // Similar to the example: BoxGeometry(0.2, 0.2, 4)
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

  // Calculate rotation quaternion to align box with direction
  // Box's length is along Z-axis, we need to rotate it to match direction
  const rotationQuaternion = useMemo(() => {
    const defaultForward = new Vector3(0, 0, -1); // Box's forward is -Z
    const targetDirection = direction.clone().normalize();

    // Create quaternion that rotates from defaultForward to targetDirection
    const quaternion = new Quaternion();
    quaternion.setFromUnitVectors(defaultForward, targetDirection);
    return quaternion;
  }, [direction]);

  useFrame((_state, delta) => {
    if (hasHitRef.current) return;

    // Update rotation to align with direction (in case direction changes)
    if (meshRef.current) {
      const defaultForward = new Vector3(0, 0, -1);
      const targetDirection = direction.clone().normalize();
      const quaternion = new Quaternion();
      quaternion.setFromUnitVectors(defaultForward, targetDirection);
      meshRef.current.quaternion.copy(quaternion);
    }

    // Update position based on direction and speed
    const normalizedDir = direction.clone().normalize();
    const movement = normalizedDir.multiplyScalar(LASER_SPEED * delta);
    const newPosition = currentPosition.clone().add(movement);

    // Cast a ray from previous position to current position
    // This ensures we detect hits even for fast-moving lasers
    const rayOrigin = previousPositionRef.current;
    const rayDirection = newPosition
      .clone()
      .sub(previousPositionRef.current)
      .normalize();
    const maxDistance = newPosition.distanceTo(previousPositionRef.current);

    if (maxDistance > 0) {
      // Use Three.js Raycaster for reliable hit detection
      raycasterRef.current.set(rayOrigin, rayDirection);
      raycasterRef.current.far = maxDistance;

      // Get all obstacles, ground, and ships from the scene
      const obstacles: Object3D[] = [];
      const ships: Object3D[] = [];
      scene.traverse((object) => {
        // Find obstacles and ground (they have userData.type === "obstacle" or "ground")
        if (
          object.userData?.type === "obstacle" ||
          object.userData?.type === "ground" ||
          object.userData?.isObstacle
        ) {
          obstacles.push(object);
        }
        // Find ships (RigidBody objects with controllerId, but not the one that fired this laser)
        if (
          object.userData?.controllerId &&
          object.userData.controllerId !== controllerId
        ) {
          ships.push(object);
        }
      });

      // Check for ship hits first (prioritize player hits)
      const shipIntersects = raycasterRef.current.intersectObjects(ships, true);

      if (shipIntersects.length > 0) {
        const hit = shipIntersects[0];
        const hitPoint = hit.point;
        const hitNormal = hit.face?.normal;

        if (hitNormal) {
          // Transform normal to world space
          const worldNormal = hitNormal.clone();
          if (hit.object.parent) {
            hit.object.parent.updateMatrixWorld();
            worldNormal.transformDirection(hit.object.parent.matrixWorld);
          }
          worldNormal.normalize();

          // Find the RigidBody for this ship and apply knockback
          let hitControllerId: string | null = null;
          let currentObject: Object3D | null = hit.object;

          // Traverse up the parent chain to find the RigidBody with controllerId
          while (currentObject) {
            if (currentObject.userData?.controllerId) {
              hitControllerId = currentObject.userData.controllerId;
              break;
            }
            currentObject = currentObject.parent;
          }

          // Find the corresponding RigidBody in the Rapier world
          let shipRigidBody: RapierRigidBody | null = null;
          if (hitControllerId && world) {
            world.bodies.forEach((body) => {
              // Access userData as a property, not a function
              const bodyUserData = body.userData;
              if (
                bodyUserData &&
                typeof bodyUserData === "object" &&
                "controllerId" in bodyUserData
              ) {
                const userData = bodyUserData as { controllerId?: string };
                if (userData.controllerId === hitControllerId) {
                  shipRigidBody = body as unknown as RapierRigidBody;
                }
              }
            });
          }

          // Reduce health of the hit ship (only if it's not the shooter)
          if (hitControllerId && hitControllerId !== controllerId) {
            reduceHealth(hitControllerId, LASER_DAMAGE);
            // Play hit sound on host
            audio.play("hit");
            // Send haptics
            sendSignal?.("HAPTIC", { pattern: "heavy" }, hitControllerId); // Victim gets hit hard
            sendSignal?.("HAPTIC", { pattern: "success" }, controllerId); // Shooter gets hit marker
          }

          // Apply knockback force to the ship
          if (shipRigidBody) {
            // Calculate knockback direction (in the direction the laser was traveling)
            const knockbackDirection = normalizedDir
              .clone()
              .multiplyScalar(KNOCKBACK_FORCE);
            // Apply as impulse (at center of mass)
            // TypeScript needs explicit cast here because world.bodies returns a different type
            (
              shipRigidBody as unknown as {
                applyImpulse(
                  impulse: { x: number; y: number; z: number },
                  wakeUp: boolean,
                ): void;
              }
            ).applyImpulse(
              {
                x: knockbackDirection.x,
                y: knockbackDirection.y,
                z: knockbackDirection.z,
              },
              true,
            );
          }

          // We hit a ship! Spawn decal at exact hit point with exact normal
          hasHitRef.current = true;

          // Offset decal slightly from surface to avoid z-fighting
          const offset = worldNormal.clone().multiplyScalar(0.01);
          const decalPosition: [number, number, number] = [
            hitPoint.x + offset.x,
            hitPoint.y + offset.y,
            hitPoint.z + offset.z,
          ];

          // Spawn decal with exact hit point and surface normal
          addDecal({
            position: decalPosition,
            normal: worldNormal,
          });

          // Remove laser
          removeLaser(id);
          return;
        }
      }

      // Check for obstacle/ground hits (both handled the same way)
      const obstacleIntersects = raycasterRef.current.intersectObjects(
        obstacles,
        true,
      );

      if (obstacleIntersects.length > 0) {
        const hit = obstacleIntersects[0];
        const hitPoint = hit.point;
        const hitNormal = hit.face?.normal;

        if (hitNormal) {
          // Transform normal to world space
          const worldNormal = hitNormal.clone();
          if (hit.object.parent) {
            hit.object.parent.updateMatrixWorld();
            worldNormal.transformDirection(hit.object.parent.matrixWorld);
          }
          worldNormal.normalize();

          // We hit an obstacle or ground! Spawn decal at exact hit point with exact normal
          hasHitRef.current = true;

          // Offset decal slightly from surface to avoid z-fighting
          const offset = worldNormal.clone().multiplyScalar(0.01);
          const decalPosition: [number, number, number] = [
            hitPoint.x + offset.x,
            hitPoint.y + offset.y,
            hitPoint.z + offset.z,
          ];

          // Spawn decal with exact hit point and surface normal
          addDecal({
            position: decalPosition,
            normal: worldNormal,
          });

          // Remove laser
          removeLaser(id);
          return;
        }
      }
    }

    // Update position for next frame
    setCurrentPosition(newPosition);
    previousPositionRef.current.copy(newPosition);

    // Check lifetime
    lifetimeRef.current += delta;
    if (lifetimeRef.current > LASER_LIFETIME) {
      removeLaser(id);
    }
  });

  return (
    <mesh
      ref={meshRef}
      position={currentPosition}
      geometry={geometry}
      material={material}
      castShadow
      quaternion={rotationQuaternion}
    />
  );
}

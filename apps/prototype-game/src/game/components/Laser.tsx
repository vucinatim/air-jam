import { useFrame, useThree } from "@react-three/fiber";
import { useRef, useMemo, useState } from "react";
import {
  BoxGeometry,
  MeshStandardMaterial,
  Vector3,
  Raycaster,
  Object3D,
  Quaternion,
} from "three";
import { useLasersStore } from "../lasers-store";
import { useDecalsStore } from "../decals-store";
import type { Mesh } from "three";

interface LaserProps {
  id: string;
  position: [number, number, number];
  direction: Vector3;
  controllerId: string;
}

const LASER_SPEED = 150;
const LASER_LIFETIME = 2; // seconds

export function Laser({ id, position, direction }: LaserProps) {
  const { scene } = useThree();
  const [currentPosition, setCurrentPosition] = useState(
    () => new Vector3(...position)
  );
  const previousPositionRef = useRef(new Vector3(...position));
  const lifetimeRef = useRef(0);
  const hasHitRef = useRef(false);
  const removeLaser = useLasersStore((state) => state.removeLaser);
  const addDecal = useDecalsStore((state) => state.addDecal);
  const raycasterRef = useRef(new Raycaster());
  const meshRef = useRef<Mesh>(null);

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
    []
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

      // Get all obstacles from the scene
      const obstacles: Object3D[] = [];
      scene.traverse((object) => {
        // Find obstacles (they have userData.type === "obstacle" or are RigidBody with fixed type)
        if (
          object.userData?.type === "obstacle" ||
          object.userData?.isObstacle
        ) {
          obstacles.push(object);
        }
      });

      const intersects = raycasterRef.current.intersectObjects(obstacles, true);

      if (intersects.length > 0) {
        const hit = intersects[0];
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

          // We hit something! Spawn decal at exact hit point with exact normal
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

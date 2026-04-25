import { useFrame } from "@react-three/fiber";
import { useRapier } from "@react-three/rapier";
import { Vector3 } from "three";
import { ARENA_RADIUS } from "../constants";

export function ArenaBounds() {
  const { world } = useRapier();

  useFrame(() => {
    if (!world) return;

    // Enforce arena bounds on all dynamic bodies
    world.bodies.forEach((body) => {
      if (body.bodyType() === 0) {
        // Dynamic body
        const pos = body.translation();
        const dist = Math.sqrt(pos.x * pos.x + pos.z * pos.z);
        if (dist > ARENA_RADIUS) {
          const clamped = new Vector3(pos.x, pos.y, pos.z).setLength(
            ARENA_RADIUS - 1,
          );
          body.setTranslation({ x: clamped.x, y: pos.y, z: clamped.z }, true);
          body.setLinvel({ x: 0, y: 0, z: 0 }, true);
        }
      }
    });
  });

  return null;
}

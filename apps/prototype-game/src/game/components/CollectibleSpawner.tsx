import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useCollectiblesStore } from "../collectibles-store";
import { getRandomAbilityByRarity } from "../abilities-store";
import { ARENA_RADIUS } from "../constants";

const SPAWN_INTERVAL = 3; // Spawn a new collectible every 3 seconds
const MAX_COLLECTIBLES = 20; // Maximum number of collectibles at once
const SPAWN_HEIGHT = 5; // Height at which collectibles spawn
const MIN_SPAWN_DISTANCE = 20; // Minimum distance from center
const MAX_SPAWN_DISTANCE = ARENA_RADIUS - 10; // Maximum distance from center (with margin)

export function CollectibleSpawner() {
  const addCollectible = useCollectiblesStore((state) => state.addCollectible);
  const collectibles = useCollectiblesStore((state) => state.collectibles);
  const lastSpawnTimeRef = useRef(0);

  useFrame((state) => {
    const currentTime = state.clock.elapsedTime;

    // Check if we should spawn a new collectible
    if (
      collectibles.length < MAX_COLLECTIBLES &&
      currentTime - lastSpawnTimeRef.current >= SPAWN_INTERVAL
    ) {
      // Generate random position within arena bounds
      const angle = Math.random() * Math.PI * 2; // Random angle
      const distance =
        MIN_SPAWN_DISTANCE +
        Math.random() * (MAX_SPAWN_DISTANCE - MIN_SPAWN_DISTANCE);
      const x = Math.cos(angle) * distance;
      const z = Math.sin(angle) * distance;
      const y = SPAWN_HEIGHT + Math.random() * 2; // Slight height variation

      // All collectibles have abilities - weighted by rarity
      const ability = getRandomAbilityByRarity();
      if (!ability) return; // Safety check

      addCollectible({
        type: "box",
        position: [x, y, z],
        abilityId: ability.id,
      });

      lastSpawnTimeRef.current = currentTime;
    }
  });

  return null;
}

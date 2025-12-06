import { Vector3 } from "three";
import {
  registerAbilityImplementation,
  type AbilityImplementation,
} from "../abilities-store";
import { RocketModel } from "../components/RocketModel";
import { shipPositions, shipRotations } from "../components/Ship";
import { useRocketsStore } from "../rockets-store";

/**
 * Rocket spawn/visual position offsets
 * These values must match between onActivate() and renderVisual()
 * Ship faces -Z direction, so forward is negative Z
 */
const FORWARD_OFFSET = 0; // Units forward (in ship's -Z direction)
const UPWARD_OFFSET = 0.9; // Units up (in ship's +Y direction)

/**
 * Rocket Ability
 * Fires a powerful rocket projectile when activated
 */
const rocketAbility: AbilityImplementation = {
  id: "rocket",
  onActivate: (controllerId: string) => {
    // Get player position and rotation
    const position = shipPositions.get(controllerId);
    const rotation = shipRotations.get(controllerId);

    if (!position || !rotation) return;

    // Calculate forward direction
    const forwardDir = new Vector3(0, 0, -1).applyQuaternion(rotation);
    const upDir = new Vector3(0, 1, 0).applyQuaternion(rotation);

    // Spawn position - in front of ship
    const forwardOffset = forwardDir.clone().multiplyScalar(FORWARD_OFFSET);
    const upwardOffset = upDir.clone().multiplyScalar(UPWARD_OFFSET);
    const spawnPos = position.clone().add(forwardOffset).add(upwardOffset);

    // Spawn rocket
    const rocketId = `${controllerId}-rocket-${Date.now()}`;
    useRocketsStore.getState().addRocket({
      id: rocketId,
      position: [spawnPos.x, spawnPos.y, spawnPos.z],
      direction: forwardDir.clone(),
      controllerId,
      timestamp: Date.now(),
    });
  },
  renderVisual: () => {
    // Render rocket model on ship when ability is equipped
    // Position matches spawn location from onActivate()
    return (
      <group position={[0, UPWARD_OFFSET, -FORWARD_OFFSET]}>
        <RocketModel showParticles={false} horizontal={true} />
      </group>
    );
  },
};

// Register the ability
registerAbilityImplementation(rocketAbility);

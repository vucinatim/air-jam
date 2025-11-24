import {
  registerAbilityImplementation,
  type AbilityImplementation,
} from "../abilities-store";
import { useRocketsStore } from "../rockets-store";
import { shipPositions, shipRotations } from "../components/Ship";
import { Vector3 } from "three";

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
    const forwardOffset = forwardDir.clone().multiplyScalar(4);
    const upwardOffset = upDir.clone().multiplyScalar(0.5);
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
};

// Register the ability
registerAbilityImplementation(rocketAbility);


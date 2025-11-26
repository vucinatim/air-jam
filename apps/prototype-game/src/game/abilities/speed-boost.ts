import {
  registerAbilityImplementation,
  type AbilityImplementation,
} from "../abilities-store";
import { usePlayerStatsStore } from "../player-stats-store";

/**
 * Speed Boost Ability
 * Increases player speed by 50% for 5 seconds
 *
 * This ability demonstrates the proper architecture:
 * - onActivate: Sets initial state
 * - onDeactivate: Cleans up when ability expires
 */
const speedBoostAbility: AbilityImplementation = {
  id: "speed_boost",
  onActivate: (controllerId: string) => {
    // Set the speed multiplier when ability is activated
    usePlayerStatsStore.getState().setSpeedMultiplier(controllerId, 2.0);
  },
  onDeactivate: (controllerId: string) => {
    // Reset speed multiplier back to base 1.0x when ability expires
    usePlayerStatsStore.getState().setSpeedMultiplier(controllerId, 1.0);
  },
};

// Register the ability
registerAbilityImplementation(speedBoostAbility);

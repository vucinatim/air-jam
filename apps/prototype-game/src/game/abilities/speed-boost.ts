import {
  registerAbilityImplementation,
  type AbilityImplementation,
} from "../abilities-store";
import { usePlayerStatsStore } from "../player-stats-store";

/**
 * Speed Boost Ability
 * Increases player speed by 50% for 5 seconds
 */
const speedBoostAbility: AbilityImplementation = {
  id: "speed_boost",
  onActivate: (controllerId: string) => {
    // Modify player stats directly - no complex callbacks needed!
    usePlayerStatsStore.getState().setSpeedMultiplier(controllerId, 1.5);
  },
  onDeactivate: (controllerId: string) => {
    // Reset speed multiplier when ability expires
    usePlayerStatsStore.getState().setSpeedMultiplier(controllerId, 1.0);
  },
};

// Register the ability
registerAbilityImplementation(speedBoostAbility);

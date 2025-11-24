import {
  registerAbilityImplementation,
  type AbilityImplementation,
} from "../abilities-store";
import { useHealthStore } from "../health-store";

/**
 * Health Pack Ability (Common)
 * Instantly restores 25 health when activated
 */
const healthPackAbility: AbilityImplementation = {
  id: "health_pack",
  onActivate: (controllerId: string) => {
    // Restore health directly
    const currentHealth = useHealthStore.getState().health[controllerId] ?? 100;
    const newHealth = Math.min(100, currentHealth + 25);
    useHealthStore.getState().setHealth(controllerId, newHealth);
  },
};

// Register the ability
registerAbilityImplementation(healthPackAbility);


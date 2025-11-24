import { create } from "zustand";

export type AbilityId = "speed_boost" | string; // Extensible for future abilities

export interface AbilityData {
  id: AbilityId;
  name: string;
  icon: string; // Icon identifier/emoji/unicode
  duration: number; // Duration in seconds
  startTime: number | null; // Timestamp when ability was activated (null if not yet activated)
}

export interface PlayerAbilities {
  [controllerId: string]: AbilityData | null; // Each player has 1 ability slot
}

interface AbilitiesState {
  abilities: PlayerAbilities;
  setAbility: (controllerId: string, ability: AbilityData | null) => void;
  collectAbility: (controllerId: string, abilityId: AbilityId) => void; // Adds ability to slot (not activated)
  activateAbility: (controllerId: string, abilityId: AbilityId) => void; // Activates ability (starts timer)
  clearAbility: (controllerId: string) => void;
  clearAllAbilities: () => void;
  getAbility: (controllerId: string) => AbilityData | null;
  isAbilityActive: (controllerId: string) => boolean;
  getRemainingDuration: (controllerId: string) => number; // Returns seconds remaining
}

export const useAbilitiesStore = create<AbilitiesState>((set, get) => ({
  abilities: {},
  setAbility: (controllerId, ability) =>
    set((state) => ({
      abilities: {
        ...state.abilities,
        [controllerId]: ability,
      },
    })),
  collectAbility: (controllerId, abilityId) => {
    const ability = getAbilityDefinition(abilityId);
    if (!ability) return;

    const abilityData: AbilityData = {
      id: abilityId,
      name: ability.name,
      icon: ability.icon,
      duration: ability.duration,
      startTime: null, // Not activated yet
    };

    set((state) => ({
      abilities: {
        ...state.abilities,
        [controllerId]: abilityData,
      },
    }));
  },
  activateAbility: (controllerId, abilityId) => {
    const currentAbility = get().abilities[controllerId];
    // Only activate if ability is in slot and not already active
    if (!currentAbility || currentAbility.id !== abilityId || currentAbility.startTime !== null) {
      return;
    }

    const abilityData: AbilityData = {
      ...currentAbility,
      startTime: Date.now(), // Start the timer
    };

    set((state) => ({
      abilities: {
        ...state.abilities,
        [controllerId]: abilityData,
      },
    }));
    
    // Call ability's onActivate hook if it exists
    const abilityImpl = getAbilityImplementation(abilityId);
    if (abilityImpl?.onActivate) {
      abilityImpl.onActivate(controllerId);
    }
  },
  clearAbility: (controllerId) => {
    const ability = get().abilities[controllerId];
    
    // Call ability's onDeactivate hook if it exists
    if (ability) {
      const abilityImpl = getAbilityImplementation(ability.id);
      if (abilityImpl?.onDeactivate) {
        abilityImpl.onDeactivate(controllerId);
      }
    }
    
    set((state) => ({
      abilities: {
        ...state.abilities,
        [controllerId]: null,
      },
    }));
  },
  clearAllAbilities: () => set({ abilities: {} }),
  getAbility: (controllerId) => {
    return get().abilities[controllerId] ?? null;
  },
  isAbilityActive: (controllerId) => {
    const ability = get().abilities[controllerId];
    if (!ability || ability.startTime === null) return false;
    const remaining = get().getRemainingDuration(controllerId);
    return remaining > 0;
  },
  getRemainingDuration: (controllerId) => {
    const ability = get().abilities[controllerId];
    if (!ability || ability.startTime === null) return 0;
    const elapsed = (Date.now() - ability.startTime) / 1000;
    const remaining = ability.duration - elapsed;
    return Math.max(0, remaining);
  },
}));

// Ability definitions registry - easy to extend
export interface AbilityDefinition {
  id: AbilityId;
  name: string;
  icon: string;
  duration: number; // Duration in seconds
}

const ABILITY_DEFINITIONS: Record<AbilityId, AbilityDefinition> = {
  speed_boost: {
    id: "speed_boost",
    name: "Speed Boost",
    icon: "⚡", // Lightning bolt emoji
    duration: 5, // 5 seconds
  },
};

export function getAbilityDefinition(abilityId: AbilityId): AbilityDefinition | null {
  return ABILITY_DEFINITIONS[abilityId] ?? null;
}

export function getAllAbilityDefinitions(): AbilityDefinition[] {
  return Object.values(ABILITY_DEFINITIONS);
}

/**
 * Ability implementation interface - abilities export these hooks
 */
export interface AbilityImplementation {
  id: AbilityId;
  onActivate?: (controllerId: string) => void; // Called when ability is activated
  onDeactivate?: (controllerId: string) => void; // Called when ability expires/is cleared
}

/**
 * Ability implementations registry - abilities register themselves here
 */
const ABILITY_IMPLEMENTATIONS = new Map<AbilityId, AbilityImplementation>();

export function registerAbilityImplementation(impl: AbilityImplementation) {
  ABILITY_IMPLEMENTATIONS.set(impl.id, impl);
}

export function getAbilityImplementation(abilityId: AbilityId): AbilityImplementation | undefined {
  return ABILITY_IMPLEMENTATIONS.get(abilityId);
}


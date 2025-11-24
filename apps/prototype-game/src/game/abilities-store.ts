import { create } from "zustand";
import type React from "react";

export type AbilityId = "speed_boost" | "rocket" | "health_pack" | string; // Extensible for future abilities

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
    if (
      !currentAbility ||
      currentAbility.id !== abilityId ||
      currentAbility.startTime !== null
    ) {
      return;
    }

    // Call ability's onActivate hook if it exists
    const abilityImpl = getAbilityImplementation(abilityId);
    if (abilityImpl?.onActivate) {
      abilityImpl.onActivate(controllerId);
    }

    const abilityDef = getAbilityDefinition(abilityId);

    // If duration is 0, it's an instant ability - clear it immediately after firing
    if (abilityDef && abilityDef.duration === 0) {
      set((state) => ({
        abilities: {
          ...state.abilities,
          [controllerId]: null,
        },
      }));
      return;
    }

    // Otherwise, start the timer for duration-based abilities
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

// Rarity system
export type Rarity = "common" | "uncommon" | "rare" | "epic" | "legendary";

export interface RarityInfo {
  name: string;
  color: number; // Hex color
  spawnWeight: number; // Higher = more common
}

export const RARITY_INFO: Record<Rarity, RarityInfo> = {
  common: {
    name: "Common",
    color: 0x888888, // Gray
    spawnWeight: 30, // Reduced from 50
  },
  uncommon: {
    name: "Uncommon",
    color: 0x00ff88, // Green (current collectible color)
    spawnWeight: 40, // Increased from 30
  },
  rare: {
    name: "Rare",
    color: 0x0088ff, // Blue
    spawnWeight: 30, // Increased from 15
  },
  epic: {
    name: "Epic",
    color: 0xaa00ff, // Purple
    spawnWeight: 4,
  },
  legendary: {
    name: "Legendary",
    color: 0xffaa00, // Gold/Orange
    spawnWeight: 1, // Rarest
  },
};

// Ability definitions registry - easy to extend
export interface AbilityDefinition {
  id: AbilityId;
  name: string;
  icon: string;
  duration: number; // Duration in seconds
  rarity: Rarity;
}

const ABILITY_DEFINITIONS: Record<AbilityId, AbilityDefinition> = {
  health_pack: {
    id: "health_pack",
    name: "Health Pack",
    icon: "❤️", // Heart emoji
    duration: 0, // Instant ability
    rarity: "common", // Gray
  },
  speed_boost: {
    id: "speed_boost",
    name: "Speed Boost",
    icon: "⚡", // Lightning bolt emoji
    duration: 5, // 5 seconds
    rarity: "uncommon", // Green
  },
  rocket: {
    id: "rocket",
    name: "Rocket",
    icon: "🚀", // Rocket emoji
    duration: 0, // Instant ability (fires immediately)
    rarity: "rare", // Blue
  },
};

export function getAbilityDefinition(
  abilityId: AbilityId
): AbilityDefinition | null {
  return ABILITY_DEFINITIONS[abilityId] ?? null;
}

export function getAllAbilityDefinitions(): AbilityDefinition[] {
  return Object.values(ABILITY_DEFINITIONS);
}

/**
 * Get ability by rarity for weighted random selection
 */
export function getAbilitiesByRarity(): Record<Rarity, AbilityDefinition[]> {
  const byRarity: Record<Rarity, AbilityDefinition[]> = {
    common: [],
    uncommon: [],
    rare: [],
    epic: [],
    legendary: [],
  };

  Object.values(ABILITY_DEFINITIONS).forEach((ability) => {
    byRarity[ability.rarity].push(ability);
  });

  return byRarity;
}

/**
 * Get random ability based on rarity weights
 */
export function getRandomAbilityByRarity(): AbilityDefinition | null {
  const abilities = Object.values(ABILITY_DEFINITIONS);
  if (abilities.length === 0) return null;

  // Calculate total weight
  let totalWeight = 0;
  const weightedAbilities: Array<{
    ability: AbilityDefinition;
    weight: number;
  }> = [];

  abilities.forEach((ability) => {
    const rarityInfo = RARITY_INFO[ability.rarity];
    totalWeight += rarityInfo.spawnWeight;
    weightedAbilities.push({
      ability,
      weight: rarityInfo.spawnWeight,
    });
  });

  // Random roll
  let roll = Math.random() * totalWeight;

  // Find which ability based on weight
  for (const { ability, weight } of weightedAbilities) {
    roll -= weight;
    if (roll <= 0) {
      return ability;
    }
  }

  // Fallback to last ability (shouldn't happen)
  return weightedAbilities[weightedAbilities.length - 1].ability;
}

/**
 * Ability implementation interface - abilities export these hooks
 */
export interface AbilityImplementation {
  id: AbilityId;
  onActivate?: (controllerId: string) => void; // Called when ability is activated
  onDeactivate?: (controllerId: string) => void; // Called when ability expires/is cleared
  /**
   * Render visual component for this ability when equipped but not activated
   * Returns a React component or null if no visual is needed
   * @param controllerId - The controller ID of the player (optional, some abilities may not need it)
   */
  renderVisual?: (controllerId?: string) => React.ReactNode;
}

/**
 * Ability implementations registry - abilities register themselves here
 */
const ABILITY_IMPLEMENTATIONS = new Map<AbilityId, AbilityImplementation>();

export function registerAbilityImplementation(impl: AbilityImplementation) {
  ABILITY_IMPLEMENTATIONS.set(impl.id, impl);
}

export function getAbilityImplementation(
  abilityId: AbilityId
): AbilityImplementation | undefined {
  return ABILITY_IMPLEMENTATIONS.get(abilityId);
}

/**
 * Get the visual component for an ability (if it has one)
 */
export function getAbilityVisual(
  abilityId: AbilityId,
  controllerId: string
): React.ReactNode | null {
  const impl = getAbilityImplementation(abilityId);
  return impl?.renderVisual ? impl.renderVisual(controllerId) : null;
}

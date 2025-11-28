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

/**
 * Represents the ability state for a single player
 * Separates active (currently running) from queued (collected but not activated)
 */
export interface PlayerAbilityState {
  activeAbility: AbilityData | null; // Currently running ability (has startTime)
  queuedAbility: AbilityData | null; // Collected but not yet activated ability (startTime is null)
}

export interface PlayerAbilities {
  [controllerId: string]: PlayerAbilityState;
}

// Store active timers for each controller
const activeTimers = new Map<string, NodeJS.Timeout>();

interface AbilitiesState {
  abilities: PlayerAbilities;
  setAbility: (controllerId: string, ability: AbilityData | null) => void;
  collectAbility: (controllerId: string, abilityId: AbilityId) => void; // Adds ability to queue (cancels active if present)
  activateAbility: (controllerId: string, abilityId: AbilityId) => void; // Activates queued ability (starts timer)
  clearAbility: (controllerId: string) => void; // Clears active ability only
  clearAllAbilities: () => void;
  getAbility: (controllerId: string) => AbilityData | null; // Returns active if present, otherwise queued (for UI)
  getQueuedAbility: (controllerId: string) => AbilityData | null; // Returns queued ability specifically
  getActiveAbility: (controllerId: string) => AbilityData | null; // Returns active ability specifically
  isAbilityActive: (controllerId: string) => boolean;
  getRemainingDuration: (controllerId: string) => number; // Returns seconds remaining for active ability
  updateActiveAbilities: (controllerId: string, delta: number) => void; // Update all active abilities for a controller
}

export const useAbilitiesStore = create<AbilitiesState>((set, get) => ({
  abilities: {},
  setAbility: (controllerId, ability) => {
    // Legacy method - for backwards compatibility, sets as queued
    const currentState = get().abilities[controllerId] ?? {
      activeAbility: null,
      queuedAbility: null,
    };
    set((state) => ({
      abilities: {
        ...state.abilities,
        [controllerId]: {
          ...currentState,
          queuedAbility: ability,
        },
      },
    }));
  },
  collectAbility: (controllerId, abilityId) => {
    const ability = getAbilityDefinition(abilityId);
    if (!ability) return;

    const currentState = get().abilities[controllerId] ?? {
      activeAbility: null,
      queuedAbility: null,
    };

    // If there's an active ability, cancel it first
    if (currentState.activeAbility) {
      // Clear the active ability (calls onDeactivate, clears timer)
      const activeAbility = currentState.activeAbility;
      const timer = activeTimers.get(controllerId);
      if (timer) {
        clearTimeout(timer);
        activeTimers.delete(controllerId);
      }

      // Call onDeactivate for the active ability
      const abilityImpl = getAbilityImplementation(activeAbility.id);
      if (abilityImpl?.onDeactivate) {
        abilityImpl.onDeactivate(controllerId);
      }
    }

    // Create the new queued ability
    const abilityData: AbilityData = {
      id: abilityId,
      name: ability.name,
      icon: ability.icon,
      duration: ability.duration,
      startTime: null, // Not activated yet
    };

    // Set as queued ability (replacing any existing queued ability)
    set((state) => ({
      abilities: {
        ...state.abilities,
        [controllerId]: {
          activeAbility: null, // Clear active since we canceled it
          queuedAbility: abilityData,
        },
      },
    }));
  },
  activateAbility: (controllerId, abilityId) => {
    const currentState = get().abilities[controllerId] ?? {
      activeAbility: null,
      queuedAbility: null,
    };

    // Only activate if ability is queued and matches the requested abilityId
    if (
      !currentState.queuedAbility ||
      currentState.queuedAbility.id !== abilityId
    ) {
      return;
    }

    // If there's already an active ability, cancel it first
    if (currentState.activeAbility) {
      const activeAbility = currentState.activeAbility;
      const timer = activeTimers.get(controllerId);
      if (timer) {
        clearTimeout(timer);
        activeTimers.delete(controllerId);
      }

      // Call onDeactivate for the active ability
      const abilityImpl = getAbilityImplementation(activeAbility.id);
      if (abilityImpl?.onDeactivate) {
        abilityImpl.onDeactivate(controllerId);
      }
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
          [controllerId]: {
            activeAbility: null,
            queuedAbility: null, // Instant abilities are consumed
          },
        },
      }));
      return;
    }

    // Otherwise, start the timer for duration-based abilities
    const abilityData: AbilityData = {
      ...currentState.queuedAbility,
      startTime: Date.now(), // Start the timer
    };

    set((state) => ({
      abilities: {
        ...state.abilities,
        [controllerId]: {
          activeAbility: abilityData, // Move to active
          queuedAbility: null, // Clear from queue
        },
      },
    }));

    // Set up automatic timer for duration-based abilities
    // Clear any existing timer for this controller first
    const existingTimer = activeTimers.get(controllerId);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Set up new timer that will automatically deactivate the ability
    if (abilityDef && abilityDef.duration > 0) {
      const timer = setTimeout(() => {
        // Timer expired - automatically clear only the active ability
        // Don't touch queued ability if one exists
        const state = get().abilities[controllerId];
        if (state?.activeAbility) {
          const activeAbility = state.activeAbility;
          const timerImpl = getAbilityImplementation(activeAbility.id);
          if (timerImpl?.onDeactivate) {
            timerImpl.onDeactivate(controllerId);
          }

          set((currentState) => ({
            abilities: {
              ...currentState.abilities,
              [controllerId]: {
                activeAbility: null, // Clear active
                queuedAbility: state.queuedAbility, // Preserve queued
              },
            },
          }));
        }
        activeTimers.delete(controllerId);
      }, abilityDef.duration * 1000);

      activeTimers.set(controllerId, timer);
    }
  },
  clearAbility: (controllerId) => {
    const currentState = get().abilities[controllerId] ?? {
      activeAbility: null,
      queuedAbility: null,
    };

    // Clear any active timer for this controller
    const timer = activeTimers.get(controllerId);
    if (timer) {
      clearTimeout(timer);
      activeTimers.delete(controllerId);
    }

    // Call ability's onDeactivate hook if it exists (only for active ability)
    if (currentState.activeAbility) {
      const abilityImpl = getAbilityImplementation(
        currentState.activeAbility.id
      );
      if (abilityImpl?.onDeactivate) {
        abilityImpl.onDeactivate(controllerId);
      }
    }

    // Only clear the active ability, preserve queued ability
    set((state) => ({
      abilities: {
        ...state.abilities,
        [controllerId]: {
          activeAbility: null,
          queuedAbility: currentState.queuedAbility, // Preserve queued
        },
      },
    }));
  },
  clearAllAbilities: () => {
    // Clear all active timers
    activeTimers.forEach((timer) => clearTimeout(timer));
    activeTimers.clear();
    set({ abilities: {} });
  },
  getAbility: (controllerId) => {
    // Returns active ability if present, otherwise queued ability (for UI compatibility)
    const state = get().abilities[controllerId];
    if (!state) return null;
    return state.activeAbility ?? state.queuedAbility ?? null;
  },
  getQueuedAbility: (controllerId) => {
    const state = get().abilities[controllerId];
    return state?.queuedAbility ?? null;
  },
  getActiveAbility: (controllerId) => {
    const state = get().abilities[controllerId];
    return state?.activeAbility ?? null;
  },
  isAbilityActive: (controllerId) => {
    const state = get().abilities[controllerId];
    if (!state?.activeAbility || state.activeAbility.startTime === null)
      return false;
    const remaining = get().getRemainingDuration(controllerId);
    return remaining > 0;
  },
  getRemainingDuration: (controllerId) => {
    const state = get().abilities[controllerId];
    const ability = state?.activeAbility;
    if (!ability || ability.startTime === null) return 0;
    const elapsed = (Date.now() - ability.startTime) / 1000;
    const remaining = ability.duration - elapsed;
    return Math.max(0, remaining);
  },
  updateActiveAbilities: (controllerId, delta) => {
    const state = get().abilities[controllerId];
    const ability = state?.activeAbility;
    if (!ability || !get().isAbilityActive(controllerId)) return;

    // Get the ability implementation and call its onUpdate if it exists
    const abilityImpl = getAbilityImplementation(ability.id);
    if (abilityImpl?.onUpdate) {
      abilityImpl.onUpdate(controllerId, delta);
    }
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
 * Get the image path for an ability icon
 */
export function getAbilityIconPath(abilityId: AbilityId): string {
  return `/images/ability-icons/${abilityId}.png`;
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
   * Called every frame while the ability is active
   * Allows abilities to maintain their effects, update stats, etc.
   * @param controllerId - The controller ID of the player
   * @param delta - Time elapsed since last frame in seconds
   */
  onUpdate?: (controllerId: string, delta: number) => void;
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

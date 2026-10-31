import { airCaptureAssets } from "../assets";
import { airCaptureTheme } from "../theme";
export type AbilityId = "speed_boost" | "rocket" | "health_pack";

/** A picked-up ability; `startTime` is the game time it was activated, or null while queued. */
export interface AbilityData {
  id: AbilityId;
  name: string;
  icon: string;
  /** Seconds the ability lasts once activated; zero for instant abilities. */
  duration: number;
  startTime: number | null;
}

export type Rarity = "common" | "uncommon" | "rare" | "epic" | "legendary";

export interface RarityInfo {
  name: string;
  color: number; // Hex color
  spawnWeight: number; // Higher = more common
}

export const RARITY_INFO: Record<Rarity, RarityInfo> = {
  common: {
    name: "Common",
    color: Number.parseInt(airCaptureTheme.colors.common.slice(1), 16), // Gray
    spawnWeight: 30, // Reduced from 50
  },
  uncommon: {
    name: "Uncommon",
    color: Number.parseInt(airCaptureTheme.colors.uncommon.slice(1), 16), // Green (current collectible color)
    spawnWeight: 40, // Increased from 30
  },
  rare: {
    name: "Rare",
    color: Number.parseInt(airCaptureTheme.colors.rare.slice(1), 16), // Blue
    spawnWeight: 30, // Increased from 15
  },
  epic: {
    name: "Epic",
    color: Number.parseInt(airCaptureTheme.colors.epic.slice(1), 16), // Purple
    spawnWeight: 4,
  },
  legendary: {
    name: "Legendary",
    color: Number.parseInt(airCaptureTheme.colors.legendary.slice(1), 16), // Gold/Orange
    spawnWeight: 1, // Rarest
  },
};

// Ability definitions registry - easy to extend
export interface AbilityDefinition {
  id: AbilityId;
  name: string;
  icon: string;
  rarity: Rarity;
}

export const ABILITY_DEFINITIONS: Record<AbilityId, AbilityDefinition> = {
  health_pack: {
    id: "health_pack",
    name: "Health Pack",
    icon: "❤️", // Heart emoji
    rarity: "common", // Gray
  },
  speed_boost: {
    id: "speed_boost",
    name: "Speed Boost",
    icon: "⚡", // Lightning bolt emoji
    rarity: "uncommon", // Green
  },
  rocket: {
    id: "rocket",
    name: "Rocket",
    icon: "🚀", // Rocket emoji
    rarity: "rare", // Blue
  },
};

export function getAbilityDefinition(abilityId: AbilityId): AbilityDefinition {
  return ABILITY_DEFINITIONS[abilityId];
}

export function getAllAbilityDefinitions(): AbilityDefinition[] {
  return Object.values(ABILITY_DEFINITIONS);
}

/**
 * Get the image path for an ability icon
 */
export function getAbilityIconPath(abilityId: AbilityId): string {
  return {
    health_pack: airCaptureAssets.images.healthPack,
    speed_boost: airCaptureAssets.images.speedBoost,
    rocket: airCaptureAssets.images.rocket,
  }[abilityId].src;
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
export function getRandomAbilityByRarity(
  random: () => number,
): AbilityDefinition | null {
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
  let roll = random() * totalWeight;

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

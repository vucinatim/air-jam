import type { PlayerProfile } from "../protocol";

const DIEBEAR_ADVENTURER_NEUTRAL_SVG_BASE =
  "https://api.dicebear.com/9.x/adventurer-neutral/svg";

/**
 * Curated DiceBear seeds for preset ids `aj-1` … `aj-8` (adventurer-neutral). Same order as the original emoji presets.
 */
export const AIRJAM_DEFAULT_AVATAR_SEEDS: readonly string[] = [
  "Aiko",
  "Brayden",
  "Caleb",
  "Dylan",
  "Emery",
  "Finley",
  "Grayson",
  "Harper",
];

/**
 * Resolves the DiceBear seed for a player: preset ids (`aj-n`), custom seed string, or player id as fallback.
 */
export const resolvePlayerAvatarSeed = (player: PlayerProfile): string => {
  const raw = player.avatarId?.trim();
  if (!raw) {
    return player.id;
  }
  const match = /^aj-(\d+)$/.exec(raw);
  if (match) {
    const index = Number(match[1]) - 1;
    if (index >= 0 && index < AIRJAM_DEFAULT_AVATAR_SEEDS.length) {
      return AIRJAM_DEFAULT_AVATAR_SEEDS[index]!;
    }
  }
  return raw;
};

/**
 * SVG URL for DiceBear `adventurer-neutral` (v9) for a given seed.
 */
export const getDiceBearAdventurerNeutralUrl = (seed: string): string =>
  `${DIEBEAR_ADVENTURER_NEUTRAL_SVG_BASE}?seed=${encodeURIComponent(seed)}`;

/**
 * Avatar image URL for a player profile (DiceBear adventurer-neutral).
 */
export const getPlayerAvatarImageUrl = (player: PlayerProfile): string =>
  getDiceBearAdventurerNeutralUrl(resolvePlayerAvatarSeed(player));

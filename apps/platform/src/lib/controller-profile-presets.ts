import { AIRJAM_DEFAULT_AVATAR_SEEDS } from "@air-jam/sdk/ui";

export const CONTROLLER_AVATAR_PRESETS: readonly {
  id: string;
  seed: string;
}[] = AIRJAM_DEFAULT_AVATAR_SEEDS.map((seed, index) => ({
  id: `aj-${index + 1}`,
  seed,
}));

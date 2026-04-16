import { createPrefabCatalog } from "@air-jam/sdk/prefabs";
import { AIR_CAPTURE_ARENA_PREFAB } from "./arena/prefab";
import { AIR_CAPTURE_FLAG_PREFAB } from "./flag/prefab";
import { AIR_CAPTURE_JUMP_PAD_PREFAB } from "./jump-pad/prefab";
import { AIR_CAPTURE_OBSTACLE_BLOCK_PREFAB } from "./obstacle-block/prefab";
import { AIR_CAPTURE_PLAYER_BASE_PREFAB } from "./player-base/prefab";
import { AIR_CAPTURE_SHIP_PREFAB } from "./ship/prefab";

export * from "./arena";
export * from "./flag";
export * from "./jump-pad";
export * from "./obstacle-block";
export * from "./player-base";
export * from "./ship";

export const AIR_CAPTURE_PREFABS = createPrefabCatalog([
  AIR_CAPTURE_ARENA_PREFAB,
  AIR_CAPTURE_FLAG_PREFAB,
  AIR_CAPTURE_JUMP_PAD_PREFAB,
  AIR_CAPTURE_OBSTACLE_BLOCK_PREFAB,
  AIR_CAPTURE_PLAYER_BASE_PREFAB,
  AIR_CAPTURE_SHIP_PREFAB,
] as const);

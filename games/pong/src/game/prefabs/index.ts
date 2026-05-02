import { createPrefabCatalog } from "@air-jam/sdk/prefabs";
import { PONG_ARENA_PREFAB } from "./arena/prefab";

export * from "./arena";

export const PONG_PREFABS = createPrefabCatalog([PONG_ARENA_PREFAB] as const);

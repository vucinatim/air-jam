export {
  createPrefabCatalog,
  definePrefab,
  type PrefabBoundsDescriptor,
  type PrefabCatalog,
  type PrefabDefinition,
  type PrefabFootprintDescriptor,
  type PrefabPlacementDescriptor,
  type PrefabPlacementOrigin,
  type PrefabPreviewDescriptor,
  type PrefabRenderFn,
} from "./prefabs/types";

export {
  STATIC_PREFAB_STATE,
  prefabCatalogMetadataSchema,
  prefabMetadata,
  prefabMetadataSchema,
  prefabStateSchema,
  type PrefabMetadata,
  type PrefabState,
} from "./prefabs/types";
export {
  DEFAULT_PREFAB_VIEW,
  prefabViewSchema,
  resolvePrefab2DTransform,
  resolvePrefabOrbitCamera,
  type PrefabView,
} from "./prefabs/view";

import type { PrefabCaptureVariants } from "@air-jam/visual-harness";

export const AIR_CAPTURE_PREFAB_CAPTURE_SURFACE = "prefab";
export const AIR_CAPTURE_PREFAB_CAPTURE_STAGE_TEST_ID =
  "air-capture-prefab-capture-stage";
export const AIR_CAPTURE_PREFAB_CAPTURE_SURFACE_PARAM =
  "aj_internal_surface";
export const AIR_CAPTURE_PREFAB_CAPTURE_PREFAB_PARAM = "aj_prefab";
export const AIR_CAPTURE_PREFAB_CAPTURE_VARIANT_PREFIX = "aj_variant_";

export const buildAirCapturePrefabCaptureUrl = ({
  hostUrl,
  prefabId,
  variants,
}: {
  hostUrl: string;
  prefabId: string;
  variants: PrefabCaptureVariants;
}): string => {
  const url = new URL(hostUrl);
  url.searchParams.set(
    AIR_CAPTURE_PREFAB_CAPTURE_SURFACE_PARAM,
    AIR_CAPTURE_PREFAB_CAPTURE_SURFACE,
  );
  url.searchParams.set(AIR_CAPTURE_PREFAB_CAPTURE_PREFAB_PARAM, prefabId);

  for (const [key, value] of Object.entries(variants)) {
    url.searchParams.set(
      `${AIR_CAPTURE_PREFAB_CAPTURE_VARIANT_PREFIX}${key}`,
      value,
    );
  }

  return url.toString();
};

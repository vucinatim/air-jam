import type { ArcadeSurfaceRuntimeIdentity } from "./arcade-surface-identity";

/**
 * Returns true when the iframe included surface identity that does not match the parent's active surface.
 * When `request` is undefined (legacy iframes), returns false.
 */
export const arcadeBridgeRequestSurfaceMismatchesActive = (
  active: ArcadeSurfaceRuntimeIdentity,
  request: ArcadeSurfaceRuntimeIdentity | undefined,
): boolean => {
  if (!request) {
    return false;
  }
  return (
    request.epoch !== active.epoch ||
    request.kind !== active.kind ||
    request.gameId !== active.gameId
  );
};

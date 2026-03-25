import type { ArcadeSurfaceRuntimeIdentity } from "./arcade-surface-identity";

/**
 * Returns true when the iframe surface identity does not match the parent's active surface.
 */
export const arcadeBridgeRequestSurfaceMismatchesActive = (
  active: ArcadeSurfaceRuntimeIdentity,
  request: ArcadeSurfaceRuntimeIdentity,
): boolean => {
  return (
    request.epoch !== active.epoch ||
    request.kind !== active.kind ||
    request.gameId !== active.gameId
  );
};

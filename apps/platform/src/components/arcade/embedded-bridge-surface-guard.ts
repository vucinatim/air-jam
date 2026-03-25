import type { ArcadeSurfaceRuntimeIdentity } from "@air-jam/sdk";
import { arcadeBridgeRequestSurfaceMismatchesActive } from "@air-jam/sdk";

/**
 * After a successful attach, the shell stores `attachIdentity`. Before each shell→iframe
 * forward, abort if the live replicated surface no longer matches that snapshot.
 */
export const embeddedBridgeForwardShouldClose = (
  attachIdentity: ArcadeSurfaceRuntimeIdentity | null,
  activeIdentity: ArcadeSurfaceRuntimeIdentity | null | undefined,
): boolean => {
  if (!attachIdentity || activeIdentity == null) {
    return false;
  }
  return arcadeBridgeRequestSurfaceMismatchesActive(
    activeIdentity,
    attachIdentity,
  );
};

/**
 * Reject an incoming controller iframe bridge request when the shell is on a game surface
 * but the child’s optional `arcadeSurface` does not match (stale iframe).
 */
export const shouldRejectControllerBridgeHandshake = (
  shellSurface: {
    kind: "browser" | "game";
    epoch: number;
    gameId: string | null;
  },
  requestArcadeSurface: ArcadeSurfaceRuntimeIdentity | undefined,
): boolean => {
  if (shellSurface.kind !== "game" || !shellSurface.gameId) {
    return false;
  }
  return arcadeBridgeRequestSurfaceMismatchesActive(
    {
      epoch: shellSurface.epoch,
      kind: shellSurface.kind,
      gameId: shellSurface.gameId,
    },
    requestArcadeSurface,
  );
};

/**
 * Reject an incoming host iframe bridge request when the parent has an active game identity
 * but the child’s optional `arcadeSurface` does not match.
 */
export const shouldRejectHostBridgeHandshake = (
  activeIdentity: ArcadeSurfaceRuntimeIdentity | null | undefined,
  requestArcadeSurface: ArcadeSurfaceRuntimeIdentity | undefined,
): boolean => {
  if (activeIdentity == null) {
    return false;
  }
  return arcadeBridgeRequestSurfaceMismatchesActive(
    activeIdentity,
    requestArcadeSurface,
  );
};

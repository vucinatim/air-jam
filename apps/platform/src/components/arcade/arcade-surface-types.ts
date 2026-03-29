/**
 * Canonical Arcade surface shape (see docs/arcade-surface-contract.md).
 * Owned by Arcade host replicated state and synced to controllers.
 */

export type { ArcadeSurfaceRuntimeIdentity } from "@air-jam/sdk/arcade/surface";

export type ArcadeSurfaceKind = "browser" | "game";

export type ArcadeOverlayKind = "hidden" | "menu" | "qr";

export interface ArcadeSurfaceState {
  epoch: number;
  kind: ArcadeSurfaceKind;
  gameId: string | null;
  controllerUrl: string | null;
  orientation: "portrait" | "landscape";
  overlay: ArcadeOverlayKind;
}

export const createInitialArcadeSurfaceState = ({
  mode,
}: {
  mode: "arcade" | "preview";
}): ArcadeSurfaceState => ({
  epoch: 1,
  kind: "browser",
  gameId: null,
  controllerUrl: null,
  orientation: "portrait",
  overlay: "hidden",
});

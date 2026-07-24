import type { ArcadeOverlayKind } from "./arcade-surface-types";

export type ArcadeLaunchQuerySource = Record<
  string,
  string | string[] | undefined
>;

export interface ArcadeLaunchQuery {
  initialOverlay: Extract<ArcadeOverlayKind, "qr"> | null;
}

const QR_QUERY_PARAM = "qr";
const QR_OPEN_VALUE = "open";

export const parseArcadeLaunchQuery = (
  source: ArcadeLaunchQuerySource,
): ArcadeLaunchQuery => ({
  initialOverlay: source[QR_QUERY_PARAM] === QR_OPEN_VALUE ? "qr" : null,
});

export const resolveInitialArcadeBrowserOverlay = (
  launchQuery: ArcadeLaunchQuery,
  fallback: Extract<ArcadeOverlayKind, "hidden" | "qr">,
): Extract<ArcadeOverlayKind, "hidden" | "qr"> =>
  launchQuery.initialOverlay ?? fallback;

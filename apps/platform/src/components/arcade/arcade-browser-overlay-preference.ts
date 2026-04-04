import type { ArcadeOverlayKind } from "./arcade-surface-types";

type ArcadeMode = "arcade" | "preview";
type BrowserOverlayPreference = Extract<ArcadeOverlayKind, "hidden" | "qr">;

const STORAGE_KEY = "airjam.arcade.browser-overlay";

const isBrowserOverlayPreference = (
  value: unknown,
): value is BrowserOverlayPreference =>
  value === "hidden" || value === "qr";

export const readArcadeBrowserOverlayPreference = (
  mode: ArcadeMode,
): BrowserOverlayPreference => {
  if (mode !== "arcade" || typeof window === "undefined") {
    return "hidden";
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (isBrowserOverlayPreference(raw)) {
      return raw;
    }
  } catch {
    // Best-effort only.
  }

  return "qr";
};

export const writeArcadeBrowserOverlayPreference = (
  mode: ArcadeMode,
  overlay: BrowserOverlayPreference,
): void => {
  if (mode !== "arcade" || typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(STORAGE_KEY, overlay);
  } catch {
    // Best-effort only.
  }
};

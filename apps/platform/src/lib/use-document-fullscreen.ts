"use client";

import type { DocumentWithFullscreen } from "@air-jam/sdk";
import { useSyncExternalStore } from "react";

function readDocumentFullscreen(): boolean {
  if (typeof document === "undefined") return false;
  const d = document as DocumentWithFullscreen;
  return !!(
    d.fullscreenElement ||
    d.webkitFullscreenElement ||
    d.mozFullScreenElement ||
    d.msFullscreenElement
  );
}

function subscribeFullscreen(onStoreChange: () => void) {
  const onChange = () => onStoreChange();
  document.addEventListener("fullscreenchange", onChange);
  document.addEventListener("webkitfullscreenchange", onChange);
  document.addEventListener("mozfullscreenchange", onChange);
  document.addEventListener("MSFullscreenChange", onChange);
  return () => {
    document.removeEventListener("fullscreenchange", onChange);
    document.removeEventListener("webkitfullscreenchange", onChange);
    document.removeEventListener("mozfullscreenchange", onChange);
    document.removeEventListener("MSFullscreenChange", onChange);
  };
}

/**
 * True while the document is in browser fullscreen (standard and common vendor APIs).
 */
export function useDocumentFullscreen(): boolean {
  return useSyncExternalStore(
    subscribeFullscreen,
    readDocumentFullscreen,
    () => false,
  );
}

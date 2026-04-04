"use client";

import type {
  DocumentWithFullscreen,
  ElementWithFullscreen,
} from "@air-jam/sdk";
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

export async function toggleDocumentFullscreen(
  target: HTMLElement | null =
    typeof document !== "undefined" ? document.documentElement : null,
): Promise<void> {
  if (typeof document === "undefined" || !target) {
    return;
  }

  const doc = document as DocumentWithFullscreen;
  const element = target as ElementWithFullscreen;

  if (
    doc.fullscreenElement ||
    doc.webkitFullscreenElement ||
    doc.mozFullScreenElement ||
    doc.msFullscreenElement
  ) {
    if (doc.exitFullscreen) {
      await doc.exitFullscreen();
      return;
    }
    if (doc.webkitExitFullscreen) {
      await doc.webkitExitFullscreen();
      return;
    }
    if (doc.mozCancelFullScreen) {
      await doc.mozCancelFullScreen();
      return;
    }
    if (doc.msExitFullscreen) {
      await doc.msExitFullscreen();
    }
    return;
  }

  if (element.requestFullscreen) {
    await element.requestFullscreen();
    return;
  }
  if (element.webkitRequestFullscreen) {
    await element.webkitRequestFullscreen();
    return;
  }
  if (element.mozRequestFullScreen) {
    await element.mozRequestFullScreen();
    return;
  }
  if (element.msRequestFullscreen) {
    await element.msRequestFullscreen();
  }
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

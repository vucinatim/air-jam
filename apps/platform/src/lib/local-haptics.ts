"use client";

export type LocalHapticPattern = "tap" | "selection" | "action" | "confirm";

const localHapticSequences: Record<LocalHapticPattern, number | number[]> = {
  tap: 4,
  selection: 8,
  action: 14,
  confirm: 22,
};

export const triggerLocalHaptic = (
  pattern: LocalHapticPattern = "selection",
): void => {
  if (typeof navigator === "undefined" || !navigator.vibrate) {
    return;
  }

  navigator.vibrate(localHapticSequences[pattern]);
};

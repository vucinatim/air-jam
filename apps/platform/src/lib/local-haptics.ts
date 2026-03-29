"use client";

export type LocalHapticPattern = "selection" | "action" | "confirm";

const localHapticSequences: Record<LocalHapticPattern, number | number[]> = {
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

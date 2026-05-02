type HapticIntent = "confirm" | "cancel";

const HAPTIC_PATTERNS: Record<HapticIntent, VibratePattern> = {
  confirm: 18,
  cancel: [16, 35, 16],
};

export const playControllerHaptic = (intent: HapticIntent) => {
  if (typeof navigator === "undefined" || !navigator.vibrate) {
    return;
  }

  navigator.vibrate(HAPTIC_PATTERNS[intent]);
};

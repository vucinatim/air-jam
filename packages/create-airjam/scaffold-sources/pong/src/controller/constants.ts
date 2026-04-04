export const POINTS_TO_WIN_OPTIONS = [3, 5, 7, 11] as const;

export const PRESS_FEEL_CLASS =
  "touch-manipulation active:brightness-110 active:shadow-[inset_0_0_0_2px_rgba(255,255,255,0.24)]";

export const formatMatchDuration = (durationMs: number): string => {
  const totalSeconds = Math.floor(durationMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
};

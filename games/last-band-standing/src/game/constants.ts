// ── Game defaults ──

// ── Timing intervals (ms) ──
export const NOW_TICK_MS = 250;

// ── YouTube playback ──
export const YOUTUBE_MAX_VOLUME = 100;
export const REVEAL_START_VOLUME = 50;
export const REVEAL_PAUSE_LEAD_MS = 30;
export const VIDEO_MIX_TICK_MS = 150;
export const SKIPPABLE_YOUTUBE_ERROR_CODES = new Set([
  2, 5, 100, 101, 150, 153,
]);

// ── Player name ──
export const PLAYER_NAME_MAX_LENGTH = 24;
export const PLAYER_NAME_MIN_LENGTH = 2;

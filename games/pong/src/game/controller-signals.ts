/**
 * Builders for the "signal lane" — out-of-band UX cues sent from the host to
 * controllers. Signals are for haptics and toasts; they don't mutate
 * authoritative game state (use store actions for that) and they don't carry
 * per-frame input (use the input lane for that).
 *
 * Keeping these as pure factories lets tests assert on the exact payload
 * without mocking the SDK.
 */
import type {
  HapticSignalPayload,
  ToastSignalPayload,
} from "@air-jam/sdk";
import {
  getTeamColor,
  getTeamLabel,
  type TeamId,
} from "./domain/team";
import type { MatchSummary } from "./stores";

const MATCH_WINNER_TOAST_DURATION_MS = 2200;

export const createPaddleHitHapticSignal = (): HapticSignalPayload => ({
  pattern: "light",
});

export const createMatchWinnerToastSignal = (
  winner: TeamId,
  matchSummary: MatchSummary | null,
): ToastSignalPayload => {
  const winnerLabel = getTeamLabel(winner);
  const winnerColor = getTeamColor(winner);
  const scoreSummary = matchSummary
    ? `${matchSummary.finalScores.team1}-${matchSummary.finalScores.team2}`
    : "Match complete";

  return {
    message: `${winnerLabel} wins ${scoreSummary}`,
    color: winnerColor,
    duration: MATCH_WINNER_TOAST_DURATION_MS,
  };
};

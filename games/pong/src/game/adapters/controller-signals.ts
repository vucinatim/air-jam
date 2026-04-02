import type {
  HapticSignalPayload,
  ToastSignalPayload,
} from "@air-jam/sdk";
import {
  getTeamColor,
  getTeamLabel,
  type TeamId,
} from "../domain/team";
import type { MatchSummary } from "../stores";

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

import { PLAYER_NAME_MAX_LENGTH } from "@/game/constants";

export interface PlayerScore {
  points: number;
  correct: number;
  wrong: number;
  totalResponseMs: number;
  answeredRounds: number;
  mostPointsStreak: number;
  hasStreakFire: boolean;
}

export const getLabelForPlayer = (
  playerId: string,
  playerLabelById: Record<string, string>,
): string => {
  return playerLabelById[playerId] ?? `Player ${playerId.slice(0, 4)}`;
};

export const isGenericPlayerLabel = (value: string): boolean => {
  return /^player\b/i.test(value.trim());
};

export const normalizePlayerName = (value: string): string => {
  return value.trim().replace(/\s+/g, " ").slice(0, PLAYER_NAME_MAX_LENGTH);
};

export const formatResponseTime = (responseMs: number): string => {
  return `${(responseMs / 1000).toFixed(2)}s`;
};

export const formatAverageResponseTime = (
  totalResponseMs: number,
  answeredRounds: number,
): string => {
  if (answeredRounds <= 0) {
    return "--";
  }

  return formatResponseTime(totalResponseMs / answeredRounds);
};

export const createEmptyScore = (): PlayerScore => ({
  points: 0,
  correct: 0,
  wrong: 0,
  totalResponseMs: 0,
  answeredRounds: 0,
  mostPointsStreak: 0,
  hasStreakFire: false,
});

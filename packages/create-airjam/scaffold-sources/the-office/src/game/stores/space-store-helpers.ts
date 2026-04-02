import type { PlayerStats } from "./types";

export const createDefaultPlayerStats = (): PlayerStats => ({
  energy: 100,
  boredom: 100,
  alive: true,
});

export const pruneRecord = <T>(
  record: Record<string, T>,
  connectedPlayerIds: Set<string>,
): Record<string, T> =>
  Object.fromEntries(
    Object.entries(record).filter(([playerId]) => connectedPlayerIds.has(playerId)),
  );

export const clearPlayerTaskState = (
  busyPlayers: Record<string, string>,
  taskProgress: Record<string, number>,
  playerId: string,
) => ({
  busyPlayers: Object.fromEntries(
    Object.entries(busyPlayers).filter(([key]) => key !== playerId),
  ),
  taskProgress: Object.fromEntries(
    Object.entries(taskProgress).filter(([key]) => key !== playerId),
  ),
});

export const restorePlayerStat = (
  currentStats: PlayerStats,
  key: "energy" | "boredom",
  amount: number,
): PlayerStats => ({
  ...currentStats,
  [key]: Math.min(100, currentStats[key] + amount),
});

export const markPlayerDead = (currentStats: PlayerStats): PlayerStats => ({
  ...currentStats,
  alive: false,
  energy: 0,
  boredom: 0,
});

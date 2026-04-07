import type { PlayerStats } from "./types";

export const createDefaultPlayerStats = (): PlayerStats => ({
  energy: 100,
  boredom: 100,
  alive: true,
});

export const pruneRecord = <T>(
  record: Record<string, T>,
  connectedPlayerIds: Set<string>,
): Record<string, T> => {
  let removedAny = false;
  const nextRecord: Record<string, T> = {};

  for (const [playerId, value] of Object.entries(record)) {
    if (!connectedPlayerIds.has(playerId)) {
      removedAny = true;
      continue;
    }
    nextRecord[playerId] = value;
  }

  if (!removedAny) {
    return record;
  }

  return nextRecord;
};

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

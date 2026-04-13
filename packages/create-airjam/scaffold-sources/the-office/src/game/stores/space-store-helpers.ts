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
) => {
  const hasBusyState = Object.prototype.hasOwnProperty.call(busyPlayers, playerId);
  const hasTaskProgress = Object.prototype.hasOwnProperty.call(taskProgress, playerId);

  if (!hasBusyState && !hasTaskProgress) {
    return {
      busyPlayers,
      taskProgress,
    };
  }

  return {
    busyPlayers: hasBusyState
      ? Object.fromEntries(
          Object.entries(busyPlayers).filter(([key]) => key !== playerId),
        )
      : busyPlayers,
    taskProgress: hasTaskProgress
      ? Object.fromEntries(
          Object.entries(taskProgress).filter(([key]) => key !== playerId),
        )
      : taskProgress,
  };
};

export const setRecordValue = <T>(
  record: Record<string, T>,
  key: string,
  value: T,
): Record<string, T> => {
  if (record[key] === value) {
    return record;
  }

  return {
    ...record,
    [key]: value,
  };
};

export const mergeRecordUpdates = <T>(
  record: Record<string, T>,
  updates: Record<string, T>,
): Record<string, T> => {
  let changed = false;
  const nextRecord: Record<string, T> = { ...record };

  for (const [key, value] of Object.entries(updates)) {
    if (record[key] === value) {
      continue;
    }
    nextRecord[key] = value;
    changed = true;
  }

  return changed ? nextRecord : record;
};

export const mergePlayerStatUpdates = (
  playerStats: Record<string, PlayerStats>,
  updatesByPlayerId: Record<string, Partial<PlayerStats>>,
): Record<string, PlayerStats> => {
  let changed = false;
  const nextPlayerStats: Record<string, PlayerStats> = { ...playerStats };

  for (const [playerId, updates] of Object.entries(updatesByPlayerId)) {
    const currentStats = playerStats[playerId] ?? createDefaultPlayerStats();
    const nextStats = {
      ...currentStats,
      ...updates,
    };

    if (
      currentStats.energy === nextStats.energy &&
      currentStats.boredom === nextStats.boredom &&
      currentStats.alive === nextStats.alive
    ) {
      continue;
    }

    nextPlayerStats[playerId] = nextStats;
    changed = true;
  }

  return changed ? nextPlayerStats : playerStats;
};

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

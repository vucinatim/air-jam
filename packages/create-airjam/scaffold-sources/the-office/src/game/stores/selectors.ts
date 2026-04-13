import { useSpaceStore } from "./space-store";
import type { PlayerStats } from "./types";

export const useOfficeMatchPhase = () => useSpaceStore((state) => state.matchPhase);

export const useOfficeGameOver = () => useSpaceStore((state) => state.gameOver);

export const useOfficeGameStartTime = () =>
  useSpaceStore((state) => state.gameStartTime);

export const useOfficeGameDurationMs = () =>
  useSpaceStore((state) => state.gameDurationMs);

export const useOfficeLifecycleVersion = () =>
  useSpaceStore((state) => state.lifecycleVersion);

export const useOfficePlayerAssignment = (
  controllerId: string | null | undefined,
) =>
  useSpaceStore((state) =>
    controllerId ? state.playerAssignments[controllerId] ?? null : null,
  );

export const useOfficePlayerBusyTask = (
  controllerId: string | null | undefined,
) =>
  useSpaceStore((state) =>
    controllerId ? state.busyPlayers[controllerId] ?? null : null,
  );

export const useOfficePlayerTaskProgress = (
  controllerId: string | null | undefined,
) =>
  useSpaceStore((state) =>
    controllerId ? state.taskProgress[controllerId] ?? 0 : 0,
  );

export const useOfficePlayerStats = (
  controllerId: string | null | undefined,
): PlayerStats | null =>
  useSpaceStore((state) =>
    controllerId ? state.playerStats[controllerId] ?? null : null,
  );

export const useOfficeSelectedPlayerCount = (controllerIds: readonly string[]) =>
  useSpaceStore((state) =>
    controllerIds.reduce(
      (count, controllerId) =>
        count + (state.playerAssignments[controllerId] ? 1 : 0),
      0,
    ),
  );

export const useOfficeTotalMoney = () =>
  useSpaceStore((state) =>
    Object.values(state.money).reduce((sum, amount) => sum + amount, 0),
  );

export const useOfficeFinalTotalMoney = () =>
  useSpaceStore((state) => {
    const totalMoney = Object.values(state.money).reduce(
      (sum, amount) => sum + amount,
      0,
    );
    return totalMoney - state.totalMoneyPenalty;
  });

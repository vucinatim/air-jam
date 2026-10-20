import { useAirJamStore } from "@air-jam/sdk";
import { spaceStore } from "./space-store";
import type { PlayerStats } from "./types";

export const useOfficeMatchPhase = () =>
  useAirJamStore(spaceStore, (state) => state.matchPhase);

export const useOfficeGameOver = () =>
  useAirJamStore(spaceStore, (state) => state.gameOver);

export const useOfficeGameDurationMs = () =>
  useAirJamStore(spaceStore, (state) => state.gameDurationMs);

export const useOfficeLifecycleVersion = () =>
  useAirJamStore(spaceStore, (state) => state.lifecycleVersion);

export const useOfficePlayerAssignment = (
  controllerId: string | null | undefined,
) =>
  useAirJamStore(spaceStore, (state) =>
    controllerId ? (state.playerAssignments[controllerId] ?? null) : null,
  );

export const useOfficePlayerBusyTask = (
  controllerId: string | null | undefined,
) =>
  useAirJamStore(spaceStore, (state) =>
    controllerId ? (state.busyPlayers[controllerId] ?? null) : null,
  );

export const useOfficePlayerTaskProgress = (
  controllerId: string | null | undefined,
) =>
  useAirJamStore(spaceStore, (state) =>
    controllerId ? (state.taskProgress[controllerId] ?? 0) : 0,
  );

export const useOfficePlayerStats = (
  controllerId: string | null | undefined,
): PlayerStats | null =>
  useAirJamStore(spaceStore, (state) =>
    controllerId ? (state.playerStats[controllerId] ?? null) : null,
  );

export const useOfficeSelectedPlayerCount = (
  controllerIds: readonly string[],
) =>
  useAirJamStore(spaceStore, (state) =>
    controllerIds.reduce(
      (count, controllerId) =>
        count + (state.playerAssignments[controllerId] ? 1 : 0),
      0,
    ),
  );

export const useOfficeTotalMoney = () =>
  useAirJamStore(spaceStore, (state) =>
    Object.values(state.money).reduce((sum, amount) => sum + amount, 0),
  );

export const useOfficeFinalTotalMoney = () =>
  useAirJamStore(spaceStore, (state) => {
    const totalMoney = Object.values(state.money).reduce(
      (sum, amount) => sum + amount,
      0,
    );
    return totalMoney - state.totalMoneyPenalty;
  });

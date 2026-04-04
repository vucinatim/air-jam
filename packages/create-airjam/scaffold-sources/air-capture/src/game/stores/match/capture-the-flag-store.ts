import { create } from "zustand";
import type {
  BaseEntryOutcome,
  CaptureTheFlagSnapshot,
  FlagState,
  FlagPickupOutcome,
} from "../../domain/capture-the-flag";
import type { TeamId } from "../../domain/team";
import {
  assignPlayerToTeam,
  createInitialCaptureTheFlagState,
  reduceDropFlagAtPosition,
  reduceManualScore,
  reduceRemovePlayer,
  reduceResetMatch,
  reduceSetPlayerTeam,
  transitionHandleBaseEntry,
  transitionTryPickupFlag,
} from "./capture-the-flag-store-state";

interface CaptureTheFlagState {
  playerTeams: CaptureTheFlagSnapshot["playerTeams"];
  flags: Record<TeamId, FlagState>;
  scores: Record<TeamId, number>;
  basePositions: Record<TeamId, [number, number, number]>;
  getBasePosition: (teamId: TeamId) => [number, number, number];
  assignPlayerToTeam: (controllerId: string) => TeamId;
  setPlayerTeam: (controllerId: string, teamId: TeamId) => void;
  getPlayerTeam: (controllerId: string) => TeamId | undefined;
  removePlayer: (controllerId: string) => void;
  resetMatch: () => void;
  handleBaseEntry: (
    controllerId: string,
    baseTeam: TeamId,
  ) => BaseEntryOutcome;
  tryPickupFlag: (
    controllerId: string,
    flagTeam: TeamId,
  ) => FlagPickupOutcome;
  dropFlagAtPosition: (
    controllerId: string,
    position?: [number, number, number],
  ) => void;
  manualScore: (teamId: TeamId) => void;
}
export const useCaptureTheFlagStore = create<CaptureTheFlagState>((set, get) => {
  const initialState = createInitialCaptureTheFlagState();
  return {
    ...initialState,
    getBasePosition: (teamId: TeamId) => {
      return get().basePositions[teamId];
    },
    assignPlayerToTeam: (controllerId: string) => {
      const result = assignPlayerToTeam(get(), controllerId);
      set(result.state);
      return result.teamId;
    },
    setPlayerTeam: (controllerId: string, teamId: TeamId) => {
      set((state) => reduceSetPlayerTeam(state, controllerId, teamId));
    },
    getPlayerTeam: (controllerId: string) => {
      return get().playerTeams[controllerId];
    },
    removePlayer: (controllerId: string) => {
      set((state) => reduceRemovePlayer(state, controllerId));
    },
    resetMatch: () => {
      set((state) => reduceResetMatch(state));
    },
    handleBaseEntry: (controllerId: string, baseTeam: TeamId) => {
      const result = transitionHandleBaseEntry(get(), controllerId, baseTeam);
      set(result.state);
      return result.outcome;
    },
    tryPickupFlag: (controllerId: string, flagTeam: TeamId) => {
      const result = transitionTryPickupFlag(get(), controllerId, flagTeam);
      set(result.state);
      return result.outcome;
    },
    dropFlagAtPosition: (controllerId: string, position) => {
      set((state) => reduceDropFlagAtPosition(state, controllerId, position));
    },
    manualScore: (teamId: TeamId) => {
      set((state) => reduceManualScore(state, teamId));
    },
  };
});

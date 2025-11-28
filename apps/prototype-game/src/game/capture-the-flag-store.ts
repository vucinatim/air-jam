import { create } from "zustand";

export const TEAM_CONFIG = {
  solaris: {
    id: "solaris",
    label: "Solaris",
    color: "#f97316",
    accent: "#fde047",
    basePosition: [-120, 0, 40] as [number, number, number],
  },
  nebulon: {
    id: "nebulon",
    label: "Nebulon",
    color: "#38bdf8",
    accent: "#a5f3fc",
    basePosition: [120, 0, -40] as [number, number, number],
  },
} as const;

export type TeamId = keyof typeof TEAM_CONFIG;

const TEAM_IDS = Object.keys(TEAM_CONFIG) as TeamId[];

type FlagStatus = "atBase" | "carried" | "dropped";

interface FlagState {
  teamId: TeamId;
  status: FlagStatus;
  position: [number, number, number];
  carrierId?: string;
}

interface CaptureTheFlagState {
  playerTeams: Record<string, TeamId>;
  flags: Record<TeamId, FlagState>;
  scores: Record<TeamId, number>;
  assignPlayerToTeam: (controllerId: string) => TeamId;
  getPlayerTeam: (controllerId: string) => TeamId | undefined;
  removePlayer: (controllerId: string) => void;
  handleBaseEntry: (controllerId: string, baseTeam: TeamId) => void;
  tryPickupFlag: (controllerId: string, flagTeam: TeamId) => void;
  dropFlagAtPosition: (
    controllerId: string,
    position?: [number, number, number]
  ) => void;
}

const createInitialFlags = (): Record<TeamId, FlagState> => {
  return TEAM_IDS.reduce((acc, teamId) => {
    const config = TEAM_CONFIG[teamId];
    acc[teamId] = {
      teamId,
      status: "atBase",
      position: [...config.basePosition],
    };
    return acc;
  }, {} as Record<TeamId, FlagState>);
};

const createInitialScores = (): Record<TeamId, number> =>
  TEAM_IDS.reduce((acc, teamId) => {
    acc[teamId] = 0;
    return acc;
  }, {} as Record<TeamId, number>);

const getEnemyTeam = (team: TeamId): TeamId => {
  return TEAM_IDS.find((id) => id !== team) || team;
};

export const useCaptureTheFlagStore = create<CaptureTheFlagState>(
  (set, get) => ({
    playerTeams: {},
    flags: createInitialFlags(),
    scores: createInitialScores(),
    assignPlayerToTeam: (controllerId: string) => {
      const teams = TEAM_IDS.reduce((counts, teamId) => {
        counts[teamId] = 0;
        return counts;
      }, {} as Record<TeamId, number>);

      Object.values(get().playerTeams).forEach((teamId) => {
        teams[teamId] += 1;
      });

      const targetTeam =
        TEAM_IDS.reduce((prev, current) => {
          return teams[current] < teams[prev] ? current : prev;
        }) ?? TEAM_IDS[0];

      set((state) => ({
        playerTeams: { ...state.playerTeams, [controllerId]: targetTeam },
      }));

      return targetTeam;
    },
    getPlayerTeam: (controllerId: string) => {
      return get().playerTeams[controllerId];
    },
    removePlayer: (controllerId: string) => {
      set((state) => {
        const updatedPlayerTeams = { ...state.playerTeams };
        delete updatedPlayerTeams[controllerId];

        let updatedFlags = state.flags;
        TEAM_IDS.forEach((teamId) => {
          const flag = state.flags[teamId];
          if (flag.carrierId === controllerId) {
            const config = TEAM_CONFIG[teamId];
            updatedFlags = {
              ...updatedFlags,
              [teamId]: {
                ...flag,
                status: "atBase",
                carrierId: undefined,
                position: [...config.basePosition],
              },
            };
          }
        });

        return {
          playerTeams: updatedPlayerTeams,
          flags: updatedFlags,
        };
      });
    },
    handleBaseEntry: (controllerId: string, baseTeam: TeamId) => {
      const playerTeam = get().playerTeams[controllerId];
      if (!playerTeam) return;

      if (playerTeam === baseTeam) {
        set((state) => {
          const enemyTeam = getEnemyTeam(playerTeam);
          const enemyFlag = state.flags[enemyTeam];
          const ownFlag = state.flags[playerTeam];
          let updated = false;
          let updatedFlags = state.flags;
          let updatedScores = state.scores;

          if (
            enemyFlag.status === "carried" &&
            enemyFlag.carrierId === controllerId
          ) {
            updated = true;
            updatedFlags = {
              ...updatedFlags,
              [enemyTeam]: {
                ...enemyFlag,
                status: "atBase",
                carrierId: undefined,
                position: [...TEAM_CONFIG[enemyTeam].basePosition],
              },
            };
            updatedScores = {
              ...updatedScores,
              [playerTeam]: updatedScores[playerTeam] + 1,
            };
          }

          if (ownFlag.status === "dropped") {
            updated = true;
            updatedFlags = {
              ...updatedFlags,
              [playerTeam]: {
                ...ownFlag,
                status: "atBase",
                position: [...TEAM_CONFIG[playerTeam].basePosition],
              },
            };
          }

          if (!updated) return state;
          return { ...state, flags: updatedFlags, scores: updatedScores };
        });
      } else {
        get().tryPickupFlag(controllerId, baseTeam);
      }
    },
    tryPickupFlag: (controllerId: string, flagTeam: TeamId) => {
      const playerTeam = get().playerTeams[controllerId];
      if (!playerTeam) return;

      set((state) => {
        const flag = state.flags[flagTeam];

        // If flag is already carried, can't pick it up
        if (flag.status === "carried") return state;

        // If player is on the same team as the flag, they can return it to base
        if (playerTeam === flagTeam) {
          // Same team - return flag to base
          return {
            ...state,
            flags: {
              ...state.flags,
              [flagTeam]: {
                ...flag,
                status: "atBase",
                position: [...TEAM_CONFIG[flagTeam].basePosition],
              },
            },
          };
        } else {
          // Enemy team - pick up the flag
          return {
            ...state,
            flags: {
              ...state.flags,
              [flagTeam]: {
                ...flag,
                status: "carried",
                carrierId: controllerId,
              },
            },
          };
        }
      });
    },
    dropFlagAtPosition: (controllerId: string, position) => {
      set((state) => {
        let updatedFlags = state.flags;
        let changed = false;

        TEAM_IDS.forEach((teamId) => {
          const flag = state.flags[teamId];
          if (flag.carrierId === controllerId) {
            changed = true;
            updatedFlags = {
              ...updatedFlags,
              [teamId]: {
                ...flag,
                status: position ? "dropped" : "atBase",
                carrierId: undefined,
                position: position
                  ? [...position]
                  : [...TEAM_CONFIG[teamId].basePosition],
              },
            };
          }
        });

        if (!changed) return state;
        return { ...state, flags: updatedFlags };
      });
    },
  })
);

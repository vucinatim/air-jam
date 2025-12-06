import { create } from "zustand";
import { ARENA_RADIUS } from "./constants";

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
  basePositions: Record<TeamId, [number, number, number]>;
  getBasePosition: (teamId: TeamId) => [number, number, number];
  assignPlayerToTeam: (controllerId: string) => TeamId;
  getPlayerTeam: (controllerId: string) => TeamId | undefined;
  removePlayer: (controllerId: string) => void;
  handleBaseEntry: (controllerId: string, baseTeam: TeamId) => void;
  tryPickupFlag: (controllerId: string, flagTeam: TeamId) => void;
  dropFlagAtPosition: (
    controllerId: string,
    position?: [number, number, number],
  ) => void;
  manualScore: (teamId: TeamId) => void;
}

const createInitialFlags = (
  basePositions: Record<TeamId, [number, number, number]>,
): Record<TeamId, FlagState> => {
  return TEAM_IDS.reduce(
    (acc, teamId) => {
      acc[teamId] = {
        teamId,
        status: "atBase",
        position: [...basePositions[teamId]],
      };
      return acc;
    },
    {} as Record<TeamId, FlagState>,
  );
};

const createInitialScores = (): Record<TeamId, number> =>
  TEAM_IDS.reduce(
    (acc, teamId) => {
      acc[teamId] = 0;
      return acc;
    },
    {} as Record<TeamId, number>,
  );

const getEnemyTeam = (team: TeamId): TeamId => {
  return TEAM_IDS.find((id) => id !== team) || team;
};

/**
 * Generate random base positions on opposite sides of the arena
 * Bases are placed on the outskirts (near the edge but not too close)
 * Ensures positions are within arena bounds (circular in X-Z plane)
 */
const generateRandomBasePositions = (): Record<
  TeamId,
  [number, number, number]
> => {
  // Distance from center (outskirts, but not at the very edge)
  // Keep safe margin from the arena boundary to ensure bases are always visible
  const minDistance = ARENA_RADIUS * 0.65; // 130 units from center
  const maxDistance = ARENA_RADIUS * 0.85; // 170 units from center (30 unit margin from 200)

  // Generate random angle for first base
  const angle1 = Math.random() * Math.PI * 2;
  const distance1 = minDistance + Math.random() * (maxDistance - minDistance);
  let x1 = Math.cos(angle1) * distance1;
  let z1 = Math.sin(angle1) * distance1;

  // Clamp to ensure within arena bounds (2D distance check)
  // Use a conservative max distance to ensure bases are always visible
  const maxSafeDistance = ARENA_RADIUS - 15; // 15 unit safety margin (185 units max)
  let dist1 = Math.sqrt(x1 * x1 + z1 * z1);
  if (dist1 > maxSafeDistance) {
    // Clamp to safe distance
    const scale = maxSafeDistance / dist1;
    x1 *= scale;
    z1 *= scale;
    dist1 = maxSafeDistance;
  }

  // Calculate the actual angle from the final first base position
  // This ensures the second base is truly opposite
  const actualAngle1 = Math.atan2(z1, x1);

  // Second base should be on opposite side (exactly 180 degrees opposite)
  const oppositeAngle = actualAngle1 + Math.PI;
  const distance2 = minDistance + Math.random() * (maxDistance - minDistance);
  let x2 = Math.cos(oppositeAngle) * distance2;
  let z2 = Math.sin(oppositeAngle) * distance2;

  // Clamp to ensure within arena bounds
  let dist2 = Math.sqrt(x2 * x2 + z2 * z2);
  if (dist2 > maxSafeDistance) {
    // Clamp to safe distance
    const scale = maxSafeDistance / dist2;
    x2 *= scale;
    z2 *= scale;
    dist2 = maxSafeDistance;
  }

  // Final verification - ensure both positions are within bounds
  const finalDist1 = Math.sqrt(x1 * x1 + z1 * z1);
  const finalDist2 = Math.sqrt(x2 * x2 + z2 * z2);
  if (finalDist1 > ARENA_RADIUS || finalDist2 > ARENA_RADIUS) {
    // Fallback: use safe positions if something went wrong
    console.warn(
      "Base position generation produced out-of-bounds positions, using fallback",
    );
    return {
      solaris: [ARENA_RADIUS * 0.7, 0, 0] as [number, number, number],
      nebulon: [-ARENA_RADIUS * 0.7, 0, 0] as [number, number, number],
    };
  }

  // Randomly assign to teams
  if (Math.random() > 0.5) {
    return {
      solaris: [x1, 0, z1] as [number, number, number],
      nebulon: [x2, 0, z2] as [number, number, number],
    };
  } else {
    return {
      solaris: [x2, 0, z2] as [number, number, number],
      nebulon: [x1, 0, z1] as [number, number, number],
    };
  }
};

const createInitialBasePositions = (): Record<
  TeamId,
  [number, number, number]
> => {
  // Start with positions from TEAM_CONFIG, then generate new ones
  return generateRandomBasePositions();
};

export const useCaptureTheFlagStore = create<CaptureTheFlagState>(
  (set, get) => {
    const initialBasePositions = createInitialBasePositions();
    return {
      playerTeams: {},
      flags: createInitialFlags(initialBasePositions),
      scores: createInitialScores(),
      basePositions: initialBasePositions,
      getBasePosition: (teamId: TeamId) => {
        return get().basePositions[teamId];
      },
      assignPlayerToTeam: (controllerId: string) => {
        const teams = TEAM_IDS.reduce(
          (counts, teamId) => {
            counts[teamId] = 0;
            return counts;
          },
          {} as Record<TeamId, number>,
        );

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
              updatedFlags = {
                ...updatedFlags,
                [teamId]: {
                  ...flag,
                  status: "atBase",
                  carrierId: undefined,
                  position: [...state.basePositions[teamId]],
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

              // Generate new base positions when a team scores
              const newBasePositions = generateRandomBasePositions();

              // Update enemy flag to new base position (it was just scored)
              updatedFlags = {
                ...updatedFlags,
                [enemyTeam]: {
                  ...enemyFlag,
                  status: "atBase",
                  carrierId: undefined,
                  position: [...newBasePositions[enemyTeam]],
                },
              };

              // Only move own flag to new base if it's not being carried
              // If it's being carried or dropped, keep it where it is
              if (ownFlag.status === "atBase") {
                updatedFlags = {
                  ...updatedFlags,
                  [playerTeam]: {
                    ...ownFlag,
                    status: "atBase",
                    position: [...newBasePositions[playerTeam]],
                  },
                };
              }

              updatedScores = {
                ...updatedScores,
                [playerTeam]: updatedScores[playerTeam] + 1,
              };

              return {
                ...state,
                flags: updatedFlags,
                scores: updatedScores,
                basePositions: newBasePositions,
              };
            }

            if (ownFlag.status === "dropped") {
              updated = true;
              updatedFlags = {
                ...updatedFlags,
                [playerTeam]: {
                  ...ownFlag,
                  status: "atBase",
                  position: [...state.basePositions[playerTeam]],
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
                  position: [...state.basePositions[flagTeam]],
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
                    : [...state.basePositions[teamId]],
                },
              };
            }
          });

          if (!changed) return state;
          return { ...state, flags: updatedFlags };
        });
      },
      manualScore: (teamId: TeamId) => {
        set((state) => {
          const enemyTeam = getEnemyTeam(teamId);

          // Generate new base positions when a team scores
          const newBasePositions = generateRandomBasePositions();

          // Update flags to new base positions
          // Only move flags that are at base (not carried or dropped)
          const updatedFlags = {
            ...state.flags,
            [enemyTeam]: {
              ...state.flags[enemyTeam],
              status:
                state.flags[enemyTeam].status === "atBase"
                  ? "atBase"
                  : state.flags[enemyTeam].status,
              position:
                state.flags[enemyTeam].status === "atBase"
                  ? [...newBasePositions[enemyTeam]]
                  : [...state.flags[enemyTeam].position],
            },
            [teamId]: {
              ...state.flags[teamId],
              status:
                state.flags[teamId].status === "atBase"
                  ? "atBase"
                  : state.flags[teamId].status,
              position:
                state.flags[teamId].status === "atBase"
                  ? [...newBasePositions[teamId]]
                  : [...state.flags[teamId].position],
            },
          };

          return {
            ...state,
            flags: updatedFlags,
            scores: {
              ...state.scores,
              [teamId]: state.scores[teamId] + 1,
            },
            basePositions: newBasePositions,
          };
        });
      },
    };
  },
);

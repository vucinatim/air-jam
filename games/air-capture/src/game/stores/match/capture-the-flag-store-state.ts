import {
  TEAM_IDS,
  type TeamId,
} from "../../domain/team";
import {
  type BaseEntryOutcome,
  createInitialFlags,
  createInitialScores,
  type FlagPickupOutcome,
  generateRandomBasePositions,
  getEnemyTeam,
  type CaptureTheFlagSnapshot,
  type TeamPosition,
  type TeamPositions,
} from "../../domain/capture-the-flag";

export function createInitialCaptureTheFlagState(
  basePositions: TeamPositions = generateRandomBasePositions(),
): CaptureTheFlagSnapshot {
  return {
    playerTeams: {},
    flags: createInitialFlags(basePositions),
    scores: createInitialScores(),
    basePositions,
  };
}

export function assignPlayerToTeam(
  state: CaptureTheFlagSnapshot,
  controllerId: string,
): {
  state: CaptureTheFlagSnapshot;
  teamId: TeamId;
} {
  const teamCounts = TEAM_IDS.reduce(
    (counts, teamId) => {
      counts[teamId] = 0;
      return counts;
    },
    {} as Record<TeamId, number>,
  );

  Object.values(state.playerTeams).forEach((teamId) => {
    teamCounts[teamId] += 1;
  });

  const teamId =
    TEAM_IDS.reduce((prev, current) =>
      teamCounts[current] < teamCounts[prev] ? current : prev,
    ) ?? TEAM_IDS[0];

  return {
    teamId,
    state: {
      ...state,
      playerTeams: {
        ...state.playerTeams,
        [controllerId]: teamId,
      },
    },
  };
}

export function reduceSetPlayerTeam(
  state: CaptureTheFlagSnapshot,
  controllerId: string,
  teamId: TeamId,
): CaptureTheFlagSnapshot {
  if (state.playerTeams[controllerId] === teamId) {
    return state;
  }

  return {
    ...state,
    playerTeams: {
      ...state.playerTeams,
      [controllerId]: teamId,
    },
  };
}

export function reduceRemovePlayer(
  state: CaptureTheFlagSnapshot,
  controllerId: string,
): CaptureTheFlagSnapshot {
  const updatedPlayerTeams = { ...state.playerTeams };
  delete updatedPlayerTeams[controllerId];

  let updatedFlags = state.flags;
  let changed = false;
  for (const teamId of TEAM_IDS) {
    const flag = state.flags[teamId];
    if (flag.carrierId === controllerId) {
      changed = true;
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
  }

  if (
    !changed &&
    Object.keys(updatedPlayerTeams).length === Object.keys(state.playerTeams).length
  ) {
    return state;
  }

  return {
    ...state,
    playerTeams: updatedPlayerTeams,
    flags: updatedFlags,
  };
}

export function reduceResetMatch(
  state: CaptureTheFlagSnapshot,
  nextBasePositions: TeamPositions = generateRandomBasePositions(),
): CaptureTheFlagSnapshot {
  return {
    ...state,
    flags: createInitialFlags(nextBasePositions),
    scores: createInitialScores(),
    basePositions: nextBasePositions,
  };
}

export function transitionHandleBaseEntry(
  state: CaptureTheFlagSnapshot,
  controllerId: string,
  baseTeam: TeamId,
  nextBasePositions: TeamPositions = generateRandomBasePositions(),
): {
  state: CaptureTheFlagSnapshot;
  outcome: BaseEntryOutcome;
} {
  const playerTeam = state.playerTeams[controllerId];
  if (!playerTeam) {
    return {
      state,
      outcome: "none",
    };
  }

  if (playerTeam !== baseTeam) {
    const result = transitionTryPickupFlag(
      state,
      controllerId,
      baseTeam,
    );
    return {
      state: result.state,
      outcome:
        result.outcome === "pickedUpEnemyFlag" ? "pickedUpEnemyFlag" : "none",
    };
  }

  const nextState = reduceHandleBaseEntry(
    state,
    controllerId,
    baseTeam,
    nextBasePositions,
  );

  if (nextState === state) {
    return {
      state,
      outcome: "none",
    };
  }

  if (nextState.scores[playerTeam] > state.scores[playerTeam]) {
    return {
      state: nextState,
      outcome: "scoredPoint",
    };
  }

  if (
    state.flags[playerTeam].status === "dropped" &&
    nextState.flags[playerTeam].status === "atBase"
  ) {
    return {
      state: nextState,
      outcome: "returnedFriendlyFlag",
    };
  }

  return {
    state: nextState,
    outcome: "none",
  };
}

export function transitionTryPickupFlag(
  state: CaptureTheFlagSnapshot,
  controllerId: string,
  flagTeam: TeamId,
): {
  state: CaptureTheFlagSnapshot;
  outcome: FlagPickupOutcome;
} {
  const playerTeam = state.playerTeams[controllerId];
  if (!playerTeam) {
    return {
      state,
      outcome: "none",
    };
  }

  const nextState = reduceTryPickupFlag(state, controllerId, flagTeam);
  if (nextState === state) {
    return {
      state,
      outcome: "none",
    };
  }

  const previousFlag = state.flags[flagTeam];
  const nextFlag = nextState.flags[flagTeam];

  if (
    playerTeam === flagTeam &&
    previousFlag.status === "dropped" &&
    nextFlag.status === "atBase"
  ) {
    return {
      state: nextState,
      outcome: "returnedFriendlyFlag",
    };
  }

  if (
    playerTeam !== flagTeam &&
    previousFlag.status !== "carried" &&
    nextFlag.status === "carried" &&
    nextFlag.carrierId === controllerId
  ) {
    return {
      state: nextState,
      outcome: "pickedUpEnemyFlag",
    };
  }

  return {
    state: nextState,
    outcome: "none",
  };
}

export function reduceHandleBaseEntry(
  state: CaptureTheFlagSnapshot,
  controllerId: string,
  baseTeam: TeamId,
  nextBasePositions: TeamPositions = generateRandomBasePositions(),
): CaptureTheFlagSnapshot {
  const playerTeam = state.playerTeams[controllerId];
  if (!playerTeam) {
    return state;
  }

  if (playerTeam !== baseTeam) {
    return reduceTryPickupFlag(state, controllerId, baseTeam);
  }

  const enemyTeam = getEnemyTeam(playerTeam);
  const enemyFlag = state.flags[enemyTeam];
  const ownFlag = state.flags[playerTeam];

  if (enemyFlag.status === "carried" && enemyFlag.carrierId === controllerId) {
    let updatedFlags = {
      ...state.flags,
      [enemyTeam]: {
        ...enemyFlag,
        status: "atBase" as const,
        carrierId: undefined,
        position: [...nextBasePositions[enemyTeam]],
      },
    };

    if (ownFlag.status === "atBase") {
      updatedFlags = {
        ...updatedFlags,
        [playerTeam]: {
          ...ownFlag,
          status: "atBase",
          position: [...nextBasePositions[playerTeam]],
        },
      };
    }

    return {
      ...state,
      flags: updatedFlags,
      scores: {
        ...state.scores,
        [playerTeam]: state.scores[playerTeam] + 1,
      },
      basePositions: nextBasePositions,
    };
  }

  if (ownFlag.status === "dropped") {
    return {
      ...state,
      flags: {
        ...state.flags,
        [playerTeam]: {
          ...ownFlag,
          status: "atBase",
          position: [...state.basePositions[playerTeam]],
        },
      },
    };
  }

  return state;
}

export function reduceTryPickupFlag(
  state: CaptureTheFlagSnapshot,
  controllerId: string,
  flagTeam: TeamId,
): CaptureTheFlagSnapshot {
  const playerTeam = state.playerTeams[controllerId];
  if (!playerTeam) {
    return state;
  }

  const flag = state.flags[flagTeam];
  if (flag.status === "carried") {
    return state;
  }

  if (playerTeam === flagTeam) {
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
  }

  const ownFlag = state.flags[playerTeam];
  if (ownFlag.status === "carried") {
    return state;
  }

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

export function reduceDropFlagAtPosition(
  state: CaptureTheFlagSnapshot,
  controllerId: string,
  position?: TeamPosition,
): CaptureTheFlagSnapshot {
  let updatedFlags = state.flags;
  let changed = false;

  for (const teamId of TEAM_IDS) {
    const flag = state.flags[teamId];
    if (flag.carrierId === controllerId) {
      changed = true;
      updatedFlags = {
        ...updatedFlags,
        [teamId]: {
          ...flag,
          status: position ? "dropped" : "atBase",
          carrierId: undefined,
          position: position ? [...position] : [...state.basePositions[teamId]],
        },
      };
    }
  }

  return changed
    ? {
        ...state,
        flags: updatedFlags,
      }
    : state;
}

export function reduceManualScore(
  state: CaptureTheFlagSnapshot,
  teamId: TeamId,
  nextBasePositions: TeamPositions = generateRandomBasePositions(),
): CaptureTheFlagSnapshot {
  const enemyTeam = getEnemyTeam(teamId);

  return {
    ...state,
    flags: {
      ...state.flags,
      [enemyTeam]: updateFlagBasePosition(
        state.flags[enemyTeam],
        nextBasePositions[enemyTeam],
      ),
      [teamId]: updateFlagBasePosition(
        state.flags[teamId],
        nextBasePositions[teamId],
      ),
    },
    scores: {
      ...state.scores,
      [teamId]: state.scores[teamId] + 1,
    },
    basePositions: nextBasePositions,
  };
}

function updateFlagBasePosition(
  flag: CaptureTheFlagSnapshot["flags"][TeamId],
  nextBasePosition: TeamPosition,
) {
  if (flag.status !== "atBase") {
    return {
      ...flag,
      position: [...flag.position],
    };
  }

  return {
    ...flag,
    status: "atBase" as const,
    position: [...nextBasePosition],
  };
}

import { defineAirJamGameAgentContract } from "@air-jam/sdk";
import {
  getPlayerById,
  getPlayerCapabilityHighlights,
  PLAYERS,
  type Player,
} from "../content/players";

const DEFAULT_STORE_DOMAIN = "default";

type OfficeMatchPhase = "lobby" | "playing" | "ended";

interface PlayerStats {
  energy: number;
  boredom: number;
  alive: boolean;
}

interface OfficeState {
  matchPhase: OfficeMatchPhase;
  money: Record<string, number>;
  totalMoneyPenalty: number;
  gameDurationMs: number;
  playerAssignments: Record<string, string>;
  busyPlayers: Record<string, string>;
  taskProgress: Record<string, number>;
  playerStats: Record<string, PlayerStats>;
  gameOver: boolean;
}

const readOfficeState = (
  stores: Record<string, Record<string, unknown>>,
): OfficeState | null => {
  const candidate = stores[DEFAULT_STORE_DOMAIN];
  if (!candidate) {
    return null;
  }

  return candidate as unknown as OfficeState;
};

const summarizePlayer = (
  player: Player,
  controllerIds: readonly string[],
  state: OfficeState,
) => {
  const selectedByControllerId =
    controllerIds.find(
      (controllerId) => state.playerAssignments[controllerId] === player.id,
    ) ?? null;
  const stats = selectedByControllerId
    ? (state.playerStats[selectedByControllerId] ?? null)
    : null;

  return {
    id: player.id,
    name: player.name,
    selected: selectedByControllerId !== null,
    selectedByControllerId,
    taskHighlights: getPlayerCapabilityHighlights(player.id),
    stats: stats
      ? {
          energy: stats.energy,
          boredom: stats.boredom,
          alive: stats.alive,
        }
      : null,
  };
};

export const gameAgentContract = defineAirJamGameAgentContract({
  gameId: "the-office",
  snapshotStoreDomains: [DEFAULT_STORE_DOMAIN],
  snapshotDescription:
    "Game-focused snapshot for The Office with character selection, live assignment state, and score totals.",
  projectSnapshot: ({ controllerId, stores }) => {
    const state = readOfficeState(stores);
    if (!state) {
      return {
        phase: "unavailable",
        summary: "Default replicated Office store is not available yet.",
      };
    }

    const controllerIds = Object.keys(state.playerAssignments);
    const mySelectedPlayerId = controllerId
      ? (state.playerAssignments[controllerId] ?? null)
      : null;
    const mySelectedPlayer = mySelectedPlayerId
      ? getPlayerById(mySelectedPlayerId)
      : null;
    const totalMoney = Object.values(state.money).reduce(
      (sum, amount) => sum + amount,
      0,
    );

    return {
      phase: state.matchPhase,
      lobby: {
        selectedPlayerCount: controllerIds.length,
        canStartMatch: state.matchPhase === "lobby" && controllerIds.length > 0,
        availablePlayers: PLAYERS.map((player) =>
          summarizePlayer(player, controllerIds, state),
        ),
      },
      mySelection: mySelectedPlayer
        ? {
            playerId: mySelectedPlayer.id,
            name: mySelectedPlayer.name,
            busyTask: controllerId
              ? (state.busyPlayers[controllerId] ?? null)
              : null,
            taskProgress: controllerId
              ? (state.taskProgress[controllerId] ?? 0)
              : 0,
          }
        : null,
      scoreboard: {
        totalMoney,
        totalMoneyPenalty: state.totalMoneyPenalty,
        finalTotalMoney: totalMoney - state.totalMoneyPenalty,
      },
      availableActions: [
        "select_character",
        "start_match",
        "return_to_lobby",
        "restart_match",
      ],
    };
  },
  actions: {
    select_character: {
      target: {
        kind: "controller",
        actionName: "selectCharacter",
        storeDomain: DEFAULT_STORE_DOMAIN,
      },
      description:
        "Assign the current controller to one Office coworker in the lobby.",
      availability: "Lobby only. Requires a connected controller identity.",
      payload: {
        kind: "enum",
        description: "The coworker to control.",
        allowedValues: PLAYERS.map((player) => player.id),
      },
      resolveInput: (input) => ({
        playerId: String(input),
      }),
      resultDescription:
        "The controller claims that coworker if another controller has not already selected them.",
    },
    start_match: {
      target: {
        kind: "controller",
        actionName: "startMatch",
        storeDomain: DEFAULT_STORE_DOMAIN,
      },
      description:
        "Start the Office match after at least one coworker is selected.",
      availability: "Lobby only.",
      payload: {
        kind: "none",
      },
      resultDescription: "The match phase switches from lobby to playing.",
    },
    return_to_lobby: {
      target: {
        kind: "controller",
        actionName: "returnToLobby",
        storeDomain: DEFAULT_STORE_DOMAIN,
      },
      description: "Return the Office match to the lobby.",
      availability: "Playing or ended phases.",
      payload: {
        kind: "none",
      },
      resultDescription:
        "The game returns to the lobby and clears live match state.",
    },
    restart_match: {
      target: {
        kind: "controller",
        actionName: "restartMatch",
        storeDomain: DEFAULT_STORE_DOMAIN,
      },
      description: "Restart the Office match immediately from the ended state.",
      availability: "Ended phase.",
      payload: {
        kind: "none",
      },
      resultDescription: "The game restarts into a fresh playing state.",
    },
  },
});

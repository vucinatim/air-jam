import {
  defineAirJamGameAgentContract,
  defineAirJamGameAgentStores,
  gameAgentAction,
  gameAgentStore,
  machineActionInput,
  readAirJamDefaultGameStore,
} from "@air-jam/sdk";
import {
  getPlayerById,
  getPlayerCapabilityHighlights,
  PLAYERS,
  type Player,
} from "../content/players";

const DEFAULT_STORE_DOMAIN = "default";
const snapshotStores = defineAirJamGameAgentStores({
  [DEFAULT_STORE_DOMAIN]: gameAgentStore<OfficeState>(),
});

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
  snapshotStores,
  snapshotDescription:
    "Game-focused snapshot for The Office with character selection, live assignment state, and score totals.",
  projectSnapshot: (context) => {
    const { controllerId } = context;
    const state = readAirJamDefaultGameStore(context);
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
    select_character: gameAgentAction.player(
      {
        actionName: "selectCharacter",
        storeDomain: DEFAULT_STORE_DOMAIN,
      },
      {
        input: machineActionInput.enum(
          PLAYERS.map((player) => player.id) as [
            string,
            ...string[],
          ],
          {
            payloadDescription: "The coworker to control.",
          },
        ),
        toPayload: (playerId) => ({ playerId }),
        description:
          "Assign the current controller to one Office coworker in the lobby.",
        availability: "Lobby only. Requires a connected controller identity.",
        resultDescription:
          "The controller claims that coworker if another controller has not already selected them.",
      },
    ),
    start_match: gameAgentAction.player(
      {
        actionName: "startMatch",
        storeDomain: DEFAULT_STORE_DOMAIN,
      },
      {
        input: machineActionInput.none(),
        description:
          "Start the Office match after at least one coworker is selected.",
        availability: "Lobby only.",
        resultDescription: "The match phase switches from lobby to playing.",
      },
    ),
    return_to_lobby: gameAgentAction.player(
      {
        actionName: "returnToLobby",
        storeDomain: DEFAULT_STORE_DOMAIN,
      },
      {
        input: machineActionInput.none(),
        description: "Return the Office match to the lobby.",
        availability: "Playing or ended phases.",
        resultDescription:
          "The game returns to the lobby and clears live match state.",
      },
    ),
    restart_match: gameAgentAction.player(
      {
        actionName: "restartMatch",
        storeDomain: DEFAULT_STORE_DOMAIN,
      },
      {
        input: machineActionInput.none(),
        description:
          "Restart the Office match immediately from the ended state.",
        availability: "Ended phase.",
        resultDescription: "The game restarts into a fresh playing state.",
      },
    ),
  },
});

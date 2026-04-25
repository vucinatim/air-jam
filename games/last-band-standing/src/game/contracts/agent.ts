import { defineAirJamGameAgentContract } from "@air-jam/sdk";
import {
  defaultSelectedSongBucketIds,
  getRoundOptionLabel,
  getSongById,
  getUniqueSongCountForBuckets,
  songBuckets,
  type SongBucketId,
} from "../content/song-bank";

const DEFAULT_STORE_DOMAIN = "default";
type GamePhase =
  | "lobby"
  | "match-countdown"
  | "round-active"
  | "round-reveal"
  | "game-over";
type RoundGuessKind = "artist" | "song-title";

interface PlayerScore {
  points: number;
  correct: number;
  wrong: number;
  answeredRounds: number;
}

interface PlayerAnswer {
  optionId: string;
  answeredAtMs: number;
}

interface RoundPlayerResult {
  correct: boolean;
  optionId: string | null;
  responseMs: number | null;
  awardedPoints: number;
}

interface ActiveRound {
  roundNumber: number;
  guessKind: RoundGuessKind;
  songId: string;
  expectedPlayerIds: string[];
  optionOrder: string[];
}

interface RoundReveal {
  roundNumber: number;
  guessKind: RoundGuessKind;
  correctOptionId: string;
  correctOptionLabel: string;
  songTitle: string;
  songArtist: string;
  firstCorrectPlayerId: string | null;
  resultsByPlayerId: Record<string, RoundPlayerResult>;
}

interface QuizState {
  phase: GamePhase;
  playerOrder: string[];
  playerLabelById: Record<string, string>;
  readyByPlayerId: Record<string, boolean>;
  totalRounds: number;
  roundDurationSec: number;
  revealDurationSec: number;
  selectedSongBucketIds: SongBucketId[];
  playedSongKeys: string[];
  activePlayerIds: string[];
  completedRoundCount: number;
  currentRound: ActiveRound | null;
  answersByPlayerId: Record<string, PlayerAnswer>;
  roundReveal: RoundReveal | null;
  scoreboardByPlayerId: Record<string, PlayerScore>;
  finalRankingPlayerIds: string[];
}

const getLabelForPlayer = (
  playerId: string,
  playerLabelById: Record<string, string>,
): string => playerLabelById[playerId] ?? `Player ${playerId.slice(0, 4)}`;

const getRoundPrompt = (guessKind: RoundGuessKind): string => {
  return guessKind === "artist" ? "Who is the artist?" : "What song is this?";
};

const readQuizState = (
  stores: Record<string, Record<string, unknown>>,
): QuizState | null => {
  const candidate = stores[DEFAULT_STORE_DOMAIN];
  if (!candidate) {
    return null;
  }

  return candidate as unknown as QuizState;
};

const describeBucketSelection = (
  selectedBucketIds: readonly SongBucketId[],
  totalRounds: number,
) => {
  const uniqueSongCount = getUniqueSongCountForBuckets(selectedBucketIds);
  return {
    selectedBucketIds: [...selectedBucketIds],
    selectedBuckets: songBuckets.map((bucket) => ({
      id: bucket.id,
      label: bucket.label,
      selected: selectedBucketIds.includes(bucket.id),
      uniqueSongCount: getUniqueSongCountForBuckets([bucket.id]),
    })),
    uniqueSongCount,
    requiredSongCount: totalRounds,
    hasEnoughSongs: uniqueSongCount >= totalRounds,
  };
};

export const gameAgentContract = defineAirJamGameAgentContract({
  gameId: "last-band-standing",
  snapshotStoreDomains: [DEFAULT_STORE_DOMAIN],
  snapshotDescription:
    "Game-focused snapshot for Last Band Standing with lobby settings, player readiness, round prompts, answer options, reveal state, and scoreboard information.",
  projectSnapshot: ({ controllerId, stores }) => {
    const state = readQuizState(stores);
    if (!state) {
      return {
        phase: "unavailable",
        summary: "Default replicated game store is not available yet.",
      };
    }

    const bucketSelection = describeBucketSelection(
      state.selectedSongBucketIds,
      state.totalRounds,
    );
    const readyCount = state.playerOrder.filter(
      (playerId) => state.readyByPlayerId[playerId],
    ).length;
    const canStartMatch =
      state.phase === "lobby" &&
      state.playerOrder.length > 0 &&
      readyCount === state.playerOrder.length &&
      bucketSelection.hasEnoughSongs;

    const players = state.playerOrder.map((playerId) => {
      const score = state.scoreboardByPlayerId[playerId] ?? null;
      return {
        id: playerId,
        label: getLabelForPlayer(playerId, state.playerLabelById),
        ready: state.readyByPlayerId[playerId] ?? false,
        active: state.activePlayerIds.includes(playerId),
        rank:
          state.finalRankingPlayerIds.length > 0
            ? state.finalRankingPlayerIds.indexOf(playerId) + 1
            : null,
        score: score
          ? {
              points: score.points,
              correct: score.correct,
              wrong: score.wrong,
              answeredRounds: score.answeredRounds,
            }
          : null,
      };
    });

    const round =
      state.currentRound === null
        ? null
        : {
            roundNumber: state.currentRound.roundNumber,
            guessKind: state.currentRound.guessKind,
            prompt: getRoundPrompt(state.currentRound.guessKind),
            songId: state.currentRound.songId,
            expectedPlayerIds: [...state.currentRound.expectedPlayerIds],
            answeredPlayerIds: Object.keys(state.answersByPlayerId),
            myAnswer:
              controllerId && state.answersByPlayerId[controllerId]
                ? {
                    optionId: state.answersByPlayerId[controllerId].optionId,
                    answeredAtMs:
                      state.answersByPlayerId[controllerId].answeredAtMs,
                  }
                : null,
            options: state.currentRound.optionOrder.map((optionSongId) => {
              const optionSong = getSongById(optionSongId);
              return {
                id: optionSongId,
                label: optionSong
                  ? getRoundOptionLabel(
                      optionSong,
                      state.currentRound!.guessKind,
                    )
                  : optionSongId,
              };
            }),
          };

    const reveal =
      state.roundReveal === null
        ? null
        : {
            roundNumber: state.roundReveal.roundNumber,
            guessKind: state.roundReveal.guessKind,
            correctOptionId: state.roundReveal.correctOptionId,
            correctOptionLabel: state.roundReveal.correctOptionLabel,
            songTitle: state.roundReveal.songTitle,
            songArtist: state.roundReveal.songArtist,
            firstCorrectPlayerId: state.roundReveal.firstCorrectPlayerId,
            firstCorrectPlayerLabel: state.roundReveal.firstCorrectPlayerId
              ? getLabelForPlayer(
                  state.roundReveal.firstCorrectPlayerId,
                  state.playerLabelById,
                )
              : null,
            myResult:
              controllerId && state.roundReveal.resultsByPlayerId[controllerId]
                ? state.roundReveal.resultsByPlayerId[controllerId]
                : null,
          };

    return {
      phase: state.phase,
      players,
      lobby: {
        readyCount,
        playerCount: state.playerOrder.length,
        canStartMatch,
        settings: {
          totalRounds: state.totalRounds,
          roundDurationSec: state.roundDurationSec,
          revealDurationSec: state.revealDurationSec,
        },
        songBuckets: bucketSelection,
      },
      progress: {
        completedRoundCount: state.completedRoundCount,
        totalRounds: state.totalRounds,
        playedSongCount: state.playedSongKeys.length,
      },
      round,
      reveal,
      finalRankingPlayerIds: [...state.finalRankingPlayerIds],
      availableActions: [
        "set_ready",
        "toggle_song_bucket",
        "start_match",
        "submit_guess",
        "reset_lobby",
      ],
    };
  },
  actions: {
    set_ready: {
      target: {
        kind: "controller",
        actionName: "setReady",
        storeDomain: DEFAULT_STORE_DOMAIN,
      },
      description:
        "Mark the current controller as ready or unready in the lobby.",
      availability: "Lobby only. Requires a connected controller identity.",
      payload: {
        kind: "boolean",
        description: "Whether this controller should be ready.",
      },
      resolveInput: (input) => ({
        ready: Boolean(input),
      }),
      resultDescription:
        "The current controller's readiness updates in the lobby roster.",
    },
    toggle_song_bucket: {
      target: {
        kind: "controller",
        actionName: "toggleSongBucket",
        storeDomain: DEFAULT_STORE_DOMAIN,
      },
      description:
        "Toggle one song bucket on or off from the lobby settings carousel.",
      availability: "Lobby only.",
      payload: {
        kind: "enum",
        description: "The song bucket id to toggle.",
        allowedValues: [...defaultSelectedSongBucketIds],
      },
      resolveInput: (input) => ({
        bucketId: input,
      }),
      resultDescription: "The lobby song bucket selection updates immediately.",
    },
    start_match: {
      target: {
        kind: "controller",
        actionName: "startMatch",
        storeDomain: DEFAULT_STORE_DOMAIN,
      },
      description:
        "Start the match from the lobby once all active players are ready.",
      availability:
        "Lobby only. Controllers can start when they are ready and all ready checks pass.",
      payload: {
        kind: "none",
      },
      resultDescription:
        "The game enters match countdown and then progresses into the first round.",
    },
    submit_guess: {
      target: {
        kind: "controller",
        actionName: "submitGuess",
        storeDomain: DEFAULT_STORE_DOMAIN,
      },
      description:
        "Submit one answer option during an active round using an option id from the current snapshot.",
      availability:
        "Active round only. One submission per controller per round.",
      payload: {
        kind: "string",
        description:
          "The current round option id to submit. Read `round.options` from the game snapshot first.",
      },
      resolveInput: (input) => ({
        optionId: input,
      }),
      resultDescription:
        "The controller's answer is locked in for the current round.",
    },
    reset_lobby: {
      target: {
        kind: "controller",
        actionName: "resetLobby",
        storeDomain: DEFAULT_STORE_DOMAIN,
      },
      description:
        "Return the match to a clean lobby state without restarting dev.",
      availability: "Any phase.",
      payload: {
        kind: "none",
      },
      resultDescription:
        "The match returns to the lobby and clears current round progress.",
    },
  },
});

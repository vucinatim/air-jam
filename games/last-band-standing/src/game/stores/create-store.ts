import { createAirJamStore } from "@air-jam/sdk/core";
import {
  DEFAULT_REVEAL_DURATION_SEC,
  DEFAULT_ROUND_DURATION_SEC,
  DEFAULT_TOTAL_ROUNDS,
  MATCH_START_COUNTDOWN_SEC,
} from "../constants";
import {
  defaultSelectedSongBucketIds,
  getUniqueSongCountForBuckets,
  toggleSelectedSongBucketIds,
} from "../content/song-bank";
import { isMatchReadyToStart } from "../domain/match-readiness";
import { rankPlayers } from "../domain/round-engine";
import { buildPlayerLabelMap, filterRecordByPlayerIds } from "./player-helpers";
import {
  advanceRoundClock,
  appendPlayedSongKeys,
  createInitialScoreboard,
  createRound,
  finalizeRoundState,
  pickPlaylistGuessKinds,
  pickPlaylistSongs,
  resetLobbyState,
} from "./round-helpers";
import { type QuizState } from "./types";

export const gameStore = createAirJamStore<QuizState>((set) => ({
  phase: "lobby",
  playerOrder: [],
  playerLabelById: {},
  readyByPlayerId: {},

  totalRounds: DEFAULT_TOTAL_ROUNDS,
  roundDurationSec: DEFAULT_ROUND_DURATION_SEC,
  revealDurationSec: DEFAULT_REVEAL_DURATION_SEC,
  selectedSongBucketIds: defaultSelectedSongBucketIds,
  playedSongKeys: [],

  activePlayerIds: [],
  playlistSongIds: [],
  playlistGuessKinds: [],
  completedRoundCount: 0,
  currentRound: null,
  answersByPlayerId: {},
  roundReveal: null,
  scoreboardByPlayerId: {},
  finalRankingPlayerIds: [],
  secondsLeft: 0,

  actions: {
    setPlayers: ({ role }, { players }) => {
      if (role !== "host") {
        return;
      }

      set((state) => {
        const playerIds = players.map((player) => player.id);
        const incomingLabelById = buildPlayerLabelMap(players);

        const retainedOrder = state.playerOrder.filter((playerId) =>
          playerIds.includes(playerId),
        );
        const newPlayerIds = playerIds.filter(
          (playerId) => !retainedOrder.includes(playerId),
        );
        const nextPlayerOrder = [...retainedOrder, ...newPlayerIds];
        const nextPlayerLabelById = nextPlayerOrder.reduce<
          Record<string, string>
        >((nextLabels, playerId) => {
          nextLabels[playerId] =
            incomingLabelById[playerId] ?? `Player ${playerId.slice(0, 4)}`;
          return nextLabels;
        }, {});

        const nextReadyByPlayerId = nextPlayerOrder.reduce<
          Record<string, boolean>
        >((nextReady, playerId) => {
          nextReady[playerId] = state.readyByPlayerId[playerId] ?? false;
          return nextReady;
        }, {});

        if (state.phase === "lobby") {
          const hasSameOrder =
            state.playerOrder.length === nextPlayerOrder.length &&
            state.playerOrder.every(
              (playerId, index) => playerId === nextPlayerOrder[index],
            );
          const hasSameLabels = nextPlayerOrder.every(
            (playerId) =>
              state.playerLabelById[playerId] === nextPlayerLabelById[playerId],
          );

          if (hasSameOrder && hasSameLabels) {
            return state;
          }

          return {
            playerOrder: nextPlayerOrder,
            playerLabelById: nextPlayerLabelById,
            readyByPlayerId: nextReadyByPlayerId,
          };
        }

        const nextActivePlayerIds = state.activePlayerIds.filter((playerId) =>
          nextPlayerOrder.includes(playerId),
        );

        if (nextActivePlayerIds.length === 0) {
          return {
            playerOrder: nextPlayerOrder,
            playerLabelById: nextPlayerLabelById,
            ...resetLobbyState({
              ...state,
              playerOrder: nextPlayerOrder,
            }),
          };
        }

        return {
          playerOrder: nextPlayerOrder,
          playerLabelById: nextPlayerLabelById,
          readyByPlayerId: nextReadyByPlayerId,
          activePlayerIds: nextActivePlayerIds,
          answersByPlayerId: filterRecordByPlayerIds(
            state.answersByPlayerId,
            nextActivePlayerIds,
          ),
          scoreboardByPlayerId: filterRecordByPlayerIds(
            state.scoreboardByPlayerId,
            nextActivePlayerIds,
          ),
          finalRankingPlayerIds: state.finalRankingPlayerIds.filter(
            (playerId) => nextActivePlayerIds.includes(playerId),
          ),
          currentRound: state.currentRound
            ? {
                ...state.currentRound,
                expectedPlayerIds: state.currentRound.expectedPlayerIds.filter(
                  (playerId) => nextActivePlayerIds.includes(playerId),
                ),
              }
            : null,
          roundReveal: state.roundReveal
            ? {
                ...state.roundReveal,
                resultsByPlayerId: filterRecordByPlayerIds(
                  state.roundReveal.resultsByPlayerId,
                  nextActivePlayerIds,
                ),
              }
            : null,
        };
      });
    },

    setReady: ({ actorId }, { ready }) => {
      if (!actorId) {
        return;
      }

      set((state) => {
        if (state.phase !== "lobby") {
          return state;
        }

        return {
          readyByPlayerId: {
            ...state.readyByPlayerId,
            [actorId]: ready,
          },
        };
      });
    },

    toggleSongBucket: (_ctx, { bucketId }) => {
      set((state) => {
        if (state.phase !== "lobby") {
          return state;
        }

        return {
          selectedSongBucketIds: toggleSelectedSongBucketIds(
            state.selectedSongBucketIds,
            bucketId,
          ),
        };
      });
    },

    startMatch: ({ actorId, role, now }) => {
      set((state) => {
        if (
          role !== "host" &&
          (!actorId || state.readyByPlayerId[actorId] !== true)
        ) {
          return state;
        }

        if (
          !isMatchReadyToStart({
            phase: state.phase,
            playerIds: state.playerOrder,
            readyByPlayerId: state.readyByPlayerId,
            hasEnoughSongs:
              getUniqueSongCountForBuckets(state.selectedSongBucketIds) >=
              state.totalRounds,
          })
        ) {
          return state;
        }

        const activePlayerIds = [...state.playerOrder];

        const playlistSelection = pickPlaylistSongs(
          state.totalRounds,
          state.selectedSongBucketIds,
          state.playedSongKeys,
        );
        const playlistSongIds = playlistSelection.songIds;
        const playlistGuessKinds = pickPlaylistGuessKinds(state.totalRounds);
        const firstSongId = playlistSongIds[0];
        const firstGuessKind = playlistGuessKinds[0];

        if (
          playlistSelection.uniqueSongCount < state.totalRounds ||
          !firstSongId ||
          !firstGuessKind
        ) {
          return state;
        }

        const roundStartsAtMs = now + MATCH_START_COUNTDOWN_SEC * 1000;

        return {
          phase: "match-countdown",
          activePlayerIds,
          playlistSongIds,
          playlistGuessKinds,
          playedSongKeys: appendPlayedSongKeys(
            state.playedSongKeys,
            playlistSelection.songKeys,
          ),
          completedRoundCount: 0,
          currentRound: createRound({
            roundNumber: 1,
            songId: firstSongId,
            guessKind: firstGuessKind,
            expectedPlayerIds: activePlayerIds,
            nowMs: roundStartsAtMs,
            roundDurationSec: state.roundDurationSec,
          }),
          answersByPlayerId: {},
          roundReveal: null,
          scoreboardByPlayerId: createInitialScoreboard(activePlayerIds),
          finalRankingPlayerIds: [],
        };
      });
    },

    submitGuess: ({ actorId, now }, { optionId }) => {
      if (!actorId) {
        return;
      }

      set((state) => {
        if (state.phase !== "round-active" || !state.currentRound) {
          return state;
        }

        if (!state.currentRound.expectedPlayerIds.includes(actorId)) {
          return state;
        }

        if (state.answersByPlayerId[actorId]) {
          return state;
        }

        const isValidOption = state.currentRound.optionOrder.includes(optionId);
        if (!isValidOption) {
          return state;
        }

        return {
          answersByPlayerId: {
            ...state.answersByPlayerId,
            [actorId]: {
              optionId,
              answeredAtMs: now,
            },
          },
        };
      });
    },

    skipRound: ({ role }) => {
      if (role !== "host") {
        return;
      }

      set((state) =>
        state.currentRound
          ? finalizeRoundState(state, state.currentRound.endsAtMs)
          : state,
      );
    },

    advanceClock: ({ role, now }) => {
      if (role !== "host") {
        return;
      }

      set((state) => advanceRoundClock(state, now));
    },

    forceGameOver: ({ role }) => {
      if (role !== "host") {
        return;
      }

      set((state) => ({
        phase: "game-over",
        currentRound: null,
        roundReveal: null,
        finalRankingPlayerIds:
          state.finalRankingPlayerIds.length > 0
            ? state.finalRankingPlayerIds
            : rankPlayers(state.scoreboardByPlayerId),
      }));
    },

    resetLobby: ({ actorId, role }) => {
      if (role !== "host" && !actorId) {
        return;
      }

      set((state) => resetLobbyState(state));
    },
  },
}));

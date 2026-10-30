import { type AirJamActionContext } from "@air-jam/sdk/core";
import { type SongBucketId } from "../content/song-bank";
import { type PlayerScore } from "../domain/player-utils";
import {
  type PlayerAnswer,
  type RoundPlayerResult,
} from "../domain/round-engine";
import { type GamePhase, type RoundGuessKind } from "../domain/types";

export type { PlayerScore };

export interface ConnectedPlayer {
  id: string;
  label: string;
}

export interface ActiveRound {
  roundNumber: number;
  songId: string;
  clipStartSeconds: number;
  guessKind: RoundGuessKind;
  optionOrder: string[];
  startedAtMs: number;
  endsAtMs: number;
  expectedPlayerIds: string[];
}

export interface RoundReveal {
  roundNumber: number;
  songId: string;
  clipStartSeconds: number;
  songTitle: string;
  songArtist: string;
  guessKind: RoundGuessKind;
  correctOptionId: string;
  correctOptionLabel: string;
  firstCorrectPlayerId: string | null;
  firstCorrectResponseMs: number | null;
  resultsByPlayerId: Record<string, RoundPlayerResult>;
  revealEndsAtMs: number;
}

export interface QuizState {
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
  playlistSongIds: string[];
  playlistGuessKinds: RoundGuessKind[];
  completedRoundCount: number;
  currentRound: ActiveRound | null;
  answersByPlayerId: Record<string, PlayerAnswer>;
  roundReveal: RoundReveal | null;
  scoreboardByPlayerId: Record<string, PlayerScore>;
  finalRankingPlayerIds: string[];
  /** Whole seconds left in the current countdown, round or reveal, on game time. */
  secondsLeft: number;

  actions: {
    setPlayers: (
      ctx: AirJamActionContext,
      payload: { players: ConnectedPlayer[] },
    ) => void;
    setReady: (ctx: AirJamActionContext, payload: { ready: boolean }) => void;
    toggleSongBucket: (
      ctx: AirJamActionContext,
      payload: { bucketId: SongBucketId },
    ) => void;
    startMatch: (ctx: AirJamActionContext, _payload: undefined) => void;
    submitGuess: (
      ctx: AirJamActionContext,
      payload: { optionId: string },
    ) => void;
    skipRound: (ctx: AirJamActionContext, _payload: undefined) => void;
    /** Host only: applies what game time `ctx.now` makes due. */
    advanceClock: (ctx: AirJamActionContext, _payload: undefined) => void;
    forceGameOver: (ctx: AirJamActionContext, _payload: undefined) => void;
    resetLobby: (ctx: AirJamActionContext, _payload: undefined) => void;
  };
}

import { type SongBucketId } from "@/game/content/song-bank";
import { type PlayerScore } from "@/game/domain/player-utils";
import {
  type PlayerAnswer,
  type RoundPlayerResult,
} from "@/game/domain/round-engine";
import { type GamePhase, type RoundGuessKind } from "@/game/domain/types";
import { type AirJamActionContext } from "@air-jam/sdk";

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
    completeMatchCountdown: (
      ctx: AirJamActionContext,
      payload: { nowMs?: number },
    ) => void;
    submitGuess: (
      ctx: AirJamActionContext,
      payload: { optionId: string },
    ) => void;
    finalizeRound: (
      ctx: AirJamActionContext,
      payload: { nowMs?: number },
    ) => void;
    advanceFromReveal: (
      ctx: AirJamActionContext,
      payload: { nowMs?: number },
    ) => void;
    forceGameOver: (ctx: AirJamActionContext, _payload: undefined) => void;
    resetLobby: (ctx: AirJamActionContext, _payload: undefined) => void;
  };
}

import type { GamePhase } from "./types";

export const isMatchReadyToStart = ({
  phase,
  playerIds,
  readyByPlayerId,
  hasEnoughSongs,
}: {
  phase: GamePhase;
  playerIds: readonly string[];
  readyByPlayerId: Readonly<Record<string, boolean>>;
  hasEnoughSongs: boolean;
}): boolean =>
  phase === "lobby" &&
  playerIds.length > 0 &&
  playerIds.every((playerId) => readyByPlayerId[playerId] === true) &&
  hasEnoughSongs;

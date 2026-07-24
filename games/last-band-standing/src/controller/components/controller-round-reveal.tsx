import { NOW_TICK_MS } from "@/game/constants";
import { getRoundOptionLabel } from "@/game/content/round-options";
import { getSongById } from "@/game/content/song-bank";
import {
  formatResponseTime,
  getLabelForPlayer,
} from "@/game/domain/player-utils";
import { rankPlayers } from "@/game/domain/round-engine";
import { useNowTick } from "@/game/hooks/use-now-tick";
import { useGameStore } from "@/game/stores";
import { cn } from "@/game/ui/classes";
import { useAirJamController } from "@air-jam/sdk";
import { motion } from "framer-motion";

export const ControllerRoundReveal = () => {
  const nowMs = useNowTick(NOW_TICK_MS);
  const controllerId = useAirJamController((state) => state.controllerId);
  const roundReveal = useGameStore((state) => state.roundReveal);
  const playerLabelById = useGameStore((state) => state.playerLabelById);
  const scoreboardByPlayerId = useGameStore(
    (state) => state.scoreboardByPlayerId,
  );
  const myRoundResult =
    controllerId && roundReveal
      ? (roundReveal.resultsByPlayerId[controllerId] ?? null)
      : null;
  const revealCountdownSeconds = roundReveal
    ? Math.max(0, Math.ceil((roundReveal.revealEndsAtMs - nowMs) / 1000))
    : 0;

  if (!roundReveal) {
    return null;
  }

  const firstCorrectPlayerLabel = roundReveal.firstCorrectPlayerId
    ? getLabelForPlayer(roundReveal.firstCorrectPlayerId, playerLabelById)
    : null;
  const selectedSong = myRoundResult?.optionId
    ? getSongById(myRoundResult.optionId)
    : null;
  const selectedAnswerLabel = selectedSong
    ? getRoundOptionLabel(selectedSong, roundReveal.guessKind)
    : "No answer";
  const resultLabel = myRoundResult
    ? myRoundResult.isCorrect
      ? "Correct"
      : myRoundResult.responseMs === null
        ? "No answer"
        : "Incorrect"
    : "Spectating";
  const rankingPlayerIds = rankPlayers(scoreboardByPlayerId);

  return (
    <motion.div
      key="reveal"
      className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden px-3 py-3"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      <motion.div
        className="flex shrink-0 items-end justify-center gap-3"
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.1 }}
      >
        <span
          className={cn(
            "title text-4xl",
            myRoundResult?.isCorrect ? "text-primary" : "text-destructive",
          )}
        >
          +{myRoundResult?.points ?? 0}
        </span>
        <div className="pb-1">
          <p
            className={cn(
              "text-sm font-black tracking-[0.12em] uppercase",
              myRoundResult?.isCorrect ? "text-emerald-300" : "text-red-300",
            )}
          >
            {resultLabel}
          </p>
          <p className="text-muted-foreground text-xs">
            {myRoundResult?.responseMs === null ||
            myRoundResult?.responseMs === undefined
              ? "No response time"
              : formatResponseTime(myRoundResult.responseMs)}
          </p>
        </div>
      </motion.div>

      <div className="border-border/70 shrink-0 border-y py-3 text-center">
        <p className="text-muted-foreground text-[10px] font-bold tracking-[0.18em] uppercase">
          Round {roundReveal.roundNumber} — Correct answer
        </p>
        <h2 className="title mt-1.5 text-center text-[clamp(1.35rem,6vw,1.8rem)] leading-tight [overflow-wrap:anywhere]">
          {roundReveal.songArtist} — {roundReveal.songTitle}
        </h2>
        <p className="text-muted-foreground mt-1 text-xs leading-tight">
          Your answer:{" "}
          <span className="text-foreground font-bold">
            {selectedAnswerLabel}
          </span>
        </p>
      </div>

      <section
        className="flex min-h-0 w-full flex-1 flex-col"
        aria-label={`Rankings after round ${roundReveal.roundNumber}`}
      >
        <div
          className="text-muted-foreground grid min-h-7 shrink-0 grid-cols-[1.5rem_minmax(0,1fr)_3.75rem_3.25rem_3rem] items-center gap-1 border-b border-white/15 px-1 text-[9px] font-black tracking-[0.08em] uppercase"
          aria-hidden="true"
        >
          <span>#</span>
          <span>Player</span>
          <span className="text-center">Round</span>
          <span className="text-right">Time</span>
          <span className="text-right">Total</span>
        </div>

        <ol className="min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-contain [-webkit-overflow-scrolling:touch] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {rankingPlayerIds.map((playerId, index) => {
            const score = scoreboardByPlayerId[playerId];
            const result = roundReveal.resultsByPlayerId[playerId];
            if (!score || !result) return null;

            const resultMark =
              result.responseMs === null ? "—" : result.isCorrect ? "✓" : "×";

            return (
              <li
                key={playerId}
                className={cn(
                  "grid min-h-8 grid-cols-[1.5rem_minmax(0,1fr)_3.75rem_3.25rem_3rem] items-center gap-1 border-b border-white/10 px-1 text-xs tabular-nums",
                  playerId === controllerId && "bg-primary/10",
                )}
              >
                <span className="text-muted-foreground font-bold">
                  {index + 1}
                </span>
                <span className="truncate font-bold">
                  {getLabelForPlayer(playerId, playerLabelById)}
                </span>
                <span
                  className={cn(
                    "text-center font-black",
                    result.isCorrect && "text-emerald-300",
                    !result.isCorrect &&
                      result.responseMs !== null &&
                      "text-red-300",
                    result.responseMs === null && "text-muted-foreground",
                  )}
                >
                  {resultMark} +{result.points}
                </span>
                <span className="text-muted-foreground text-right">
                  {result.responseMs === null
                    ? "—"
                    : formatResponseTime(result.responseMs)}
                </span>
                <strong className="text-right">{score.points}</strong>
              </li>
            );
          })}
        </ol>
      </section>

      <div className="text-muted-foreground flex shrink-0 items-center justify-between gap-3 text-[11px]">
        <span className="min-w-0 truncate">
          Quickest:{" "}
          {roundReveal.firstCorrectResponseMs !== null &&
          firstCorrectPlayerLabel
            ? `${firstCorrectPlayerLabel} · ${formatResponseTime(
                roundReveal.firstCorrectResponseMs,
              )}`
            : "—"}
        </span>
        <span className="shrink-0">Next in {revealCountdownSeconds}s</span>
      </div>
    </motion.div>
  );
};

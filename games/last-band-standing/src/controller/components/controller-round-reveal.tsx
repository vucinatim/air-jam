import { NOW_TICK_MS } from "@/game/constants";
import { getRoundOptionLabel } from "@/game/content/round-options";
import { getSongById } from "@/game/content/song-bank";
import {
  formatResponseTime,
  getLabelForPlayer,
} from "@/game/domain/player-utils";
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

  return (
    <motion.div
      key="reveal"
      className="flex min-h-0 flex-1 flex-col items-center justify-center gap-5 px-5 py-4"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      <motion.div
        className="flex items-end justify-center gap-4"
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.1 }}
      >
        <span
          className={cn(
            "title text-5xl",
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

      <div className="border-border/70 w-full border-y py-5 text-center">
        <p className="text-muted-foreground text-[10px] font-bold tracking-[0.18em] uppercase">
          Round {roundReveal.roundNumber} — Correct answer
        </p>
        <h2 className="title mt-2 text-center text-[clamp(1.65rem,8vw,2.25rem)] leading-tight [overflow-wrap:anywhere]">
          {roundReveal.songArtist} — {roundReveal.songTitle}
        </h2>
      </div>

      <div className="grid w-full grid-cols-2 divide-x divide-white/10 text-center">
        <div className="min-w-0 px-2">
          <p className="text-muted-foreground text-[10px] font-bold tracking-[0.14em] uppercase">
            Your answer
          </p>
          <p className="mt-1 text-sm leading-tight font-bold break-words">
            {selectedAnswerLabel}
          </p>
        </div>
        <div className="min-w-0 px-2">
          <p className="text-muted-foreground text-[10px] font-bold tracking-[0.14em] uppercase">
            Quickest
          </p>
          <p className="mt-1 text-sm leading-tight font-bold break-words">
            {roundReveal.firstCorrectResponseMs !== null &&
            firstCorrectPlayerLabel
              ? `${firstCorrectPlayerLabel} · ${formatResponseTime(
                  roundReveal.firstCorrectResponseMs,
                )}`
              : "—"}
          </p>
        </div>
      </div>

      <p className="text-muted-foreground text-xs">
        Next round in {revealCountdownSeconds}s
      </p>
    </motion.div>
  );
};

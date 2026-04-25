import { NOW_TICK_MS } from "@/game/constants";
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

  return (
    <motion.div
      key="reveal"
      className="flex flex-1 flex-col items-center justify-center gap-5 px-5"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      {myRoundResult ? (
        <motion.div
          className="flex flex-col items-center gap-1"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.1 }}
        >
          <span
            className={cn(
              "title text-5xl",
              myRoundResult.isCorrect ? "text-primary" : "text-destructive",
            )}
          >
            {myRoundResult.isCorrect ? `+${myRoundResult.points}` : "+0"}
          </span>
        </motion.div>
      ) : (
        <p className="text-muted-foreground text-lg">No answer</p>
      )}

      <p className="text-muted-foreground text-xs tracking-widest uppercase">
        Round {roundReveal.roundNumber} — Answer
      </p>
      <h2 className="title text-center text-3xl leading-tight">
        {roundReveal.songArtist} - {roundReveal.songTitle}
      </h2>

      {roundReveal.firstCorrectResponseMs !== null &&
        firstCorrectPlayerLabel && (
          <p className="text-muted-foreground text-xs">
            Quickest: {firstCorrectPlayerLabel} in{" "}
            {formatResponseTime(roundReveal.firstCorrectResponseMs)}
          </p>
        )}

      <p className="text-muted-foreground text-xs">
        Next round in {revealCountdownSeconds}s
      </p>
    </motion.div>
  );
};

import { cn } from "@/lib/utils";
import { type RoundPlayerResult } from "@/round-engine";
import { type RoundReveal } from "@/store/types";
import { formatResponseTime, getLabelForPlayer } from "@/utils/player-utils";
import { motion } from "framer-motion";

interface ControllerRoundRevealProps {
  roundReveal: RoundReveal;
  myRoundResult: RoundPlayerResult | null;
  playerLabelById: Record<string, string>;
  revealCountdownSeconds: number;
}

export const ControllerRoundReveal = ({
  roundReveal,
  myRoundResult,
  playerLabelById,
  revealCountdownSeconds,
}: ControllerRoundRevealProps) => {
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

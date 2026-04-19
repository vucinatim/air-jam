import { getRoundPrompt, optionColors } from "@/features/round/round-prompt";
import { cn } from "@/lib/utils";
import { getRoundOptionLabel, getSongById } from "@/song-bank";
import { type ActiveRound } from "@/store/types";
import { motion } from "framer-motion";
import { useMemo } from "react";

interface ControllerRoundActiveProps {
  currentRound: ActiveRound;
  totalRounds: number;
  roundCountdownSeconds: number;
  isActivePlayer: boolean;
  selectedOptionId: string | null;
  onSubmitGuess: (optionId: string) => void;
}

export const ControllerRoundActive = ({
  currentRound,
  totalRounds,
  roundCountdownSeconds,
  isActivePlayer,
  selectedOptionId,
  onSubmitGuess,
}: ControllerRoundActiveProps) => {
  const orderedOptions = useMemo(() => {
    return currentRound.optionOrder.reduce<
      Array<{ id: string; label: string }>
    >((ordered, optionSongId) => {
      const optionSong = getSongById(optionSongId);
      if (optionSong) {
        ordered.push({
          id: optionSong.id,
          label: getRoundOptionLabel(optionSong, currentRound.guessKind),
        });
      }
      return ordered;
    }, []);
  }, [currentRound]);

  return (
    <motion.div
      key={`round-${currentRound.roundNumber}`}
      className="flex flex-1 flex-col"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
    >
      <div className="px-5 pb-2">
        <h2 className="title text-2xl">
          {getRoundPrompt(currentRound.guessKind)}
        </h2>
      </div>

      <div className="flex items-center justify-between px-5 py-3">
        <span className="text-muted-foreground text-xs">
          Round {currentRound.roundNumber}/{totalRounds}
        </span>
        <span
          className={cn(
            "text-lg font-bold tabular-nums",
            roundCountdownSeconds <= 5 ? "text-destructive" : "text-foreground",
          )}
        >
          {roundCountdownSeconds}
        </span>
      </div>

      {!isActivePlayer ? (
        <div className="flex flex-1 items-center justify-center px-5">
          <p className="text-muted-foreground text-lg">Spectating...</p>
        </div>
      ) : selectedOptionId ? (
        <div className="flex flex-1 items-center justify-center px-5">
          <motion.div
            className="flex flex-col items-center gap-2"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
          >
            <div className="bg-primary/20 flex h-16 w-16 items-center justify-center rounded-full">
              <span className="text-2xl">✓</span>
            </div>
            <p className="text-muted-foreground text-sm font-medium tracking-wider uppercase">
              Locked in
            </p>
          </motion.div>
        </div>
      ) : (
        <div className="grid flex-1 grid-cols-2 grid-rows-2 gap-2 px-3 pb-3">
          {orderedOptions.map((option, i) => (
            <motion.button
              key={option.id}
              type="button"
              onClick={() => onSubmitGuess(option.id)}
              className={cn(
                "flex items-center justify-center rounded-2xl p-3 text-center text-lg font-bold text-white transition-all active:scale-[0.96]",
                optionColors[i % optionColors.length],
              )}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              {option.label}
            </motion.button>
          ))}
        </div>
      )}
    </motion.div>
  );
};

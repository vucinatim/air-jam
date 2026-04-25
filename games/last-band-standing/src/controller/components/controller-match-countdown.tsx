import { NOW_TICK_MS } from "@/game/constants";
import { useNowTick } from "@/game/hooks/use-now-tick";
import { useGameStore } from "@/game/stores";
import { getRoundPrompt } from "@/game/ui/round-prompt";
import { motion } from "framer-motion";

export const ControllerMatchCountdown = () => {
  const nowMs = useNowTick(NOW_TICK_MS);
  const currentRound = useGameStore((state) => state.currentRound);
  const countdownSeconds = currentRound
    ? Math.max(0, Math.ceil((currentRound.startedAtMs - nowMs) / 1000))
    : 0;

  if (!currentRound) {
    return null;
  }

  return (
    <motion.div
      key="match-countdown"
      className="flex flex-1 flex-col items-center justify-center gap-5 px-5 text-center"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
    >
      <p className="text-muted-foreground text-xs tracking-widest uppercase">
        Round {currentRound.roundNumber}
      </p>
      <motion.div
        key={countdownSeconds}
        className="title text-primary text-8xl leading-none"
        initial={{ opacity: 0, scale: 0.75 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: "spring", stiffness: 320, damping: 18 }}
      >
        {countdownSeconds > 0 ? countdownSeconds : "Go!"}
      </motion.div>
      <p className="text-foreground text-xl font-bold">
        {getRoundPrompt(currentRound.guessKind)}
      </p>
    </motion.div>
  );
};

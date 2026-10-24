import { gameStore } from "@/game/stores";
import { getRoundPrompt } from "@/game/ui/round-prompt";
import { useAirJamStore } from "@air-jam/sdk";
import { motion } from "framer-motion";

export const ControllerMatchCountdown = () => {
  const secondsLeft = useAirJamStore(gameStore, (state) => state.secondsLeft);
  const currentRound = useAirJamStore(gameStore, (state) => state.currentRound);

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
        key={secondsLeft}
        className="title text-primary text-8xl leading-none"
        initial={{ opacity: 0, scale: 0.75 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: "spring", stiffness: 320, damping: 18 }}
      >
        {secondsLeft > 0 ? secondsLeft : "Go!"}
      </motion.div>
      <p className="text-foreground text-xl font-bold">
        {getRoundPrompt(currentRound.guessKind)}
      </p>
    </motion.div>
  );
};

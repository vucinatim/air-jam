import { NOW_TICK_MS } from "@/game/constants";
import { useNowTick } from "@/game/hooks/use-now-tick";
import { useGameStore } from "@/game/stores";
import { getRoundPrompt } from "@/game/ui/round-prompt";
import { motion } from "framer-motion";
import { HostPlayerStrip } from "./host-player-strip";

export const HostMatchCountdown = () => {
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
      className="absolute inset-0"
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.3 }}
    >
      <div className="flex h-full flex-col items-center justify-center gap-5 px-8 pb-28 text-center">
        <p className="text-muted-foreground text-sm tracking-[0.2em] uppercase">
          Round {currentRound.roundNumber}
        </p>
        <motion.div
          key={countdownSeconds}
          className="title text-primary text-[8rem] leading-none md:text-[11rem]"
          initial={{ opacity: 0, scale: 0.7 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "spring", stiffness: 320, damping: 18 }}
        >
          {countdownSeconds > 0 ? countdownSeconds : "Go!"}
        </motion.div>
        <p className="bg-background/45 rounded-full px-6 py-3 text-2xl font-bold backdrop-blur-md">
          {getRoundPrompt(currentRound.guessKind)}
        </p>
      </div>
      <HostPlayerStrip />
    </motion.div>
  );
};

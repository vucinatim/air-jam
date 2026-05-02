import { NOW_TICK_MS } from "@/game/constants";
import { useNowTick } from "@/game/hooks/use-now-tick";
import { useGameStore } from "@/game/stores";
import { motion } from "framer-motion";

export const HostTimerBar = () => {
  const nowMs = useNowTick(NOW_TICK_MS);
  const currentRound = useGameStore((state) => state.currentRound);
  const countdownFraction = currentRound
    ? Math.max(
        0,
        Math.min(
          1,
          (currentRound.endsAtMs - nowMs) /
            (currentRound.endsAtMs - currentRound.startedAtMs || 1),
        ),
      )
    : 0;

  return (
    <div className="bg-muted h-1 w-full shrink-0">
      <motion.div
        className="bg-primary h-full"
        animate={{ width: `${countdownFraction * 100}%` }}
        transition={{ duration: 0.25, ease: "linear" }}
      />
    </div>
  );
};

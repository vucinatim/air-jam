import { motion } from "framer-motion";

interface HostTimerBarProps {
  countdownFraction: number;
}

export const HostTimerBar = ({ countdownFraction }: HostTimerBarProps) => {
  return (
    <div className="h-1 w-full shrink-0 bg-muted">
      <motion.div
        className="h-full bg-primary"
        animate={{ width: `${countdownFraction * 100}%` }}
        transition={{ duration: 0.25, ease: "linear" }}
      />
    </div>
  );
};

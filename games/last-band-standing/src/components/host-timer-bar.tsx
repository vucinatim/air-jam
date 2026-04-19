import { motion } from "framer-motion";

interface HostTimerBarProps {
  countdownFraction: number;
}

export const HostTimerBar = ({ countdownFraction }: HostTimerBarProps) => {
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

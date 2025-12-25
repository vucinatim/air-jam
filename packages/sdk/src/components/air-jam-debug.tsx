import { Bug } from "lucide-react";
import type { JSX } from "react";
import { useEffect, useState } from "react";
import { DebugStateDialog } from "./debug-state-dialog";
import { Button } from "./ui/button";

interface AirJamDebugProps {
  state: unknown;
  title?: string;
  updateInterval?: number;
  className?: string;
}

/**
 * A debug component that displays state in a dialog.
 * Place this component anywhere in your React tree and pass the state you want to debug.
 *
 * @example
 * ```tsx
 * const { phase, scores } = useGameStore((state) => state);
 *
 * return (
 *   <div>
 *     <AirJamDebug state={{ phase, scores }} />
 *     {/* Your game UI *\/}
 *   </div>
 * );
 * ```
 */
export const AirJamDebug = ({
  state,
  title = "Debug State",
  updateInterval = 100,
  className,
}: AirJamDebugProps): JSX.Element => {
  const [isOpen, setIsOpen] = useState(false);
  const [currentState, setCurrentState] = useState(state);

  // Update state periodically when dialog is open
  useEffect(() => {
    if (!isOpen) return;

    const interval = setInterval(() => {
      setCurrentState(state);
    }, updateInterval);

    // Update immediately
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCurrentState(state);

    return () => clearInterval(interval);
  }, [isOpen, state, updateInterval]);

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={() => setIsOpen(true)}
        aria-label="Debug state"
        title={title}
        className={`text-white hover:bg-white/20 hover:text-white ${className || ""}`}
      >
        <Bug className="h-4 w-4" />
      </Button>

      <DebugStateDialog
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        getState={() => currentState}
        title={title}
        updateInterval={updateInterval}
      />
    </>
  );
};

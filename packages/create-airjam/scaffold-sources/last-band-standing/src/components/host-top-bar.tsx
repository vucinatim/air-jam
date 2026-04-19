import { FullLogo } from "@/assets/full-logo";
import { getRoundPrompt } from "@/features/round/round-prompt";
import { cn } from "@/lib/utils";
import { type ActiveRound, type RoundReveal } from "@/store/types";
import { type GamePhase } from "@/types";

interface HostTopBarProps {
  phase: GamePhase;
  currentRound: ActiveRound | null;
  roundReveal: RoundReveal | null;
  totalRounds: number;
  answeredCount: number;
  countdownSeconds: number;
  revealCountdownSeconds: number;
}

export const HostTopBar = ({
  phase,
  currentRound,
  roundReveal,
  totalRounds,
  answeredCount,
  countdownSeconds,
  revealCountdownSeconds,
}: HostTopBarProps) => {
  const isPlaying = phase === "round-active" || phase === "round-reveal";

  return (
    <header className="flex shrink-0 items-center justify-between gap-3 px-4 py-3 sm:px-5">
      <div className="flex min-w-0 flex-1 items-center gap-3 overflow-visible">
        <FullLogo size={160} className="text-foreground" />
      </div>

      {isPlaying && currentRound && (
        <div className="flex min-w-0 flex-1 items-center justify-center gap-6 text-center">
          <span className="text-muted-foreground text-sm">
            Round {currentRound.roundNumber}/{totalRounds}
          </span>
          <span className="text-muted-foreground text-sm tracking-wider uppercase">
            {getRoundPrompt(currentRound.guessKind)}
          </span>
        </div>
      )}
      <div className="flex min-w-0 flex-1 items-center justify-end">
        {phase === "round-active" && currentRound && (
          <div className="flex items-center gap-3">
            <span className="text-muted-foreground text-xs">
              {answeredCount}/{currentRound.expectedPlayerIds.length} answered
            </span>
            <span
              className={cn(
                "min-w-[2ch] text-right text-xl font-bold tabular-nums",
                countdownSeconds <= 5 ? "text-destructive" : "text-foreground",
              )}
            >
              {countdownSeconds}
            </span>
          </div>
        )}

        {phase === "round-reveal" && roundReveal && (
          <span className="text-muted-foreground text-sm">
            Next in {revealCountdownSeconds}s
          </span>
        )}
      </div>
    </header>
  );
};

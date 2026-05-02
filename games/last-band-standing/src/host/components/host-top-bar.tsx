import { NOW_TICK_MS } from "@/game/constants";
import { useNowTick } from "@/game/hooks/use-now-tick";
import { useGameStore } from "@/game/stores";
import { cn } from "@/game/ui/classes";
import { FullLogo } from "@/game/ui/full-logo";
import { getRoundPrompt } from "@/game/ui/round-prompt";

export const HostTopBar = () => {
  const nowMs = useNowTick(NOW_TICK_MS);
  const phase = useGameStore((state) => state.phase);
  const totalRounds = useGameStore((state) => state.totalRounds);
  const currentRound = useGameStore((state) => state.currentRound);
  const answersByPlayerId = useGameStore((state) => state.answersByPlayerId);
  const roundReveal = useGameStore((state) => state.roundReveal);
  const isPlaying =
    phase === "match-countdown" ||
    phase === "round-active" ||
    phase === "round-reveal";
  const answeredCount = currentRound
    ? currentRound.expectedPlayerIds.filter(
        (playerId) => answersByPlayerId[playerId],
      ).length
    : 0;
  const countdownSeconds = currentRound
    ? Math.max(0, Math.ceil((currentRound.endsAtMs - nowMs) / 1000))
    : 0;
  const revealCountdownSeconds = roundReveal
    ? Math.max(0, Math.ceil((roundReveal.revealEndsAtMs - nowMs) / 1000))
    : 0;
  const matchCountdownSeconds = currentRound
    ? Math.max(0, Math.ceil((currentRound.startedAtMs - nowMs) / 1000))
    : 0;

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

        {phase === "match-countdown" && currentRound && (
          <span className="text-muted-foreground text-sm">
            Starting in {matchCountdownSeconds}s
          </span>
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

import { gameStore } from "@/game/stores";
import { cn } from "@/game/ui/classes";
import { FullLogo } from "@/game/ui/full-logo";
import { getRoundPrompt } from "@/game/ui/round-prompt";
import { useAirJamStore } from "@air-jam/sdk";

export const HostTopBar = () => {
  const secondsLeft = useAirJamStore(gameStore, (state) => state.secondsLeft);
  const phase = useAirJamStore(gameStore, (state) => state.phase);
  const totalRounds = useAirJamStore(gameStore, (state) => state.totalRounds);
  const currentRound = useAirJamStore(gameStore, (state) => state.currentRound);
  const answersByPlayerId = useAirJamStore(
    gameStore,
    (state) => state.answersByPlayerId,
  );
  const roundReveal = useAirJamStore(gameStore, (state) => state.roundReveal);
  const isPlaying =
    phase === "match-countdown" ||
    phase === "round-active" ||
    phase === "round-reveal";
  const answeredCount = currentRound
    ? currentRound.expectedPlayerIds.filter(
        (playerId) => answersByPlayerId[playerId],
      ).length
    : 0;

  return (
    <header className="lbs-host-top-bar flex shrink-0 items-center justify-between gap-3 px-4 py-3 sm:px-5">
      <div className="flex min-w-0 flex-1 items-center gap-3 overflow-visible">
        <FullLogo className="lbs-host-top-bar-logo text-foreground" />
      </div>

      {isPlaying && currentRound && (
        <div className="lbs-host-round-meta flex min-w-0 flex-1 items-center justify-center gap-6 text-center">
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
          <div className="lbs-host-answer-status flex items-center gap-3">
            <span className="text-muted-foreground text-xs">
              {answeredCount}/{currentRound.expectedPlayerIds.length} answered
            </span>
            <span
              className={cn(
                "min-w-[2ch] text-right text-xl font-bold tabular-nums",
                secondsLeft <= 5 ? "text-destructive" : "text-foreground",
              )}
            >
              {secondsLeft}
            </span>
          </div>
        )}

        {phase === "match-countdown" && currentRound && (
          <span className="text-muted-foreground text-sm">
            Starting in {secondsLeft}s
          </span>
        )}

        {phase === "round-reveal" && roundReveal && (
          <span className="text-muted-foreground text-sm">
            Next in {secondsLeft}s
          </span>
        )}
      </div>
    </header>
  );
};

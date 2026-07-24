import {
  formatResponseTime,
  getLabelForPlayer,
} from "@/game/domain/player-utils";
import { rankPlayers } from "@/game/domain/round-engine";
import { useGameStore } from "@/game/stores";
import { cn } from "@/game/ui/classes";

export const HostRoundScoreboard = () => {
  const playerLabelById = useGameStore((state) => state.playerLabelById);
  const roundReveal = useGameStore((state) => state.roundReveal);
  const scoreboardByPlayerId = useGameStore(
    (state) => state.scoreboardByPlayerId,
  );

  if (!roundReveal) {
    return null;
  }

  const rankingPlayerIds = rankPlayers(scoreboardByPlayerId);

  return (
    <section
      className="lbs-reveal-scoreboard"
      aria-label={`Results after round ${roundReveal.roundNumber}`}
    >
      <div className="lbs-reveal-scoreboard-heading" aria-hidden="true">
        <span>Rank</span>
        <span>Player</span>
        <span>Result</span>
        <span>Time</span>
        <span>Round</span>
        <span>Total</span>
      </div>

      <ol className="lbs-reveal-scoreboard-rows">
        {rankingPlayerIds.map((playerId, index) => {
          const score = scoreboardByPlayerId[playerId];
          const result = roundReveal.resultsByPlayerId[playerId];
          if (!score || !result) return null;

          const resultLabel =
            result.responseMs === null
              ? "No answer"
              : result.isCorrect
                ? "Correct"
                : "Wrong";

          return (
            <li
              key={playerId}
              className="lbs-reveal-scoreboard-row"
              data-result={
                result.responseMs === null
                  ? "no-answer"
                  : result.isCorrect
                    ? "correct"
                    : "wrong"
              }
            >
              <span className="lbs-reveal-rank">#{index + 1}</span>
              <span className="lbs-reveal-player">
                {getLabelForPlayer(playerId, playerLabelById)}
              </span>
              <span
                className={cn(
                  "lbs-reveal-result",
                  result.isCorrect && "text-emerald-300",
                  !result.isCorrect &&
                    result.responseMs !== null &&
                    "text-red-300",
                )}
              >
                <span aria-hidden="true">
                  {result.responseMs === null
                    ? "—"
                    : result.isCorrect
                      ? "✓"
                      : "×"}
                </span>{" "}
                {resultLabel}
              </span>
              <span className="lbs-reveal-time">
                {result.responseMs === null
                  ? "—"
                  : formatResponseTime(result.responseMs)}
              </span>
              <span className="lbs-reveal-round-points">+{result.points}</span>
              <strong className="lbs-reveal-total">{score.points}</strong>
            </li>
          );
        })}
      </ol>
    </section>
  );
};

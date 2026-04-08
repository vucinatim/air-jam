import type { MatchSummary } from "../../game/stores";
import { getTeamColor } from "../../game/domain/team";
import { MatchScoreDisplay, TeamName } from "../../game/ui";
import { formatMatchDuration } from "../constants";

interface EndedPanelProps {
  matchSummary: MatchSummary | null;
}

export const EndedPanel = ({
  matchSummary,
}: EndedPanelProps) => {
  const winner = matchSummary?.winner;
  const winnerColor = winner ? getTeamColor(winner) : "#ffffff";

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 px-3 pb-4 pt-3">
      <div className="pong-panel rounded-[28px] px-5 py-6 text-center">
        <div className="pong-caption">
          Match Ended
        </div>
        <div
          className="mt-3 text-3xl font-black uppercase tracking-[0.14em]"
          style={{ color: winnerColor }}
        >
          {winner ? <TeamName team={winner} uppercase={false} suffix="Wins" /> : "Winner"}
        </div>
        {matchSummary ? (
          <MatchScoreDisplay
            scores={matchSummary.finalScores}
            className="mt-4 text-5xl font-black text-white"
            separatorClassName="px-3 text-zinc-500"
          />
        ) : (
          <div className="mt-4 text-5xl font-black text-white">0:0</div>
        )}
        <div className="mt-3 text-[11px] uppercase tracking-[0.16em] text-zinc-400">
          {matchSummary
            ? `First to ${matchSummary.pointsToWin} • ${formatMatchDuration(matchSummary.durationMs)}`
            : "Match summary unavailable"}
        </div>
      </div>

    </div>
  );
};

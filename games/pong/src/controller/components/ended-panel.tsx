import type { MatchSummary } from "../../game/stores";
import { getTeamColor } from "../../game/domain/team";
import { MatchScoreDisplay, TeamName } from "../../game/ui";
import { formatMatchDuration, PRESS_FEEL_CLASS } from "../constants";

interface EndedPanelProps {
  matchSummary: MatchSummary | null;
  canSendSystemCommand: boolean;
  onRestartMatch: () => void;
  onReturnToLobby: () => void;
}

export const EndedPanel = ({
  matchSummary,
  canSendSystemCommand,
  onRestartMatch,
  onReturnToLobby,
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

      <button
        type="button"
        className={`rounded-[24px] border border-white/16 bg-white px-4 py-4 text-sm font-black uppercase tracking-[0.18em] text-black shadow-[0_18px_40px_rgba(255,255,255,0.14)] disabled:cursor-not-allowed disabled:opacity-50 ${PRESS_FEEL_CLASS}`}
        disabled={!canSendSystemCommand}
        onClick={onRestartMatch}
      >
        Play Again
      </button>

      <button
        type="button"
        className={`rounded-[24px] border border-white/12 bg-white/6 px-4 py-4 text-sm font-semibold uppercase tracking-[0.18em] text-zinc-100 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50 ${PRESS_FEEL_CLASS}`}
        disabled={!canSendSystemCommand}
        onClick={onReturnToLobby}
      >
        Back to Lobby
      </button>
    </div>
  );
};

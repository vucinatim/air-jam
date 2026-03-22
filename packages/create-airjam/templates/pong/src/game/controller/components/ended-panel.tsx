import type { MatchSummary } from "../../store";
import { getTeamColor, getTeamLabel } from "../../shared/team";
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
  const winnerLabel = winner ? `${getTeamLabel(winner)} Wins` : "Winner";
  const winnerColor = winner ? getTeamColor(winner) : "#ffffff";

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 p-2">
      <div className="rounded-lg border border-white/10 bg-zinc-900/80 p-4 text-center">
        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-400">
          Match Ended
        </div>
        <div
          className="mt-2 text-2xl font-black uppercase"
          style={{ color: winnerColor }}
        >
          {winnerLabel}
        </div>
        <div className="mt-2 text-4xl font-black text-white">
          {matchSummary ? (
            <>
              <span style={{ color: getTeamColor("team1") }}>
                {matchSummary.finalScores.team1}
              </span>
              <span className="px-2 text-zinc-500">:</span>
              <span style={{ color: getTeamColor("team2") }}>
                {matchSummary.finalScores.team2}
              </span>
            </>
          ) : (
            "0:0"
          )}
        </div>
        <div className="mt-2 text-[11px] uppercase tracking-[0.14em] text-zinc-400">
          {matchSummary
            ? `First to ${matchSummary.pointsToWin} • ${formatMatchDuration(matchSummary.durationMs)}`
            : "Match summary unavailable"}
        </div>
      </div>

      <button
        type="button"
        className={`rounded-lg border border-white/20 bg-white/10 px-4 py-3 text-sm font-semibold uppercase tracking-wide text-white hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-50 ${PRESS_FEEL_CLASS}`}
        disabled={!canSendSystemCommand}
        onClick={onRestartMatch}
      >
        Play Again
      </button>

      <button
        type="button"
        className={`rounded-lg border border-white/20 bg-zinc-800 px-4 py-3 text-sm font-semibold uppercase tracking-wide text-zinc-100 hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50 ${PRESS_FEEL_CLASS}`}
        disabled={!canSendSystemCommand}
        onClick={onReturnToLobby}
      >
        Back to Lobby
      </button>
    </div>
  );
};

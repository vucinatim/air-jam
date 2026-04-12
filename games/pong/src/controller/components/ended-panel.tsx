import { LifecycleActionGroup } from "@air-jam/sdk/ui";
import { getTeamColor } from "../../game/domain/team";
import type { MatchSummary } from "../../game/stores";
import { MatchScoreDisplay, TeamName } from "../../game/ui";
import { formatMatchDuration } from "../constants";

interface EndedPanelProps {
  matchSummary: MatchSummary | null;
  runtimeState?: "playing" | "paused";
  onBackToLobby: () => void;
  onRestart: () => void;
}

export const EndedPanel = ({
  matchSummary,
  runtimeState,
  onBackToLobby,
  onRestart,
}: EndedPanelProps) => {
  const winner = matchSummary?.winner;
  const winnerColor = winner ? getTeamColor(winner) : "#ffffff";

  return (
    <div className="flex min-h-0 flex-1 flex-col px-3 pt-4 pb-4 sm:pt-5">
      <div className="pong-panel mx-auto w-full max-w-md rounded-[28px] px-4 py-5 text-center sm:px-5 sm:py-6">
        <div className="pong-caption">Match Ended</div>
        <div
          className="mt-2.5 text-[clamp(2rem,8vw,2.75rem)] leading-none font-black tracking-[0.1em] uppercase"
          style={{ color: winnerColor }}
        >
          {winner ? (
            <TeamName team={winner} uppercase={false} suffix="Wins" />
          ) : (
            "Winner"
          )}
        </div>
        {matchSummary ? (
          <MatchScoreDisplay
            scores={matchSummary.finalScores}
            className="mt-3 text-[clamp(3.5rem,14vw,4.5rem)] leading-none font-black text-white"
            separatorClassName="px-2.5 text-zinc-500"
          />
        ) : (
          <div className="mt-3 text-[clamp(3.5rem,14vw,4.5rem)] leading-none font-black text-white">
            0:0
          </div>
        )}
        <div className="mt-2.5 text-[11px] tracking-[0.14em] text-zinc-400 uppercase">
          {matchSummary
            ? `First to ${matchSummary.pointsToWin} • ${formatMatchDuration(matchSummary.durationMs)}`
            : "Match summary unavailable"}
        </div>
        <LifecycleActionGroup
          phase="ended"
          runtimeState={runtimeState}
          canInteract
          onBackToLobby={onBackToLobby}
          onRestart={onRestart}
          presentation="pill"
          visibleKinds={["back-to-lobby", "restart"]}
          className="mt-4 w-full flex-col items-stretch gap-2"
          buttonClassName="h-11 w-full justify-center rounded-full px-4 text-[0.6875rem] font-semibold tracking-[0.16em] uppercase"
        />
      </div>
    </div>
  );
};

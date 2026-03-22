import type { PlayerProfile } from "@air-jam/sdk/protocol";
import { PlayerAvatar } from "@air-jam/sdk/ui";
import { getTeamColor, getTeamLabel } from "../../shared/team";
import type { MatchSummary } from "../../store";

interface EndedScreenProps {
  roomId: string | null;
  matchSummary: MatchSummary | null;
  team1Players: PlayerProfile[];
  team2Players: PlayerProfile[];
}

const formatDuration = (durationMs: number): string => {
  const totalSeconds = Math.floor(durationMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
};

export const EndedScreen = ({
  roomId,
  matchSummary,
  team1Players,
  team2Players,
}: EndedScreenProps) => {
  const winner = matchSummary?.winner;
  const winnerLabel = winner ? `${getTeamLabel(winner)} Wins` : "Match Ended";
  const winnerColor = winner ? getTeamColor(winner) : "#ffffff";

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-zinc-950 px-6 py-10 text-white">
      <div className="flex w-full max-w-4xl flex-col items-center gap-7 text-center">
        <div className="space-y-1">
          <div className="text-xs tracking-[0.22em] text-zinc-500 uppercase">
            Match Ended
          </div>
          <h1
            className="text-5xl font-black tracking-tight uppercase"
            style={{ color: winnerColor }}
          >
            {winnerLabel}
          </h1>
          <div className="text-xl font-bold tracking-[0.2em] text-zinc-200 uppercase">
            {roomId ?? "----"}
          </div>
        </div>

        <div className="text-6xl font-black tracking-tight text-white">
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

        <div className="grid w-full max-w-3xl grid-cols-2 gap-3">
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/3 p-4">
            <div
              className="text-xl font-black tracking-wide uppercase"
              style={{ color: getTeamColor("team1") }}
            >
              {getTeamLabel("team1")}
            </div>
            <div className="flex min-h-8 items-center justify-center gap-2">
              {team1Players.length > 0 ? (
                team1Players.map((player) => (
                  <PlayerAvatar
                    key={player.id}
                    player={player}
                    size="sm"
                    className="h-7 w-7 border-2"
                  />
                ))
              ) : (
                <span className="text-xs tracking-wide text-zinc-600 uppercase">
                  No Players
                </span>
              )}
            </div>
          </div>
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/3 p-4">
            <div
              className="text-xl font-black tracking-wide uppercase"
              style={{ color: getTeamColor("team2") }}
            >
              {getTeamLabel("team2")}
            </div>
            <div className="flex min-h-8 items-center justify-center gap-2">
              {team2Players.length > 0 ? (
                team2Players.map((player) => (
                  <PlayerAvatar
                    key={player.id}
                    player={player}
                    size="sm"
                    className="h-7 w-7 border-2"
                  />
                ))
              ) : (
                <span className="text-xs tracking-wide text-zinc-600 uppercase">
                  No Players
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="text-xs tracking-[0.14em] text-zinc-400 uppercase">
          {matchSummary
            ? `First to ${matchSummary.pointsToWin}. Duration ${formatDuration(matchSummary.durationMs)}.`
            : "Match complete."}
        </div>
        <div className="text-xs tracking-[0.14em] text-zinc-500 uppercase">
          Restart or return to lobby from controller.
        </div>
      </div>
    </div>
  );
};

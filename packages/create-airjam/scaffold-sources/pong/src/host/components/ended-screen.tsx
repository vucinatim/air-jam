import type { PlayerProfile } from "@air-jam/sdk/protocol";
import { PlayerAvatar } from "@air-jam/sdk/ui";
import { getTeamColor, type TeamId } from "../../game/domain/team";
import { buildTeamSlots, type BotCounts } from "../../game/domain/team-slots";
import type { MatchSummary } from "../../game/stores";
import { MatchScoreDisplay, TeamName } from "../../game/ui";

interface EndedScreenProps {
  roomId: string | null;
  matchSummary: MatchSummary | null;
  team1Players: PlayerProfile[];
  team2Players: PlayerProfile[];
  botCounts: BotCounts;
}

const buildBotAvatarPlayer = (team: TeamId, index: number): PlayerProfile => ({
  id: `bot-${team}-${index}`,
  label: `Bot ${index + 1}`,
  color: getTeamColor(team),
});

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
  botCounts,
}: EndedScreenProps) => {
  const winner = matchSummary?.winner;
  const winnerColor = winner ? getTeamColor(winner) : "#ffffff";
  const team1Slots = buildTeamSlots(team1Players, botCounts.team1);
  const team2Slots = buildTeamSlots(team2Players, botCounts.team2);

  return (
    <div className="pong-app-shell flex h-full min-h-0 w-full items-center justify-center px-4 py-6 text-white sm:px-6 sm:py-8">
      <div className="grid w-full max-w-6xl gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <section className="pong-panel-strong flex flex-col justify-between rounded-[34px] px-6 py-7 text-center sm:px-8 sm:text-left">
          <div className="space-y-3">
            <div className="pong-caption">Match Ended</div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <div
                  className="text-5xl font-black tracking-widest uppercase sm:text-6xl"
                  style={{ color: winnerColor }}
                >
                  {winner ? (
                    <TeamName team={winner} uppercase={false} suffix="Wins" />
                  ) : (
                    "Match Ended"
                  )}
                </div>
                <div className="mt-2 text-sm tracking-[0.2em] text-zinc-400 uppercase">
                  Room {roomId ?? "----"}
                </div>
              </div>
              <div className="pong-status-pill self-center sm:self-auto">
                {matchSummary
                  ? `First To ${matchSummary.pointsToWin}`
                  : "Match Complete"}
              </div>
            </div>
          </div>

          <div className="mt-8 grid gap-4 lg:grid-cols-2">
            <div className="pong-panel flex h-full flex-col items-center justify-center gap-3 rounded-[28px] p-5">
              <TeamName
                team="team1"
                className="text-xl font-black tracking-[0.14em]"
              />
              <div className="flex min-h-8 items-center justify-center gap-2">
                {team1Slots.some((slot) => slot.kind !== "open") ? (
                  team1Slots.map((slot, index) =>
                    slot.kind === "human" ? (
                      <PlayerAvatar
                        key={slot.player.id}
                        player={slot.player}
                        size="sm"
                        className="h-8 w-8 border-2"
                      />
                    ) : slot.kind === "bot" ? (
                      <PlayerAvatar
                        key={`team1-bot-${index}`}
                        player={buildBotAvatarPlayer("team1", index)}
                        isBot
                        size="sm"
                        className="h-8 w-8 border-2"
                      />
                    ) : null,
                  )
                ) : (
                  <span className="text-xs tracking-[0.18em] text-zinc-500 uppercase">
                    No Players
                  </span>
                )}
              </div>
            </div>
            <div className="pong-panel flex h-full flex-col items-center justify-center gap-3 rounded-[28px] p-5">
              <TeamName
                team="team2"
                className="text-xl font-black tracking-[0.14em]"
              />
              <div className="flex min-h-8 items-center justify-center gap-2">
                {team2Slots.some((slot) => slot.kind !== "open") ? (
                  team2Slots.map((slot, index) =>
                    slot.kind === "human" ? (
                      <PlayerAvatar
                        key={slot.player.id}
                        player={slot.player}
                        size="sm"
                        className="h-8 w-8 border-2"
                      />
                    ) : slot.kind === "bot" ? (
                      <PlayerAvatar
                        key={`team2-bot-${index}`}
                        player={buildBotAvatarPlayer("team2", index)}
                        isBot
                        size="sm"
                        className="h-8 w-8 border-2"
                      />
                    ) : null,
                  )
                ) : (
                  <span className="text-xs tracking-[0.18em] text-zinc-500 uppercase">
                    No Players
                  </span>
                )}
              </div>
            </div>
          </div>
        </section>

        <section className="pong-panel flex flex-col items-center justify-center rounded-[34px] px-6 py-7 text-center sm:px-8">
          <div className="pong-caption">Final Score</div>
          {matchSummary ? (
            <MatchScoreDisplay
              scores={matchSummary.finalScores}
              className="mt-4 text-7xl font-black tracking-tight text-white"
              separatorClassName="px-3 text-zinc-500"
            />
          ) : (
            <div className="mt-4 text-7xl font-black tracking-tight text-white">
              0:0
            </div>
          )}
          <div className="mt-5 max-w-sm text-sm leading-6 text-slate-300">
            {matchSummary
              ? `Duration ${formatDuration(matchSummary.durationMs)}. Restart or return to lobby from controller.`
              : "Match complete."}
          </div>
        </section>
      </div>
    </div>
  );
};

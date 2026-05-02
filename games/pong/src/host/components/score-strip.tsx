import type { PlayerProfile } from "@air-jam/sdk/protocol";
import { PlayerAvatar } from "@air-jam/sdk/ui";
import { getTeamColor, type TeamId } from "../../game/domain/team";
import { usePongStore } from "../../game/stores";
import { MatchScoreDisplay, TeamName } from "../../game/ui";
import { usePongHostTeams } from "../hooks/use-pong-host-teams";

const buildBotAvatarPlayer = (team: TeamId, index: number): PlayerProfile => ({
  id: `bot-${team}-${index}`,
  label: `Bot ${index + 1}`,
  color: getTeamColor(team),
});

export const ScoreStrip = () => {
  const scores = usePongStore((state) => state.scores);
  const { botCounts, pointsToWin, team1Players, team2Players } =
    usePongHostTeams();

  return (
    <div
      className="pong-panel mx-auto mt-4 flex w-full max-w-5xl items-center gap-3 rounded-[28px] px-4 py-3 sm:mt-6 sm:px-5"
      data-testid="pong-host-score-strip"
    >
      <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
        <div className="hidden text-right sm:block">
          <div className="pong-caption">
            <TeamName team="team1" uppercase={false} />
          </div>
          <div className="text-[0.7rem] tracking-[0.18em] text-orange-200/72 uppercase">
            Left Court
          </div>
        </div>

        {Array.from({ length: botCounts.team1 }, (_, index) => (
          <PlayerAvatar
            key={`team1-bot-${index}`}
            player={buildBotAvatarPlayer("team1", index)}
            isBot
            size="sm"
            className="h-7 w-7 border-2"
          />
        ))}
        {team1Players.map((player) => (
          <PlayerAvatar
            key={player.id}
            player={player}
            size="sm"
            className="h-7 w-7 border-2"
          />
        ))}
      </div>

      <div className="flex shrink-0 flex-col items-center px-1">
        <div className="pong-caption">First to {pointsToWin}</div>
        <MatchScoreDisplay
          scores={scores}
          className="flex items-center gap-2 text-3xl font-black tracking-[0.08em] sm:text-4xl"
          scoreClassName=""
          separator="-"
          separatorClassName="text-white/72"
        />
      </div>

      <div className="flex min-w-0 flex-1 items-center gap-2">
        {Array.from({ length: botCounts.team2 }, (_, index) => (
          <PlayerAvatar
            key={`team2-bot-${index}`}
            player={buildBotAvatarPlayer("team2", index)}
            isBot
            size="sm"
            className="h-7 w-7 border-2"
          />
        ))}
        {team2Players.map((player) => (
          <PlayerAvatar
            key={player.id}
            player={player}
            size="sm"
            className="h-7 w-7 border-2"
          />
        ))}
        <div className="hidden sm:block">
          <div className="pong-caption">
            <TeamName team="team2" uppercase={false} />
          </div>
          <div className="text-[0.7rem] tracking-[0.18em] text-cyan-200/72 uppercase">
            Right Court
          </div>
        </div>
      </div>
    </div>
  );
};

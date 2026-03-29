import { PlayerAvatar } from "@air-jam/sdk/ui";
import type { PlayerProfile } from "@air-jam/sdk/protocol";
import { MatchScoreDisplay, TeamName } from "../../game/ui";
import type { BotCounts } from "../../game/domain/team-slots";

interface ScoreStripProps {
  team1Players: PlayerProfile[];
  team2Players: PlayerProfile[];
  botCounts: BotCounts;
  pointsToWin: number;
  scores: { team1: number; team2: number };
}

export const ScoreStrip = ({
  team1Players,
  team2Players,
  botCounts,
  pointsToWin,
  scores,
}: ScoreStripProps) => {
  return (
    <div className="pong-panel mx-auto mt-4 flex w-full max-w-5xl items-center gap-3 rounded-[28px] px-4 py-3 sm:mt-6 sm:px-5">
      <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
        <div className="hidden text-right sm:block">
          <div className="pong-caption">
            <TeamName team="team1" uppercase={false} />
          </div>
          <div className="text-[0.7rem] uppercase tracking-[0.18em] text-orange-200/72">
            Left Court
          </div>
        </div>

        {botCounts.team1 > 0 ? (
          <span className="rounded-full border border-orange-400/50 bg-orange-400/15 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-orange-200">
            {botCounts.team1} BOT
          </span>
        ) : null}
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
        <div className="pong-caption">
          First to {pointsToWin}
        </div>
        <MatchScoreDisplay
          scores={scores}
          className="flex items-center gap-2 text-3xl font-black tracking-[0.08em] sm:text-4xl"
          scoreClassName=""
          separator="-"
          separatorClassName="text-white/72"
        />
      </div>

      <div className="flex min-w-0 flex-1 items-center gap-2">
        {botCounts.team2 > 0 ? (
          <span className="rounded-full border border-cyan-400/50 bg-cyan-400/15 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-cyan-200">
            {botCounts.team2} BOT
          </span>
        ) : null}
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
          <div className="text-[0.7rem] uppercase tracking-[0.18em] text-cyan-200/72">
            Right Court
          </div>
        </div>
      </div>
    </div>
  );
};

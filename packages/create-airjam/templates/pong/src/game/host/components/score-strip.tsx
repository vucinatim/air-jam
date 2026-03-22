import { PlayerAvatar } from "@air-jam/sdk/ui";
import type { PlayerProfile } from "@air-jam/sdk/protocol";
import { getTeamColor } from "../../shared/team";

interface ScoreStripProps {
  team1Players: PlayerProfile[];
  team2Players: PlayerProfile[];
  botTeam: "team1" | "team2" | null;
  pointsToWin: number;
  scores: { team1: number; team2: number };
}

export const ScoreStrip = ({
  team1Players,
  team2Players,
  botTeam,
  pointsToWin,
  scores,
}: ScoreStripProps) => {
  const team1IsBot = botTeam === "team1";
  const team2IsBot = botTeam === "team2";

  return (
    <div className="mb-4 flex w-full max-w-4xl items-center gap-4 pt-12">
      <div className="flex-1" />

      <div className="flex w-20 items-center justify-end gap-2">
        {team1IsBot && team1Players.length === 0 ? (
          <span className="rounded-full border border-orange-400/50 bg-orange-400/15 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-orange-200">
            BOT
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

      <div className="flex flex-col items-center">
        <div className="text-[10px] uppercase tracking-[0.14em] text-zinc-400">
          First to {pointsToWin}
        </div>
        <div className="flex items-center gap-2 text-2xl font-bold">
          <span style={{ color: getTeamColor("team1") }}>{scores.team1}</span>
          <span className="text-white">-</span>
          <span style={{ color: getTeamColor("team2") }}>{scores.team2}</span>
        </div>
      </div>

      <div className="flex w-24 items-center gap-2">
        {team2IsBot && team2Players.length === 0 ? (
          <span className="rounded-full border border-cyan-400/50 bg-cyan-400/15 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-cyan-200">
            BOT
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
      </div>

      <div className="flex-1" />
    </div>
  );
};

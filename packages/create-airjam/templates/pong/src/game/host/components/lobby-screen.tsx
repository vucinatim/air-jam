import type { PlayerProfile } from "@air-jam/sdk/protocol";
import { PlayerAvatar, RoomQrCode } from "@air-jam/sdk/ui";
import {
  getLobbyReadinessText,
  type TeamCounts,
} from "../../shared/match-readiness";
import {
  getTeamColor,
  getTeamLabel,
  type TeamId,
} from "../../shared/team";

interface LobbyScreenProps {
  joinQrValue: string;
  roomId: string | null;
  botTeam: "team1" | "team2" | null;
  pointsToWin: number;
  connectedPlayers: PlayerProfile[];
  team1Players: PlayerProfile[];
  team2Players: PlayerProfile[];
}

interface TeamCardProps {
  team: TeamId;
  count: number;
  players: PlayerProfile[];
  isBot: boolean;
}

const TeamCard = ({ team, count, players, isBot }: TeamCardProps) => (
  <div className="flex h-full w-full flex-col items-center justify-center gap-3 rounded-xl border border-white/10 bg-white/3 p-4">
    <div
      className="text-2xl font-black tracking-wide uppercase"
      style={{ color: getTeamColor(team) }}
    >
      {isBot ? `${getTeamLabel(team)} Bot` : getTeamLabel(team)}
    </div>
    <div className="flex min-h-8 items-center justify-center gap-2">
      {isBot && players.length === 0 ? (
        <span className="rounded-full border border-white/20 px-2 py-0.5 text-[10px] font-bold tracking-wide text-white/90 uppercase">
          Bot
        </span>
      ) : players.length > 0 ? (
        players.map((player) => (
          <PlayerAvatar
            key={player.id}
            player={player}
            size="sm"
            className="h-7 w-7 border-2"
          />
        ))
      ) : (
        <span className="text-xs tracking-wide text-zinc-600 uppercase">
          Empty
        </span>
      )}
    </div>
    <div className="text-sm font-bold tracking-wide text-zinc-300 uppercase">
      {isBot ? "BOT" : count}
    </div>
  </div>
);

export const LobbyScreen = ({
  joinQrValue,
  roomId,
  botTeam,
  pointsToWin,
  connectedPlayers,
  team1Players,
  team2Players,
}: LobbyScreenProps) => {
  const teamCounts: TeamCounts = {
    team1: team1Players.length,
    team2: team2Players.length,
  };
  const team1IsBot = botTeam === "team1";
  const team2IsBot = botTeam === "team2";
  const readinessText = getLobbyReadinessText(
    teamCounts,
    botTeam,
    pointsToWin,
    "host",
  );

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-zinc-950 px-6 py-10 text-white">
      <div className="flex w-full max-w-4xl flex-col items-center gap-7 text-center">
        <div className="space-y-1">
          <div className="text-xs tracking-[0.22em] text-zinc-500 uppercase">
            Pong Lobby
          </div>
          <h1 className="text-5xl font-black tracking-tight uppercase">
            Join Room
          </h1>
          <div className="text-xl font-bold tracking-[0.2em] text-zinc-200 uppercase">
            {roomId ?? "----"}
          </div>
          <div className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">
            Scan to join, choose a side, and start from phone
          </div>
        </div>

        <RoomQrCode
          value={joinQrValue}
          size={220}
          className="rounded-md bg-white"
          alt="Join this Pong room"
        />

        <div className="text-xs tracking-[0.14em] text-zinc-400 uppercase">
          {readinessText}
        </div>

        <div className="grid w-full max-w-3xl grid-cols-2 gap-3">
          <TeamCard
            team="team1"
            count={teamCounts.team1}
            players={team1Players}
            isBot={team1IsBot}
          />
          <TeamCard
            team="team2"
            count={teamCounts.team2}
            players={team2Players}
            isBot={team2IsBot}
          />
        </div>

        <div className="flex min-h-9 flex-col items-center justify-center gap-3">
          <div className="text-[10px] font-semibold tracking-[0.18em] text-zinc-500 uppercase">
            Connected
          </div>
          {connectedPlayers.length > 0 ? (
            <div className="flex items-center justify-center gap-2">
              {connectedPlayers.map((player) => (
                <PlayerAvatar
                  key={player.id}
                  player={player}
                  size="sm"
                  className="h-7 w-7 border-2"
                />
              ))}
            </div>
          ) : (
            <span className="text-xs tracking-wide text-zinc-600 uppercase">
              Waiting for players
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

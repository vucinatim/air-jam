import type { PlayerProfile } from "@air-jam/sdk/protocol";
import { PlayerAvatar, RoomQrCode } from "@air-jam/sdk/ui";
import {
  getLobbyReadinessText,
} from "../../game/domain/match-readiness";
import { getTeamCounts, type BotCounts } from "../../game/domain/team-slots";
import { type TeamId } from "../../game/domain/team";
import { TeamName } from "../../game/ui";

interface LobbyScreenProps {
  joinQrValue: string;
  roomId: string | null;
  botCounts: BotCounts;
  pointsToWin: number;
  connectedPlayers: PlayerProfile[];
  team1Players: PlayerProfile[];
  team2Players: PlayerProfile[];
}

interface TeamCardProps {
  team: TeamId;
  count: number;
  players: PlayerProfile[];
  botCount: number;
}

const TeamCard = ({ team, count, players, botCount }: TeamCardProps) => (
  <div className="pong-panel flex h-full w-full flex-col items-center justify-center gap-4 rounded-[28px] p-5 text-center">
    <TeamName
      team={team}
      className="text-2xl font-black tracking-[0.14em]"
    />
    <div className="flex min-h-8 items-center justify-center gap-2">
      {players.length > 0 ? (
        players.map((player) => (
          <PlayerAvatar
            key={player.id}
            player={player}
            size="sm"
            className="h-7 w-7 border-2"
          />
        ))
      ) : (
        <span className="text-xs tracking-[0.18em] text-zinc-500 uppercase">
          Empty
        </span>
      )}
      {botCount > 0
        ? Array.from({ length: botCount }).map((_, index) => (
            <span
              key={`${team}-bot-${index}`}
              className="rounded-full border border-white/20 bg-white/10 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-white/90"
            >
              BOT
            </span>
          ))
        : null}
    </div>
    <div className="pong-status-pill">
      {count} Human • {botCount} Bot
    </div>
  </div>
);

export const LobbyScreen = ({
  joinQrValue,
  roomId,
  botCounts,
  pointsToWin,
  connectedPlayers,
  team1Players,
  team2Players,
}: LobbyScreenProps) => {
  const teamCounts = getTeamCounts([
    ...team1Players.map(() => ({ team: "team1" as const })),
    ...team2Players.map(() => ({ team: "team2" as const })),
  ]);
  const readinessText = getLobbyReadinessText(
    teamCounts,
    botCounts,
    pointsToWin,
    "host",
  );

  return (
    <div className="pong-app-shell flex min-h-screen w-full items-center justify-center px-4 py-6 text-white sm:px-6 sm:py-8">
      <div className="grid w-full max-w-6xl gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <section className="pong-panel-strong flex flex-col justify-between rounded-[34px] px-6 py-7 sm:px-8 sm:py-8">
          <div className="space-y-4">
            <div className="pong-caption">Pong Host Lobby</div>
            <div className="max-w-2xl space-y-3">
              <h1 className="text-5xl font-black uppercase tracking-[0.12em] text-white sm:text-6xl">
                Stage The Match
              </h1>
              <p className="max-w-xl text-sm leading-6 text-slate-300 sm:text-base">
                Keep this host screen visible, let players scan in, pick a side, and launch the round from their phones.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <span className="pong-status-pill">
                Room {roomId ?? "----"}
              </span>
              <span className="pong-status-pill">
                {readinessText}
              </span>
            </div>
          </div>

          <div className="mt-8 grid gap-4 lg:grid-cols-2">
            <TeamCard
              team="team1"
              count={teamCounts.team1}
              players={team1Players}
              botCount={botCounts.team1}
            />
            <TeamCard
              team="team2"
              count={teamCounts.team2}
              players={team2Players}
              botCount={botCounts.team2}
            />
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <div className="pong-caption">Connected Players</div>
            {connectedPlayers.length > 0 ? (
              <div className="flex items-center gap-2">
                {connectedPlayers.map((player) => (
                  <PlayerAvatar
                    key={player.id}
                    player={player}
                    size="sm"
                    className="h-8 w-8 border-2"
                  />
                ))}
              </div>
            ) : (
              <span className="text-xs tracking-[0.16em] text-zinc-500 uppercase">
                Waiting For Players
              </span>
            )}
          </div>
        </section>

        <section className="pong-panel flex flex-col items-center justify-center rounded-[34px] px-6 py-7 text-center sm:px-8">
          <div className="pong-caption">Join On Phone</div>
          <div className="mt-3 text-3xl font-black uppercase tracking-[0.18em] text-white">
            {roomId ?? "----"}
          </div>
          <p className="mt-3 max-w-sm text-sm leading-6 text-slate-300">
            Scan the code, choose a side, and use the controller to start, pause, and rematch.
          </p>
          <div className="pong-panel-strong mt-6 rounded-[28px] p-5">
            <RoomQrCode
              value={joinQrValue}
              size={220}
              className="rounded-xl bg-white"
              alt="Join this Pong room"
            />
          </div>
          <div className="mt-5 grid w-full gap-3 text-left sm:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-white/4 px-4 py-3">
              <div className="pong-caption">Target Score</div>
              <div className="mt-1 text-lg font-bold text-white">
                First to {pointsToWin}
              </div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/4 px-4 py-3">
              <div className="pong-caption">Start Flow</div>
              <div className="mt-1 text-sm font-medium text-slate-300">
                Launch from the controller once both sides are ready.
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

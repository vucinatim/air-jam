import type { PlayerProfile } from "@air-jam/sdk/protocol";
import { PlayerAvatar, RoomQrCode } from "@air-jam/sdk/ui";
import { getLobbyReadinessText } from "../../game/domain/match-readiness";
import { type TeamId } from "../../game/domain/team";
import { getTeamCounts, type BotCounts } from "../../game/domain/team-slots";
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
  players: PlayerProfile[];
  botCount: number;
}

type TeamSlot =
  | { kind: "human"; player: PlayerProfile }
  | { kind: "bot" }
  | { kind: "open" };

const buildTeamSlots = (
  players: PlayerProfile[],
  botCount: number,
): TeamSlot[] => {
  const slots: TeamSlot[] = [];

  for (let index = 0; index < 2; index += 1) {
    const player = players[index];

    if (player) {
      slots.push({ kind: "human", player });
      continue;
    }

    if (index < players.length + botCount) {
      slots.push({ kind: "bot" });
      continue;
    }

    slots.push({ kind: "open" });
  }

  return slots;
};

const TeamCard = ({ team, players, botCount }: TeamCardProps) => {
  const slots = buildTeamSlots(players, botCount);

  return (
    <div
      className="pong-panel flex h-full w-full flex-col gap-4 rounded-[28px] p-5 text-left"
      data-testid={`pong-host-team-card-${team}`}
    >
      <div className="flex items-center justify-between gap-3">
        <TeamName
          team={team}
          className="text-2xl font-black tracking-[0.14em]"
        />
        <div className="text-[10px] font-semibold tracking-[0.18em] text-zinc-500 uppercase">
          {players.length + botCount}/2 Ready
        </div>
      </div>

      <div className="grid gap-3">
        {slots.map((slot, index) => {
          if (slot.kind === "human") {
            return (
              <div
                key={`${team}-slot-${index}`}
                className="flex h-[72px] items-center gap-3 rounded-[22px] border border-white/14 bg-white/8 px-4"
                data-testid={`pong-host-team-slot-${team}-${index}`}
              >
                <PlayerAvatar
                  player={slot.player}
                  size="sm"
                  className="h-10 w-10 border-2"
                />
                <div className="min-w-0">
                  <div className="truncate text-sm font-black tracking-[0.14em] text-white uppercase">
                    {slot.player.label}
                  </div>
                  <div className="text-[10px] font-semibold tracking-[0.16em] text-zinc-400 uppercase">
                    Player Slot
                  </div>
                </div>
              </div>
            );
          }

          if (slot.kind === "bot") {
            return (
              <div
                key={`${team}-slot-${index}`}
                className="flex h-[72px] items-center gap-3 rounded-[22px] border border-cyan-400/28 bg-cyan-400/10 px-4"
                data-testid={`pong-host-team-slot-${team}-${index}`}
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-cyan-300/35 bg-cyan-300/12 text-[11px] font-black tracking-[0.14em] text-cyan-100 uppercase">
                  AI
                </div>
                <div className="min-w-0">
                  <div className="truncate text-sm font-black tracking-[0.14em] text-cyan-50 uppercase">
                    Bot Slot
                  </div>
                  <div className="text-[10px] font-semibold tracking-[0.16em] text-cyan-200/72 uppercase">
                    Auto-Assigned
                  </div>
                </div>
              </div>
            );
          }

          return (
            <div
              key={`${team}-slot-${index}`}
              className="flex h-[72px] items-center gap-3 rounded-[22px] border border-white/10 bg-white/4 px-4"
              data-testid={`pong-host-team-slot-${team}-${index}`}
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-white/10 bg-white/6 text-[11px] font-black tracking-[0.14em] text-zinc-500 uppercase">
                --
              </div>
              <div className="min-w-0">
                <div className="truncate text-sm font-black tracking-[0.14em] text-zinc-400 uppercase">
                  Open Slot
                </div>
                <div className="text-[10px] font-semibold tracking-[0.16em] text-zinc-600 uppercase">
                  Waiting On Phone
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

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
  const stagedPlayerIds = new Set([
    ...team1Players.map((player) => player.id),
    ...team2Players.map((player) => player.id),
  ]);
  const waitingPlayers = connectedPlayers.filter(
    (player) => !stagedPlayerIds.has(player.id),
  );

  return (
    <div
      className="pong-app-shell flex min-h-screen w-full items-center justify-center px-4 py-6 text-white sm:px-6 sm:py-8"
      data-testid="pong-host-lobby-screen"
    >
      <div className="grid w-full max-w-6xl gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <section className="pong-panel-strong flex flex-col rounded-[34px] px-6 py-6 sm:px-8 sm:py-7">
          <div className="flex items-center justify-between gap-6">
            <div className="pong-caption">Lobby</div>
            <div className="text-[11px] font-semibold tracking-[0.18em] text-slate-400 uppercase">
              {readinessText}
            </div>
          </div>

          <div className="mt-6 grid flex-1 gap-4 lg:grid-cols-[1fr_auto_1fr] lg:items-center">
            <TeamCard
              team="team1"
              players={team1Players}
              botCount={botCounts.team1}
            />
            <div className="hidden items-center justify-center px-1 lg:flex">
              <div className="rounded-full text-2xl font-black text-white/30 uppercase">
                VS
              </div>
            </div>
            <TeamCard
              team="team2"
              players={team2Players}
              botCount={botCounts.team2}
            />
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-3 pt-2">
            <div className="text-sm font-semibold tracking-[0.16em] text-slate-300 uppercase">
              First to {pointsToWin}
            </div>
            {waitingPlayers.length > 0 ? (
              <>
                <div className="h-1 w-1 rounded-full bg-white/24" />
                <div className="flex items-center gap-2">
                  <div className="text-[10px] font-semibold tracking-[0.16em] text-zinc-500 uppercase">
                    Waiting
                  </div>
                  {waitingPlayers.map((player) => (
                    <PlayerAvatar
                      key={player.id}
                      player={player}
                      size="sm"
                      className="h-7 w-7 border-2"
                    />
                  ))}
                </div>
              </>
            ) : null}
          </div>
        </section>

        <section className="pong-panel flex flex-col items-center justify-center rounded-[34px] px-6 py-7 text-center sm:px-8">
          <div className="pong-caption">Join On Phone</div>
          <div
            className="mt-2 text-4xl font-black tracking-[0.22em] text-white uppercase"
            data-testid="pong-host-room-code"
          >
            {roomId ?? "----"}
          </div>
          <p className="mt-3 max-w-sm text-sm leading-6 text-slate-300">
            Scan to join.
          </p>
          <RoomQrCode
            value={joinQrValue}
            size={220}
            className="mt-4 rounded-xl bg-white"
            alt="Join this Pong room"
          />
        </section>
      </div>
    </div>
  );
};

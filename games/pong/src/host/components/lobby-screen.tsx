import type { PlayerProfile } from "@air-jam/sdk/protocol";
import {
  JoinUrlControls,
  LifecycleActionGroup,
  PlayerAvatar,
  RoomQrCode,
} from "@air-jam/sdk/ui";
import { getLobbyReadinessText } from "../../game/domain/match-readiness";
import { type TeamId } from "../../game/domain/team";
import {
  buildTeamSlots,
  getTeamCounts,
  type BotCounts,
} from "../../game/domain/team-slots";
import { TeamName } from "../../game/ui";
import { TeamSlotTile } from "../../game/ui/team-slot-tile";

interface LobbyScreenProps {
  joinQrValue: string;
  copiedJoinUrl: boolean;
  onCopyJoinUrl: () => void;
  onOpenJoinUrl: () => void;
  canStartMatch: boolean;
  roomId: string | null;
  botCounts: BotCounts;
  pointsToWin: number;
  connectedPlayers: PlayerProfile[];
  team1Players: PlayerProfile[];
  team2Players: PlayerProfile[];
  onStartMatch: () => void;
}

interface TeamCardProps {
  team: TeamId;
  players: PlayerProfile[];
  botCount: number;
}

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
        {slots.map((slot, index) => (
          <TeamSlotTile
            key={`${team}-slot-${index}`}
            slot={slot}
            surface="host"
            testId={`pong-host-team-slot-${team}-${index}`}
          />
        ))}
      </div>
    </div>
  );
};

export const LobbyScreen = ({
  joinQrValue,
  copiedJoinUrl,
  onCopyJoinUrl,
  onOpenJoinUrl,
  canStartMatch,
  roomId,
  botCounts,
  pointsToWin,
  connectedPlayers,
  team1Players,
  team2Players,
  onStartMatch,
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
      className="pong-app-shell flex h-full min-h-0 w-full items-center justify-center px-4 py-6 text-white sm:px-6 sm:py-8"
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
          <JoinUrlControls
            value={joinQrValue}
            label="Controller link"
            copied={copiedJoinUrl}
            onCopy={onCopyJoinUrl}
            onOpen={onOpenJoinUrl}
            className="mt-4 w-full max-w-sm text-left"
            inputClassName="border-white/15 bg-black/40 text-white"
            buttonClassName="border-white/15 bg-white/5 text-white hover:bg-white/10"
          />
          <RoomQrCode
            value={joinQrValue}
            size={220}
            className="mt-4 rounded-xl bg-white"
            alt="Join this Pong room"
          />
          <LifecycleActionGroup
            phase="lobby"
            canInteract={canStartMatch}
            onStart={onStartMatch}
            startLabel="Play"
            className="mt-4"
            buttonClassName="border-white/15 bg-white px-5 text-black hover:bg-white/90"
          />
        </section>
      </div>
    </div>
  );
};

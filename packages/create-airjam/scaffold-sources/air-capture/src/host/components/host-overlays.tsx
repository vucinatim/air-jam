import type { PlayerProfile } from "@air-jam/sdk";
import {
  JoinUrlControls,
  LifecycleActionGroup,
  PlayerAvatar,
  RoomQrCode,
} from "@air-jam/sdk/ui";
import type { JSX } from "react";
import { Button } from "../../components/ui/button";
import {
  getLobbyReadinessText,
  getMatchReadiness,
  getTeamCounts,
  type TeamCounts,
} from "../../game/domain/match-readiness";
import { buildTeamSlots } from "../../game/domain/team-slots";
import { TEAM_CONFIG, type TeamId } from "../../game/domain/team";
import type { MatchSummary } from "../../game/stores/match/match-store";

export type HostConnectionStatus =
  | "idle"
  | "connecting"
  | "connected"
  | "disconnected"
  | "reconnecting";

interface TeamCardProps {
  teamId: TeamId;
  players: PlayerProfile[];
  botCount: number;
}

const TeamCard = ({ teamId, players, botCount }: TeamCardProps) => {
  const team = TEAM_CONFIG[teamId];
  const totalCount = players.length + botCount;
  const slots = buildTeamSlots(players, botCount);

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-3 rounded-xl border border-white/10 bg-black/40 p-4">
      <div
        className="text-2xl font-black tracking-wide uppercase"
        style={{ color: team.color }}
      >
        {team.label}
      </div>
      <div className="flex min-h-8 flex-wrap items-center justify-center gap-2">
        {slots.some((slot) => slot.kind !== "open") ? (
          slots.map((slot, index) =>
            slot.kind === "human" ? (
            <div
              key={slot.player.id}
              className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-2 py-1"
            >
              <PlayerAvatar
                player={slot.player}
                size="sm"
                className="h-7 w-7 border-2"
              />
              <span className="text-xs font-semibold text-zinc-100 normal-case">
                {slot.player.label}
              </span>
            </div>
            ) : slot.kind === "bot" ? (
              <div
                key={`${teamId}-bot-${index}`}
                className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-2 py-1"
              >
                <PlayerAvatar
                  player={{
                    id: `${teamId}-bot-${index}`,
                    label: `Bot ${index + 1}`,
                    color: team.color,
                  }}
                  isBot
                  size="sm"
                  className="h-7 w-7 border-2"
                />
                <span className="text-xs font-semibold text-zinc-100 normal-case">
                  Bot
                </span>
              </div>
            ) : null,
          )
        ) : (
          <span className="text-xs tracking-wide text-zinc-500 uppercase">
            Empty
          </span>
        )}
      </div>
      <div className="text-sm font-bold tracking-wide text-zinc-300 uppercase">
        {totalCount}
      </div>
    </div>
  );
};

interface LobbyOverlayProps {
  joinQrValue: string;
  copiedJoinUrl: boolean;
  onCopyJoinUrl: () => void | Promise<void>;
  onOpenJoinUrl: () => void;
  roomId: string | null;
  pointsToWin: number;
  botCounts: TeamCounts;
  onStartMatch: () => void;
  connectionStatus: HostConnectionStatus;
  lastError?: string;
  connectedPlayers: PlayerProfile[];
  teamPlayers: Record<TeamId, PlayerProfile[]>;
}

export const LobbyOverlay = ({
  joinQrValue,
  copiedJoinUrl,
  onCopyJoinUrl,
  onOpenJoinUrl,
  roomId,
  pointsToWin,
  botCounts,
  onStartMatch,
  connectionStatus,
  lastError,
  connectedPlayers,
  teamPlayers,
}: LobbyOverlayProps): JSX.Element => {
  const humanCounts = getTeamCounts([
    ...teamPlayers.solaris.map(() => ({ teamId: "solaris" as const })),
    ...teamPlayers.nebulon.map(() => ({ teamId: "nebulon" as const })),
  ]);

  const readinessText = getLobbyReadinessText(
    humanCounts,
    botCounts,
    pointsToWin,
  );
  const canStartMatch = getMatchReadiness(humanCounts, botCounts).canStart;

  const hasJoinQr = joinQrValue.trim().length > 0;

  return (
    <div
      data-testid="air-capture-host-lobby-overlay"
      className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center px-6 py-10 text-white"
    >
      <div className="pointer-events-auto flex w-full max-w-4xl flex-col items-center gap-6 text-center">
        <div className="space-y-1">
          <div className="text-xs tracking-[0.22em] text-zinc-400 uppercase">
            Prototype Lobby
          </div>
          <h1 className="text-5xl font-black tracking-tight uppercase">
            Join Room
          </h1>
          <div
            data-testid="air-capture-room-code"
            className="text-xl font-bold tracking-[0.2em] text-zinc-200 uppercase"
          >
            {roomId ?? "----"}
          </div>
        </div>

        <JoinUrlControls
          value={joinQrValue}
          label="Controller link"
          copied={copiedJoinUrl}
          onCopy={onCopyJoinUrl}
          onOpen={onOpenJoinUrl}
          inputClassName="border-white/20 bg-black/40 text-white"
          buttonClassName="border-white/20 bg-white/10 text-white hover:bg-white/15"
        />

        {hasJoinQr ? (
          <RoomQrCode
            value={joinQrValue}
            size={220}
            className="rounded-md bg-white"
            alt="Join this prototype room"
          />
        ) : (
          <div className="flex h-[220px] w-[220px] flex-col items-center justify-center gap-2 rounded-md border border-white/20 bg-black/40 px-4 text-center">
            <div className="text-[11px] font-semibold tracking-[0.18em] text-zinc-300 uppercase">
              Join URL unavailable
            </div>
            <div className="text-[11px] text-zinc-400">
              {connectionStatus === "connected"
                ? "Room is not ready yet."
                : `Host status: ${connectionStatus}`}
            </div>
            {lastError ? (
              <div className="text-[11px] text-rose-300">{lastError}</div>
            ) : null}
          </div>
        )}

        <div className="text-xs tracking-[0.14em] text-zinc-300 uppercase">
          {readinessText}
        </div>

        <div className="grid w-full max-w-3xl grid-cols-2 gap-3">
          <TeamCard
            teamId="solaris"
            players={teamPlayers.solaris}
            botCount={botCounts.solaris}
          />
          <TeamCard
            teamId="nebulon"
            players={teamPlayers.nebulon}
            botCount={botCounts.nebulon}
          />
        </div>

        <div className="flex min-h-9 flex-col items-center justify-center gap-3">
          <div className="text-[10px] font-semibold tracking-[0.18em] text-zinc-400 uppercase">
            Connected
          </div>
          {connectedPlayers.length > 0 ? (
            <div className="flex flex-wrap items-center justify-center gap-2">
              {connectedPlayers.map((player) => (
                <div
                  key={player.id}
                  className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-2 py-1"
                >
                  <PlayerAvatar
                    player={player}
                    size="sm"
                    className="h-7 w-7 border-2"
                  />
                  <span className="text-xs font-semibold text-zinc-100 normal-case">
                    {player.label}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <span className="text-xs tracking-wide text-zinc-500 uppercase">
              Waiting for players
            </span>
          )}
        </div>

        <LifecycleActionGroup
          phase="lobby"
          canInteract={canStartMatch}
          onStart={onStartMatch}
          startLabel="Start Match"
          buttonClassName="border-white/20 bg-white px-5 text-black hover:bg-white/90"
        />
      </div>
    </div>
  );
};

const formatDuration = (durationMs: number): string => {
  const totalSeconds = Math.floor(durationMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
};

interface EndedOverlayProps {
  roomId: string | null;
  matchSummary: MatchSummary | null;
  botCounts: TeamCounts;
  teamPlayers: Record<
    TeamId,
    Array<{ id: string; label: string; color?: string }>
  >;
}

export const EndedOverlay = ({
  roomId,
  matchSummary,
  botCounts,
  teamPlayers,
}: EndedOverlayProps): JSX.Element => {
  const winner = matchSummary?.winner;
  const winnerLabel = winner
    ? `${TEAM_CONFIG[winner].label} Wins`
    : "Match Ended";
  const winnerColor = winner ? TEAM_CONFIG[winner].color : "#ffffff";

  return (
    <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center px-6 py-10 text-white">
      <div className="pointer-events-auto flex w-full max-w-4xl flex-col items-center gap-6 text-center">
        <div className="space-y-1">
          <div className="text-xs tracking-[0.22em] text-zinc-400 uppercase">
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
              <span style={{ color: TEAM_CONFIG.solaris.color }}>
                {matchSummary.finalScores.solaris}
              </span>
              <span className="px-2 text-zinc-500">:</span>
              <span style={{ color: TEAM_CONFIG.nebulon.color }}>
                {matchSummary.finalScores.nebulon}
              </span>
            </>
          ) : (
            "0:0"
          )}
        </div>

        <div className="grid w-full max-w-3xl grid-cols-2 gap-3">
          <TeamCard
            teamId="solaris"
            players={teamPlayers.solaris as PlayerProfile[]}
            botCount={botCounts.solaris}
          />
          <TeamCard
            teamId="nebulon"
            players={teamPlayers.nebulon as PlayerProfile[]}
            botCount={botCounts.nebulon}
          />
        </div>

        <div className="text-xs tracking-[0.14em] text-zinc-300 uppercase">
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

interface PausedOverlayProps {
  roomId: string | null;
  joinQrValue: string;
  connectionStatus: HostConnectionStatus;
  lastError?: string;
}

export const PausedOverlay = ({
  roomId,
  joinQrValue,
  connectionStatus,
  lastError,
}: PausedOverlayProps) => (
  <div className="pointer-events-none absolute inset-0 z-70 flex items-center justify-center bg-black/60 backdrop-blur-sm">
    <div className="pointer-events-auto flex flex-col items-center gap-4 rounded-xl border border-white/15 bg-black/70 px-6 py-5 text-center text-white">
      <div className="text-xs tracking-[0.2em] text-zinc-400 uppercase">
        Paused
      </div>
      <div className="text-2xl font-black tracking-wide uppercase">
        Room {roomId ?? "----"}
      </div>
      {joinQrValue.trim().length > 0 ? (
        <RoomQrCode
          value={joinQrValue}
          size={140}
          className="rounded-md bg-white"
          alt="Join this prototype room"
        />
      ) : (
        <div className="flex h-[140px] w-[140px] items-center justify-center rounded-md border border-white/20 bg-black/40 px-3 text-center text-[11px] text-zinc-300">
          {lastError
            ? lastError
            : connectionStatus === "connected"
              ? "Room not ready"
              : `Host ${connectionStatus}`}
        </div>
      )}
      <div className="text-[11px] tracking-[0.14em] text-zinc-300 uppercase">
        Resume from any controller
      </div>
    </div>
  </div>
);

export const CountdownOverlay = ({
  remainingSeconds,
}: {
  remainingSeconds: number;
}): JSX.Element => (
  <div className="pointer-events-none absolute inset-0 z-80 flex items-center justify-center">
    <div className="rounded-4xl border border-cyan-300/25 bg-black/55 px-10 py-8 text-center text-white shadow-2xl backdrop-blur-md">
      <div className="text-xs font-semibold tracking-[0.24em] text-cyan-200 uppercase">
        Pilots ready
      </div>
      <div className="mt-2 text-7xl leading-none font-black">
        {remainingSeconds}
      </div>
      <div className="mt-2 text-sm tracking-[0.14em] text-zinc-200 uppercase">
        Rotate now. Thrust unlocks on go.
      </div>
    </div>
  </div>
);

export const AudioBlockedPrompt = ({
  onEnable,
}: {
  onEnable: () => void;
}): JSX.Element => (
  <div
    data-testid="air-capture-audio-blocked-prompt"
    className="pointer-events-auto absolute right-4 bottom-4 z-90 max-w-sm rounded-xl border border-amber-300/30 bg-black/80 p-4 text-white shadow-2xl backdrop-blur-md"
  >
    <div className="text-[10px] font-semibold tracking-[0.18em] text-amber-200 uppercase">
      Audio Blocked
    </div>
    <div className="mt-2 text-sm leading-5 text-zinc-200">
      Your browser blocked game audio on startup. Enable it once here so music
      and sound effects can play without clicking inside the game.
    </div>
    <Button
      type="button"
      data-testid="air-capture-enable-audio-button"
      onClick={onEnable}
      className="mt-3 h-9 bg-amber-300 px-4 text-xs font-black tracking-[0.16em] text-black uppercase hover:bg-amber-200"
    >
      Enable Audio
    </Button>
  </div>
);

export const GameplayFallback = () => {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black text-sm font-semibold tracking-[0.18em] text-white/70 uppercase">
      Loading Match
    </div>
  );
};

export const StageBackdrop = () => {
  return (
    <div className="absolute inset-0 overflow-hidden bg-[#020611]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.18),transparent_32%),radial-gradient(circle_at_bottom,rgba(249,115,22,0.18),transparent_34%),linear-gradient(180deg,rgba(6,11,21,0.9),rgba(2,6,17,1))]" />
      <div className="absolute inset-0 bg-[linear-gradient(rgba(148,163,184,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.08)_1px,transparent_1px)] bg-size-[72px_72px] opacity-30" />
      <div className="absolute inset-x-0 top-[16%] h-px bg-linear-to-r from-transparent via-cyan-300/35 to-transparent" />
      <div className="absolute inset-x-0 bottom-[18%] h-px bg-linear-to-r from-transparent via-orange-300/35 to-transparent" />
    </div>
  );
};

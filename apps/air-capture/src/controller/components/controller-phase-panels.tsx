import type { PlayerProfile } from "@air-jam/sdk";
import {
  Target,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { memo, useRef, useState, type PointerEvent } from "react";
import { useStore } from "zustand";
import { Button } from "../../components/ui/button";
import { createControllerStore } from "../../game/controller-store";
import { TeamBotControls } from "../../game/debug/team-bot-controls";
import type { TeamCounts } from "../../game/domain/match-readiness";
import { TEAM_CONFIG, type TeamId } from "../../game/domain/team";
import type { MatchSummary } from "../../game/stores/match/match-store";

const POINTS_TO_WIN_OPTIONS = [1, 3, 5, 7] as const;

const vibrate = (pattern: number | number[]) => {
  if (typeof navigator !== "undefined" && navigator.vibrate) {
    navigator.vibrate(pattern);
  }
};

const TeamButton = ({
  teamId,
  selected,
  disabled,
  onSelect,
}: {
  teamId: TeamId;
  selected: boolean;
  disabled: boolean;
  onSelect: (teamId: TeamId) => void;
}) => {
  const team = TEAM_CONFIG[teamId];

  return (
    <button
      type="button"
      className={`flex-1 touch-none rounded-xl px-4 py-6 text-3xl font-bold text-white shadow-lg transition-opacity select-none ${
        selected
          ? "ring-4 ring-white ring-offset-2 ring-offset-zinc-900"
          : "opacity-75"
      } ${disabled ? "cursor-not-allowed opacity-40" : "hover:opacity-90"}`}
      style={{ backgroundColor: team.color }}
      disabled={disabled}
      onClick={() => onSelect(teamId)}
    >
      {team.label}
    </button>
  );
};

export const ControllerLobbyPanel = memo(function ControllerLobbyPanel({
  myTeam,
  controlsDisabled,
  effectiveCounts,
  botCounts,
  maxBotsByTeam,
  pointsToWin,
  readinessText,
  canStart,
  teamPlayers,
  onSelectTeam,
  onSetTeamBotCount,
  onSetPointsToWin,
  onStartMatch,
}: {
  myTeam: TeamId | null;
  controlsDisabled: boolean;
  effectiveCounts: TeamCounts;
  botCounts: TeamCounts;
  maxBotsByTeam: TeamCounts;
  pointsToWin: number;
  readinessText: string;
  canStart: boolean;
  teamPlayers: Record<TeamId, PlayerProfile[]>;
  onSelectTeam: (teamId: TeamId) => void;
  onSetTeamBotCount: (teamId: TeamId, count: number) => void;
  onSetPointsToWin: (pointsToWin: number) => void;
  onStartMatch: () => void;
}) {
  return (
    <div
      data-testid="air-capture-controller-lobby-panel"
      className="flex min-h-0 flex-1 flex-col gap-2 p-2"
    >
      <div className="rounded-lg border border-white/10 bg-zinc-900/80 p-3 text-center">
        <div className="text-sm font-semibold tracking-wide text-white uppercase">
          Choose Team
        </div>
        <div className="mt-1 text-[11px] text-zinc-400 uppercase">
          Up to 2 members per team (humans + bots)
        </div>
        <div className="mt-1 text-[10px] tracking-[0.14em] text-zinc-500 uppercase">
          {readinessText}
        </div>
      </div>

      <div className="flex items-stretch gap-2">
        <div className="flex flex-1 flex-col gap-2">
          <TeamButton
            teamId="solaris"
            selected={myTeam === "solaris"}
            disabled={
              controlsDisabled ||
              (effectiveCounts.solaris >= 2 && myTeam !== "solaris")
            }
            onSelect={onSelectTeam}
          />
          <TeamRoster players={teamPlayers.solaris} />
        </div>
        <div className="flex flex-1 flex-col gap-2">
          <TeamButton
            teamId="nebulon"
            selected={myTeam === "nebulon"}
            disabled={
              controlsDisabled ||
              (effectiveCounts.nebulon >= 2 && myTeam !== "nebulon")
            }
            onSelect={onSelectTeam}
          />
          <TeamRoster players={teamPlayers.nebulon} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <TeamBotControls
          teamId="solaris"
          botCount={botCounts.solaris}
          maxBots={maxBotsByTeam.solaris}
          disabled={controlsDisabled}
          onChange={(count) => onSetTeamBotCount("solaris", count)}
        />
        <TeamBotControls
          teamId="nebulon"
          botCount={botCounts.nebulon}
          maxBots={maxBotsByTeam.nebulon}
          disabled={controlsDisabled}
          onChange={(count) => onSetTeamBotCount("nebulon", count)}
        />
      </div>

      <div className="rounded-lg border border-white/10 bg-zinc-900/80 p-3">
        <div className="mb-2 text-center text-[10px] font-semibold tracking-[0.16em] text-zinc-400 uppercase">
          Points to Win
        </div>
        <div className="grid grid-cols-4 gap-2">
          {POINTS_TO_WIN_OPTIONS.map((value) => {
            const selected = pointsToWin === value;
            return (
              <button
                key={value}
                type="button"
                className={`rounded-md border px-2 py-2 text-sm font-bold ${
                  selected
                    ? "border-white/70 bg-white/15 text-white"
                    : "border-white/20 bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
                } disabled:cursor-not-allowed disabled:opacity-50`}
                disabled={controlsDisabled}
                onClick={() => onSetPointsToWin(value)}
              >
                {value}
              </button>
            );
          })}
        </div>
      </div>

      <button
        type="button"
        className="rounded-lg border border-white/20 bg-white/10 px-4 py-3 text-sm font-semibold tracking-wide text-white uppercase hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-50"
        disabled={!canStart || controlsDisabled}
        onClick={onStartMatch}
      >
        Start Match
      </button>
    </div>
  );
});

export const ControllerEndedPanel = memo(function ControllerEndedPanel({
  matchSummary,
  controlsDisabled,
  onRestartMatch,
  onReturnToLobby,
}: {
  matchSummary: MatchSummary | null;
  controlsDisabled: boolean;
  onRestartMatch: () => void;
  onReturnToLobby: () => void;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 px-3 text-center">
      <div className="text-xs tracking-[0.2em] text-zinc-400 uppercase">
        Match Ended
      </div>
      <div
        className="text-3xl font-black uppercase"
        style={{
          color: matchSummary ? TEAM_CONFIG[matchSummary.winner].color : "#fff",
        }}
      >
        {matchSummary
          ? `${TEAM_CONFIG[matchSummary.winner].label} Wins`
          : "Match Complete"}
      </div>
      <div className="text-4xl font-black">
        {matchSummary
          ? `${matchSummary.finalScores.solaris}:${matchSummary.finalScores.nebulon}`
          : "0:0"}
      </div>
      <button
        type="button"
        className="w-full rounded-lg border border-white/20 bg-white/10 px-4 py-3 text-sm font-semibold tracking-wide text-white uppercase hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-50"
        disabled={controlsDisabled}
        onClick={onRestartMatch}
      >
        Restart Match
      </button>
      <button
        type="button"
        className="w-full rounded-lg border border-white/20 px-4 py-3 text-sm font-semibold tracking-wide text-white uppercase hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
        disabled={controlsDisabled}
        onClick={onReturnToLobby}
      >
        Return To Lobby
      </button>
    </div>
  );
});

const TeamRoster = ({ players }: { players: PlayerProfile[] }) => {
  if (players.length === 0) {
    return (
      <div className="rounded-lg border border-white/10 bg-zinc-900/60 px-3 py-2 text-[11px] tracking-[0.16em] text-zinc-500 uppercase">
        No pilots yet
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-white/10 bg-zinc-900/60 px-3 py-2">
      <div className="flex flex-wrap gap-1.5">
        {players.map((player) => (
          <span
            key={player.id}
            className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[11px] font-semibold text-zinc-200 normal-case"
          >
            {player.label}
          </span>
        ))}
      </div>
    </div>
  );
};

const clampUnit = (value: number) => {
  if (value > 1) return 1;
  if (value < -1) return -1;
  return value;
};

const TURN_DEADZONE = 0.08;
const THRUST_ACTIVATION_THRESHOLD = 0.14;

const resolveViewportOrientation = (): "portrait" | "landscape" => {
  if (typeof window === "undefined") {
    return "landscape";
  }

  const viewport = window.visualViewport;
  const width = viewport?.width ?? window.innerWidth;
  const height = viewport?.height ?? window.innerHeight;

  return width >= height ? "landscape" : "portrait";
};

const resolveStickInputFromPointer = (
  target: HTMLDivElement,
  clientX: number,
  clientY: number,
): { turn: number; thrust: number } => {
  const rect = target.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  const radius = Math.min(rect.width, rect.height) / 2;
  const deltaX = clientX - centerX;
  const deltaY = clientY - centerY;

  let turn = 0;
  let thrust = 0;

  if (resolveViewportOrientation() === "portrait") {
    turn = clampUnit(deltaY / radius);
    thrust = deltaX / radius;
  } else {
    turn = clampUnit(deltaX / radius);
    thrust = -deltaY / radius;
  }

  if (Math.abs(turn) < TURN_DEADZONE) {
    turn = 0;
  }

  return {
    turn,
    thrust: thrust >= THRUST_ACTIVATION_THRESHOLD ? 1 : 0,
  };
};

const MovementStick = ({
  store,
  countdownActive,
}: {
  store: ReturnType<typeof createControllerStore>;
  countdownActive: boolean;
}) => {
  const vector = useStore(store, (state) => state.vector);
  const [isDragging, setIsDragging] = useState(false);
  const activePointerIdRef = useRef<number | null>(null);

  const writeVectorFromPointer = (
    target: HTMLDivElement,
    clientX: number,
    clientY: number,
  ) => {
    const { turn, thrust } = resolveStickInputFromPointer(
      target,
      clientX,
      clientY,
    );
    store.getState().setVector({
      x: Number(turn.toFixed(3)),
      y: countdownActive ? 0 : thrust,
    });
  };

  const handlePointerDown = (e: PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    e.preventDefault();
    activePointerIdRef.current = e.pointerId;
    setIsDragging(true);
    writeVectorFromPointer(e.currentTarget, e.clientX, e.clientY);
    vibrate(10);
  };

  const handlePointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (
      activePointerIdRef.current !== e.pointerId ||
      !e.currentTarget.hasPointerCapture(e.pointerId)
    ) {
      return;
    }
    e.preventDefault();
    writeVectorFromPointer(e.currentTarget, e.clientX, e.clientY);
  };

  const handlePointerEnd = (e: PointerEvent<HTMLDivElement>) => {
    if (activePointerIdRef.current !== e.pointerId) {
      return;
    }
    e.preventDefault();
    activePointerIdRef.current = null;
    setIsDragging(false);
    store.getState().setVector({ x: 0, y: 0 });
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="text-center text-[11px] font-semibold tracking-[0.16em] text-zinc-400 uppercase">
        {countdownActive ? "Rotate into position" : "Flight stick"}
      </div>
      <div
        className={`relative flex flex-1 touch-none items-center justify-center overflow-hidden rounded-4xl border border-white/10 bg-radial from-slate-800 via-slate-900 to-black shadow-[inset_0_0_30px_rgba(255,255,255,0.06)] ${isDragging ? "ring-2 ring-cyan-300/60" : ""} `}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
        onLostPointerCapture={handlePointerEnd}
        onContextMenu={(e) => e.preventDefault()}
        aria-label="Movement stick"
        data-testid="air-capture-movement-stick"
      >
        <div className="absolute h-44 w-44 rounded-full border border-white/10 bg-white/3" />
        <div className="absolute h-28 w-28 rounded-full border border-white/8" />
        <div className="absolute h-px w-32 bg-white/10" />
        <div className="absolute h-32 w-px bg-white/10" />
        <div
          className={`absolute flex h-24 w-24 items-center justify-center rounded-full border border-white/20 bg-white/15 shadow-[0_10px_35px_rgba(0,0,0,0.35)] backdrop-blur-sm ${
            isDragging
              ? "transition-none"
              : "transition-transform duration-150 ease-out"
          }`}
          style={{
            transform: `translate(${vector.x * 62}px, 0px)`,
          }}
        >
          <div className="h-10 w-10 rounded-full bg-white/25" />
        </div>
      </div>
    </div>
  );
};

interface ActionControlProps {
  store: ReturnType<typeof createControllerStore>;
  action: "ability" | "action";
  icon: LucideIcon;
  label: string;
  colorClass: string;
  activeRingClass: string;
  disabled?: boolean;
}

const ActionControl = ({
  store,
  action,
  icon: Icon,
  label,
  colorClass,
  activeRingClass,
  disabled = false,
}: ActionControlProps) => {
  const isActive = useStore(store, (state) => state[action]);

  const handlePointerDown = (e: PointerEvent<HTMLButtonElement>) => {
    if (disabled) {
      return;
    }
    e.currentTarget.setPointerCapture(e.pointerId);
    e.preventDefault();

    if (action === "ability") {
      store.getState().setAbility(true);
    } else {
      store.getState().setAction(true);
    }

    vibrate(20);
  };

  const handlePointerEnd = (e: PointerEvent<HTMLButtonElement>) => {
    e.preventDefault();

    if (action === "ability") {
      store.getState().setAbility(false);
    } else {
      store.getState().setAction(false);
    }
  };

  return (
    <Button
      type="button"
      className={`h-full flex-1 touch-none rounded-xl border-0 text-lg font-bold text-white shadow-lg transition-colors sm:text-xl md:text-2xl ${colorClass} ${
        isActive ? `ring-2 brightness-110 ${activeRingClass}` : ""
      } ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
      disabled={disabled}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
      onLostPointerCapture={handlePointerEnd}
      onContextMenu={(e) => e.preventDefault()}
      aria-label={label}
    >
      <Icon className="h-6 w-6 sm:h-8 sm:w-8 md:h-10 md:w-10" />
      <span>{label}</span>
    </Button>
  );
};

export const ControllerPlayingControls = memo(function ControllerPlayingControls({
  store,
  countdownRemainingSeconds = 0,
}: {
  store: ReturnType<typeof createControllerStore>;
  countdownRemainingSeconds?: number;
}) {
  const countdownActive = countdownRemainingSeconds > 0;

  return (
    <div className="relative flex min-h-0 flex-1 touch-none items-stretch gap-2 p-2 select-none">
      {countdownActive ? (
        <div className="pointer-events-none absolute inset-x-2 top-2 z-10 flex justify-center">
          <div className="rounded-full border border-cyan-300/40 bg-black/65 px-4 py-2 text-center shadow-lg backdrop-blur-sm">
            <div className="text-[10px] font-semibold tracking-[0.22em] text-cyan-200 uppercase">
              Match starts in
            </div>
            <div className="text-4xl font-black text-white">
              {countdownRemainingSeconds}
            </div>
          </div>
        </div>
      ) : null}

      <MovementStick store={store} countdownActive={countdownActive} />

      <div className="flex flex-1 flex-col gap-2">
        <div className="rounded-2xl border border-white/10 bg-zinc-900/70 px-3 py-2 text-center">
          <div className="text-[11px] font-semibold tracking-[0.16em] text-zinc-400 uppercase">
            {countdownActive ? "Aim your launch" : "Flight stick"}
          </div>
          <div className="mt-1 text-[10px] tracking-[0.14em] text-zinc-500 uppercase">
            {countdownActive
              ? "Touch and steer only"
              : "Touch to thrust, drag to steer"}
          </div>
        </div>
        <ActionControl
          store={store}
          action="ability"
          icon={Zap}
          label="Ability"
          colorClass="bg-linear-to-br from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
          activeRingClass="ring-purple-300"
          disabled={countdownActive}
        />
        <ActionControl
          store={store}
          action="action"
          icon={Target}
          label="Shoot"
          colorClass="bg-linear-to-br from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600"
          activeRingClass="ring-red-300"
          disabled={countdownActive}
        />
      </div>
    </div>
  );
});

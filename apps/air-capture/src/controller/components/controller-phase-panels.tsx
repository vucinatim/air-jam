import type { TeamCounts } from "../../game/domain/match-readiness";
import { TEAM_CONFIG, type TeamId } from "../../game/domain/team";
import { createControllerStore } from "../../game/controller-store";
import { TeamBotControls } from "../../game/debug/team-bot-controls";
import { Button } from "../../components/ui/button";
import { useStore } from "zustand";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Target,
  Zap,
  type LucideIcon,
} from "lucide-react";
import type { PointerEvent } from "react";
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

export const ControllerLobbyPanel = ({
  myTeam,
  controlsDisabled,
  effectiveCounts,
  botCounts,
  maxBotsByTeam,
  pointsToWin,
  readinessText,
  canStart,
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
  onSelectTeam: (teamId: TeamId) => void;
  onSetTeamBotCount: (teamId: TeamId, count: number) => void;
  onSetPointsToWin: (pointsToWin: number) => void;
  onStartMatch: () => void;
}) => {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 p-2">
      <div className="rounded-lg border border-white/10 bg-zinc-900/80 p-3 text-center">
        <div className="text-sm font-semibold uppercase tracking-wide text-white">
          Choose Team
        </div>
        <div className="mt-1 text-[11px] uppercase text-zinc-400">
          Up to 2 members per team (humans + bots)
        </div>
        <div className="mt-1 text-[10px] uppercase tracking-[0.14em] text-zinc-500">
          {readinessText}
        </div>
      </div>

      <div className="flex items-stretch gap-2">
        <TeamButton
          teamId="solaris"
          selected={myTeam === "solaris"}
          disabled={
            controlsDisabled ||
            (effectiveCounts.solaris >= 2 && myTeam !== "solaris")
          }
          onSelect={onSelectTeam}
        />
        <TeamButton
          teamId="nebulon"
          selected={myTeam === "nebulon"}
          disabled={
            controlsDisabled ||
            (effectiveCounts.nebulon >= 2 && myTeam !== "nebulon")
          }
          onSelect={onSelectTeam}
        />
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
        <div className="mb-2 text-center text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-400">
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
        className="rounded-lg border border-white/20 bg-white/10 px-4 py-3 text-sm font-semibold uppercase tracking-wide text-white hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-50"
        disabled={!canStart || controlsDisabled}
        onClick={onStartMatch}
      >
        Start Match
      </button>
    </div>
  );
};

export const ControllerEndedPanel = ({
  matchSummary,
  controlsDisabled,
  onRestartMatch,
  onReturnToLobby,
}: {
  matchSummary: MatchSummary | null;
  controlsDisabled: boolean;
  onRestartMatch: () => void;
  onReturnToLobby: () => void;
}) => {
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
        className="w-full rounded-lg border border-white/20 bg-white/10 px-4 py-3 text-sm font-semibold uppercase tracking-wide text-white hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-50"
        disabled={controlsDisabled}
        onClick={onRestartMatch}
      >
        Restart Match
      </button>
      <button
        type="button"
        className="w-full rounded-lg border border-white/20 px-4 py-3 text-sm font-semibold uppercase tracking-wide text-white hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
        disabled={controlsDisabled}
        onClick={onReturnToLobby}
      >
        Return To Lobby
      </button>
    </div>
  );
};

interface DirectionControlProps {
  store: ReturnType<typeof createControllerStore>;
  axis: "x" | "y";
  value: number;
  icon: LucideIcon;
  label: string;
}

const DirectionControl = ({
  store,
  axis,
  value,
  icon: Icon,
  label,
}: DirectionControlProps) => {
  const isActive = useStore(store, (state) => state.vector[axis] === value);

  const handlePointerDown = (e: PointerEvent<HTMLButtonElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    e.preventDefault();

    const currentVector = store.getState().vector;
    store.getState().setVector({ ...currentVector, [axis]: value });
    vibrate(10);
  };

  const handlePointerEnd = (e: PointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    const currentVector = store.getState().vector;
    if (currentVector[axis] === value) {
      store.getState().setVector({ ...currentVector, [axis]: 0 });
    }
  };

  return (
    <Button
      type="button"
      variant="secondary"
      className={`h-full flex-1 touch-none rounded-xl bg-slate-800 text-4xl font-semibold text-slate-100 shadow-lg transition-colors hover:bg-slate-700 sm:text-5xl md:text-6xl ${
        isActive ? "bg-slate-700 ring-2 ring-slate-500" : ""
      }`}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
      onLostPointerCapture={handlePointerEnd}
      onContextMenu={(e) => e.preventDefault()}
      aria-label={label}
    >
      <Icon className="h-8 w-8 sm:h-12 sm:w-12 md:h-16 md:w-16" />
    </Button>
  );
};

interface ActionControlProps {
  store: ReturnType<typeof createControllerStore>;
  action: "ability" | "action";
  icon: LucideIcon;
  label: string;
  colorClass: string;
  activeRingClass: string;
}

const ActionControl = ({
  store,
  action,
  icon: Icon,
  label,
  colorClass,
  activeRingClass,
}: ActionControlProps) => {
  const isActive = useStore(store, (state) => state[action]);

  const handlePointerDown = (e: PointerEvent<HTMLButtonElement>) => {
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
      }`}
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

export const ControllerPlayingControls = ({
  store,
}: {
  store: ReturnType<typeof createControllerStore>;
}) => {
  return (
    <div className="flex min-h-0 flex-1 touch-none items-stretch gap-2 p-2 select-none">
      <div className="flex flex-1 items-center justify-center gap-2">
        <DirectionControl
          store={store}
          axis="x"
          value={-1}
          icon={ArrowLeft}
          label="Left"
        />
        <DirectionControl
          store={store}
          axis="x"
          value={1}
          icon={ArrowRight}
          label="Right"
        />
      </div>

      <div className="flex flex-1 flex-col gap-2">
        <ActionControl
          store={store}
          action="ability"
          icon={Zap}
          label="Ability"
          colorClass="bg-linear-to-br from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
          activeRingClass="ring-purple-300"
        />
        <ActionControl
          store={store}
          action="action"
          icon={Target}
          label="Shoot"
          colorClass="bg-linear-to-br from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600"
          activeRingClass="ring-red-300"
        />
      </div>

      <div className="flex flex-1 flex-col items-stretch justify-stretch gap-2">
        <DirectionControl
          store={store}
          axis="y"
          value={1}
          icon={ArrowUp}
          label="Forward"
        />
        <DirectionControl
          store={store}
          axis="y"
          value={-1}
          icon={ArrowDown}
          label="Backward"
        />
      </div>
    </div>
  );
};

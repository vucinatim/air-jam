import type { PlayerProfile } from "@air-jam/sdk";
import { ControllerPrimaryAction, LifecycleActionGroup } from "@air-jam/sdk/ui";
import { Target, Zap, type LucideIcon } from "lucide-react";
import { memo, useRef, useState, type PointerEvent } from "react";
import { useStore } from "zustand";
import { Button } from "../../components/ui/button";
import { createControllerStore } from "../../game/controller-store";
import type { TeamCounts } from "../../game/domain/match-readiness";
import { TEAM_CONFIG, type TeamId } from "../../game/domain/team";
import { buildTeamSlots, MAX_TEAM_SLOTS } from "../../game/domain/team-slots";
import type { MatchSummary } from "../../game/stores/match/match-store";
import { TeamSlotTile } from "../../game/ui/team-slot-tile";
import { PRESS_FEEL_CLASS } from "../constants";

const POINTS_TO_WIN_OPTIONS = [1, 3, 5, 7] as const;

const capturePanelClass =
  "rounded-2xl border border-white/10 bg-linear-to-b from-white/[0.07] to-white/[0.02] shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_18px_50px_rgba(2,6,23,0.34)]";

const vibrate = (pattern: number | number[]) => {
  if (typeof navigator !== "undefined" && navigator.vibrate) {
    navigator.vibrate(pattern);
  }
};

export const ControllerLobbyPanel = memo(function ControllerLobbyPanel({
  myTeam,
  controlsDisabled,
  teamCounts,
  botCounts,
  pointsToWin,
  readinessText,
  canStartMatch,
  teamPlayers,
  onStartMatch,
  onSelectTeam,
  onSetTeamBotCount,
  onSetPointsToWin,
}: {
  myTeam: TeamId | null;
  controlsDisabled: boolean;
  teamCounts: TeamCounts;
  botCounts: TeamCounts;
  pointsToWin: number;
  readinessText: string;
  canStartMatch: boolean;
  teamPlayers: Record<TeamId, PlayerProfile[]>;
  onStartMatch: () => void;
  onSelectTeam: (teamId: TeamId) => void;
  onSetTeamBotCount: (teamId: TeamId, count: number) => void;
  onSetPointsToWin: (pointsToWin: number) => void;
}) {
  return (
    <div
      data-testid="air-capture-controller-lobby-panel"
      className="flex min-h-0 flex-1 flex-col"
    >
      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto overscroll-contain px-3 pt-3 pb-4">
        <div className="grid gap-2 sm:grid-cols-2">
          {(["solaris", "nebulon"] as const).map((teamId) => {
            const botCount = botCounts[teamId];
            const humanCount = teamCounts[teamId];
            const players = teamPlayers[teamId];
            const slots = buildTeamSlots(players, botCount);
            const teamIsFull = humanCount + botCount >= MAX_TEAM_SLOTS;
            const joined = myTeam === teamId;
            const teamColor = TEAM_CONFIG[teamId].color;

            return (
              <div
                key={teamId}
                className={`${capturePanelClass} px-4 py-3 text-center`}
                data-testid={`air-capture-controller-team-card-${teamId}`}
              >
                <div
                  className="text-[0.6875rem] font-black tracking-[0.2em] uppercase"
                  style={{ color: teamColor }}
                >
                  {TEAM_CONFIG[teamId].label}
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    data-testid={`air-capture-controller-join-team-${teamId}`}
                    className={`rounded-xl border px-3 py-3 text-[0.6875rem] font-black tracking-[0.16em] text-white uppercase ${PRESS_FEEL_CLASS}`}
                    style={{
                      background: joined
                        ? `linear-gradient(180deg, ${teamColor}, color-mix(in srgb, ${teamColor} 70%, black))`
                        : "linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.03)), rgba(12,18,33,0.92)",
                      borderColor: joined
                        ? `${teamColor}aa`
                        : "rgba(255,255,255,0.12)",
                      boxShadow: joined
                        ? `0 16px 28px color-mix(in srgb, ${teamColor} 22%, transparent)`
                        : undefined,
                    }}
                    disabled={controlsDisabled || (teamIsFull && !joined)}
                    onClick={() => onSelectTeam(teamId)}
                  >
                    {joined ? "Joined" : teamIsFull ? "Full" : "Join Team"}
                  </button>
                  <button
                    type="button"
                    data-testid={`air-capture-controller-add-bot-${teamId}`}
                    className={`rounded-xl border px-3 py-3 text-[0.6875rem] font-black tracking-[0.16em] uppercase ${
                      teamIsFull
                        ? "border-white/10 bg-white/4 text-zinc-500"
                        : "border-cyan-400/40 bg-cyan-400/12 text-cyan-100"
                    }`}
                    disabled={controlsDisabled || teamIsFull}
                    onClick={() => onSetTeamBotCount(teamId, botCount + 1)}
                  >
                    Add Bot
                  </button>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {slots.map((slot, index) => {
                    const canRemoveBot =
                      slot.kind === "bot" && !controlsDisabled;
                    return (
                      <TeamSlotTile
                        key={`${teamId}-slot-${index}`}
                        slot={slot}
                        testId={`air-capture-controller-team-slot-${teamId}-${index}`}
                        disabled={!canRemoveBot}
                        onBotAction={() => {
                          if (canRemoveBot) {
                            onSetTeamBotCount(
                              teamId,
                              Math.max(0, botCount - 1),
                            );
                          }
                        }}
                      />
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        <div className={`${capturePanelClass} px-4 py-3`}>
          <div className="grid grid-cols-4 gap-2">
            {POINTS_TO_WIN_OPTIONS.map((value) => {
              const selected = pointsToWin === value;
              return (
                <button
                  key={value}
                  type="button"
                  className={`rounded-2xl border px-2 py-3 text-sm font-black ${
                    selected
                      ? "border-white/50 bg-white/14 text-white"
                      : "border-white/10 bg-white/6 text-zinc-300 hover:bg-white/10"
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

        <ControllerPrimaryAction
          label="Play Match"
          helper={readinessText}
          disabled={!canStartMatch}
          onPress={onStartMatch}
          className="pb-1"
          buttonClassName="border border-sky-400/25 bg-white text-black hover:bg-white/95"
        />
      </div>
    </div>
  );
});

export const ControllerEndedPanel = memo(function ControllerEndedPanel({
  matchSummary,
  runtimeState,
  onBackToLobby,
  onRestart,
}: {
  matchSummary: MatchSummary | null;
  runtimeState?: "playing" | "paused";
  onBackToLobby: () => void;
  onRestart: () => void;
}) {
  const winner = matchSummary?.winner ?? null;
  const winnerColor = winner ? TEAM_CONFIG[winner].color : "#ffffff";

  return (
    <div className="flex min-h-0 flex-1 items-center justify-center px-3 py-4">
      <div className="flex w-full max-w-md flex-col items-center gap-4 rounded-[28px] border border-white/10 bg-zinc-950/88 px-5 py-6 text-center shadow-2xl">
        <div className="text-[11px] font-semibold tracking-[0.22em] text-zinc-400 uppercase">
          Match Ended
        </div>
        <div
          className="text-3xl leading-tight font-black uppercase"
          style={{ color: winnerColor }}
        >
          {winner ? `${TEAM_CONFIG[winner].label} Wins` : "Match Complete"}
        </div>
        <div className="flex items-center gap-3 text-5xl leading-none font-black">
          <span style={{ color: TEAM_CONFIG.solaris.color }}>
            {matchSummary?.finalScores.solaris ?? 0}
          </span>
          <span className="text-zinc-500">:</span>
          <span style={{ color: TEAM_CONFIG.nebulon.color }}>
            {matchSummary?.finalScores.nebulon ?? 0}
          </span>
        </div>
        {matchSummary ? (
          <div className="grid w-full grid-cols-2 gap-2">
            {(["solaris", "nebulon"] as const).map((teamId) => (
              <div
                key={teamId}
                className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3"
              >
                <div
                  className="text-[11px] font-semibold tracking-[0.16em] uppercase"
                  style={{ color: TEAM_CONFIG[teamId].color }}
                >
                  {TEAM_CONFIG[teamId].label}
                </div>
                <div className="mt-1 text-xl font-black text-white">
                  {matchSummary.finalScores[teamId]}
                </div>
              </div>
            ))}
          </div>
        ) : null}
        <LifecycleActionGroup
          phase="ended"
          runtimeState={runtimeState}
          canInteract
          onBackToLobby={onBackToLobby}
          onRestart={onRestart}
          presentation="pill"
          visibleKinds={["back-to-lobby", "restart"]}
          className="w-full flex-col items-stretch gap-2 pt-1"
          buttonClassName="h-11 w-full justify-center rounded-full px-4 text-[0.6875rem] font-semibold tracking-[0.16em] uppercase"
        />
      </div>
    </div>
  );
});

const clampUnit = (value: number) => {
  if (value > 1) return 1;
  if (value < -1) return -1;
  return value;
};

const TURN_DEADZONE = 0.08;
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
): { turn: number; verticalIntent: number } => {
  const rect = target.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  const radius = Math.min(rect.width, rect.height) / 2;
  const deltaX = clientX - centerX;
  const deltaY = clientY - centerY;

  let turn = 0;
  let verticalIntent = 0;

  if (resolveViewportOrientation() === "portrait") {
    turn = clampUnit(deltaY / radius);
    verticalIntent = deltaX / radius;
  } else {
    turn = clampUnit(deltaX / radius);
    verticalIntent = -deltaY / radius;
  }

  if (Math.abs(turn) < TURN_DEADZONE) {
    turn = 0;
  }

  return {
    turn,
    verticalIntent: clampUnit(verticalIntent),
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
    const { turn, verticalIntent } = resolveStickInputFromPointer(
      target,
      clientX,
      clientY,
    );
    store.getState().setVector({
      x: Number(turn.toFixed(3)),
      y: countdownActive ? 0 : Number(verticalIntent.toFixed(3)),
    });
  };

  const handlePointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (activePointerIdRef.current !== null) {
      return;
    }
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
            transform: `translate(${vector.x * 62}px, ${-vector.y * 62}px)`,
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

export const ControllerPlayingControls = memo(
  function ControllerPlayingControls({
    store,
    countdownRemainingSeconds = 0,
  }: {
    store: ReturnType<typeof createControllerStore>;
    countdownRemainingSeconds?: number;
  }) {
    const countdownActive = countdownRemainingSeconds > 0;

    return (
      <div className="relative flex min-h-0 flex-1 touch-none flex-col gap-3 p-3 select-none">
        {countdownActive ? (
          <div className="pointer-events-none absolute inset-x-3 top-3 z-10 flex justify-center">
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

        <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] gap-3">
          <MovementStick store={store} countdownActive={countdownActive} />

          <div className="flex min-h-0 flex-col gap-3">
            <div className="rounded-2xl border border-white/10 bg-zinc-900/70 px-3 py-3 text-center">
              <div className="text-[11px] font-semibold tracking-[0.16em] text-zinc-400 uppercase">
                {countdownActive ? "Aim your launch" : "Flight stick"}
              </div>
              <div className="mt-1 text-[10px] tracking-[0.14em] text-zinc-500 uppercase">
                {countdownActive
                  ? "Touch and steer only"
                  : "Up to thrust, drag to steer"}
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
      </div>
    );
  },
);

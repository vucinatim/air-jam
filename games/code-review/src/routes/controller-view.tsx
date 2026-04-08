import {
  useAirJamController,
  useControllerTick,
  useInputWriter,
} from "@air-jam/sdk";
import {
  ForcedOrientationShell,
  LifecycleActionGroup,
  PlayerAvatar,
  RuntimeShellHeader,
  useControllerLifecycleIntents,
  useControllerLifecyclePermissions,
  useControllerShellStatus,
} from "@air-jam/sdk/ui";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { PUNCH_COOLDOWN_MS } from "../game/input";
import { useGameStore } from "../game/stores";

const TEAM1_COLOR = "#dc2626"; // Solaris (Red) — matches arena corner
const TEAM2_COLOR = "#2563eb"; // Nebulon (Blue) — matches arena corner
const MAX_TEAM_SLOTS = 2;

/** Degrees of tilt beyond which direction is fully -1 or 1 */
const GYRO_MAX_TILT = 25;
/** Dead zone in degrees — tilt below this is ignored */
const GYRO_DEAD_ZONE = 12;
/** Smoothing factor — 0 = no change, 1 = no smoothing */
const GYRO_SMOOTHING = 0.08;

const clamp = (v: number, min: number, max: number) =>
  Math.min(max, Math.max(min, v));

const lerp = (current: number, target: number, factor: number) =>
  current + (target - current) * factor;

type DeviceOrientationEventWithPermission = {
  prototype: DeviceOrientationEvent;
  requestPermission?: () => Promise<"granted" | "denied">;
};

const resolveDeviceOrientationEvent =
  (): DeviceOrientationEventWithPermission | null => {
    const candidate = (
      globalThis as {
        DeviceOrientationEvent?: DeviceOrientationEventWithPermission;
      }
    ).DeviceOrientationEvent;

    return candidate ?? null;
  };

/** Maps a raw tilt angle (degrees) to a -1..1 direction value with dead zone. */
const tiltToDirection = (tilt: number, invert: boolean) => {
  if (Math.abs(tilt) < GYRO_DEAD_ZONE) return 0;
  const sign = tilt > 0 ? 1 : -1;
  const magnitude =
    (Math.abs(tilt) - GYRO_DEAD_ZONE) / (GYRO_MAX_TILT - GYRO_DEAD_ZONE);
  return clamp((invert ? -sign : sign) * magnitude, -1, 1);
};

export function ControllerView() {
  const controller = useAirJamController();
  const writeInput = useInputWriter();
  const verticalRef = useRef(0);
  const horizontalRef = useRef(0);
  const gyroActiveRef = useRef(false);

  // Defense state ref (hold button)
  const defendRef = useRef(false);

  // Punch state refs — emitted as one-tick pulses.
  const punchRef = useRef({ left: false, right: false });
  const cooldownRef = useRef({ left: false, right: false });
  const cooldownTimeoutRef = useRef<{
    left: number | null;
    right: number | null;
  }>({ left: null, right: null });

  // Use the networked store
  const matchPhase = useGameStore((state) => state.matchPhase);
  const matchSummary = useGameStore((state) => state.matchSummary);
  const scores = useGameStore((state) => state.scores);
  const teamAssignments = useGameStore((state) => state.teamAssignments);
  const readyByPlayerId = useGameStore((state) => state.readyByPlayerId);
  const botCounts = useGameStore((state) => state.botCounts);
  const actions = useGameStore.useActions();

  const myAssignment = controller.controllerId
    ? teamAssignments[controller.controllerId]
    : null;
  const myProfile = controller.controllerId
    ? controller.players.find((player) => player.id === controller.controllerId) ?? null
    : null;
  const myTeam = myAssignment?.team ?? null;
  const isReady = controller.controllerId
    ? (readyByPlayerId[controller.controllerId] ?? false)
    : false;
  const teamColor =
    myTeam === "team1" ? TEAM1_COLOR : myTeam === "team2" ? TEAM2_COLOR : null;
  const teamAccent = teamColor ?? "#27272a";
  const connectedPlayerIdSet = useMemo(
    () => new Set(controller.players.map((player) => player.id)),
    [controller.players],
  );
  const connectedTeamAssignments = useMemo(
    () =>
      Object.entries(teamAssignments)
        .filter(([playerId]) => connectedPlayerIdSet.has(playerId))
        .map(([, assignment]) => assignment),
    [connectedPlayerIdSet, teamAssignments],
  );
  const teamHumanCounts = useMemo(
    () => ({
      team1: connectedTeamAssignments.filter((entry) => entry.team === "team1")
        .length,
      team2: connectedTeamAssignments.filter((entry) => entry.team === "team2")
        .length,
    }),
    [connectedTeamAssignments],
  );
  const team1IsFull = teamHumanCounts.team1 + botCounts.team1 >= MAX_TEAM_SLOTS;
  const team2IsFull = teamHumanCounts.team2 + botCounts.team2 >= MAX_TEAM_SLOTS;
  const showEndedView = matchPhase === "ended";
  const showLobbyControls = matchPhase === "lobby";
  const showGameplayControls =
    controller.connectionStatus === "connected" &&
    matchPhase === "playing" &&
    controller.runtimeState === "playing";
  const showPausedOverlay = matchPhase === "playing" && !showGameplayControls;
  const shellStatus = useControllerShellStatus({
    roomId: controller.roomId,
    connectionStatus: controller.connectionStatus,
    playerLabel: myProfile?.label ?? null,
  });
  const lifecyclePermissions = useControllerLifecyclePermissions({
    phase: matchPhase,
    canStartMatch: controller.connectionStatus === "connected",
    canSendSystemCommand: controller.connectionStatus === "connected",
  });
  const lifecycleIntents = useControllerLifecycleIntents({
    onStart: () => actions.startMatch(),
    onTogglePause: () => controller.sendSystemCommand("toggle_pause"),
    onBackToLobby: () => actions.resetToLobby(),
    onRestart: () => actions.resetToLobby(),
  });

  useControllerTick(
    () => {
      const leftPunch = punchRef.current.left;
      const rightPunch = punchRef.current.right;

      writeInput({
        vertical: verticalRef.current,
        horizontal: horizontalRef.current,
        leftPunch,
        rightPunch,
        defend: defendRef.current,
      });

      if (leftPunch) {
        punchRef.current.left = false;
      }
      if (rightPunch) {
        punchRef.current.right = false;
      }
    },
    {
      enabled:
        controller.connectionStatus === "connected" &&
        matchPhase === "playing" &&
        controller.runtimeState === "playing",
      intervalMs: 16,
    },
  );

  // Gyroscope orientation handler
  const handleOrientation = useRef((e: DeviceOrientationEvent) => {
    const smooth = (current: number, target: number) => {
      if (Math.abs(target) < 0.05 && Math.abs(current) < 0.05) return 0;
      // Faster smoothing when changing direction, gentle when maintaining
      const changing =
        Math.sign(current) !== Math.sign(target) && Math.abs(target) > 0.1;
      const factor = changing ? 0.25 : GYRO_SMOOTHING;
      return lerp(current, target, factor);
    };

    if (e.gamma !== null) {
      verticalRef.current = smooth(
        verticalRef.current,
        tiltToDirection(e.gamma, true),
      );
    }
    if (e.beta !== null) {
      horizontalRef.current = smooth(
        horizontalRef.current,
        tiltToDirection(e.beta, false),
      );
    }
  });

  const deviceOrientationEvent = resolveDeviceOrientationEvent();
  const hasGyroscopeSupport = deviceOrientationEvent !== null;
  const needsPermission =
    typeof deviceOrientationEvent?.requestPermission === "function";

  // Always keep gyro listener attached when no permission prompt is needed (Android / non-Safari).
  useEffect(() => {
    if (!hasGyroscopeSupport || needsPermission) return;
    const orientationHandler = handleOrientation.current;
    window.addEventListener("deviceorientation", orientationHandler);
    gyroActiveRef.current = true;
    return () => {
      window.removeEventListener("deviceorientation", orientationHandler);
    };
  }, [hasGyroscopeSupport, needsPermission]);

  // Keep movement input centered on mount.
  useEffect(() => {
    verticalRef.current = 0;
    horizontalRef.current = 0;
  }, []);

  /** Fire a punch for the given side, with auto-reset and cooldown. */
  const triggerPunch = useCallback((side: "left" | "right") => {
    if (cooldownRef.current[side]) return;

    punchRef.current[side] = true;
    cooldownRef.current[side] = true;

    // Reset cooldown after cooldown period
    if (cooldownTimeoutRef.current[side] !== null) {
      window.clearTimeout(cooldownTimeoutRef.current[side]);
    }
    cooldownTimeoutRef.current[side] = window.setTimeout(() => {
      cooldownRef.current[side] = false;
      cooldownTimeoutRef.current[side] = null;
    }, PUNCH_COOLDOWN_MS);
  }, []);

  const triggerLeftPunch = useCallback(
    () => triggerPunch("left"),
    [triggerPunch],
  );
  const triggerRightPunch = useCallback(
    () => triggerPunch("right"),
    [triggerPunch],
  );

  // Request orientation permission once we know we're on a platform that requires it.
  // This should be called from a user gesture on iOS.
  const requestPermissions = async () => {
    await requestGyroPermission();
  };

  const selectTeam = (team: "team1" | "team2") => {
    const teamIsFull =
      team === "team1"
        ? team1IsFull && myTeam !== "team1"
        : team2IsFull && myTeam !== "team2";
    if (teamIsFull) return;
    actions.joinTeam({ team });
    actions.setReady({ ready: false });
    requestPermissions();
  };

  const updateBotCount = (team: "team1" | "team2", count: number) => {
    actions.setBotCount({ team, count });
  };

  const toggleReady = () => {
    if (!myTeam) return;
    actions.setReady({ ready: !isReady });
    requestPermissions();
  };

  // Request gyro permission — must be called from a user gesture on iOS.
  const requestGyroPermission = async () => {
    if (gyroActiveRef.current || !deviceOrientationEvent) return;
    if (deviceOrientationEvent.requestPermission) {
      const permission = await deviceOrientationEvent.requestPermission();
      if (permission !== "granted") return;
    }
    window.addEventListener("deviceorientation", handleOrientation.current);
    gyroActiveRef.current = true;
  };

  // Cleanup all punch and cooldown timeouts on unmount
  useEffect(() => {
    const cooldownTimeouts = cooldownTimeoutRef.current;
    return () => {
      for (const side of ["left", "right"] as const) {
        if (cooldownTimeouts[side] !== null) {
          window.clearTimeout(cooldownTimeouts[side]);
        }
      }
    };
  }, []);

  useEffect(() => {
    const releaseControls = () => {
      verticalRef.current = 0;
      horizontalRef.current = 0;
      defendRef.current = false;
      punchRef.current.left = false;
      punchRef.current.right = false;
    };

    window.addEventListener("blur", releaseControls);
    document.addEventListener("visibilitychange", releaseControls);

    return () => {
      window.removeEventListener("blur", releaseControls);
      document.removeEventListener("visibilitychange", releaseControls);
    };
  }, []);

  return (
    <div className="controller-view-shell">
      <ForcedOrientationShell desired="portrait">
        <div className="pixel-font flex min-h-dvh w-full flex-col">
          <RuntimeShellHeader
            connectionStatus={controller.connectionStatus}
            leftSlot={
              <div className="flex min-w-0 items-center gap-3">
                {myProfile ? (
                  <PlayerAvatar
                    player={myProfile}
                    size="sm"
                    className="h-8 w-8 border-2"
                  />
                ) : (
                  <span className="flex h-8 w-8 items-center justify-center rounded-full border border-white/15 bg-zinc-800 text-[10px] font-semibold text-zinc-200">
                    {shellStatus.identityInitial}
                  </span>
                )}
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-zinc-100">
                    {shellStatus.displayName}
                  </div>
                  <div className="text-[10px] font-semibold tracking-[0.18em] text-zinc-400 uppercase">
                    {shellStatus.roomLine}
                  </div>
                </div>
              </div>
            }
            rightSlot={
              <LifecycleActionGroup
                phase={matchPhase}
                runtimeState={controller.runtimeState}
                canInteract={lifecyclePermissions.canInteractForPhase}
                onStart={lifecycleIntents.onStart}
                onTogglePause={lifecycleIntents.onTogglePause}
                onBackToLobby={lifecycleIntents.onBackToLobby}
                onRestart={lifecycleIntents.onRestart}
                startLabel="Play"
                restartLabel="Play Again"
              />
            }
            className="border-zinc-700 bg-zinc-950/95"
          />
          {showEndedView ? (
            <div className="flex flex-1 min-h-0 w-full flex-col bg-[radial-gradient(circle_at_top,_rgba(239,68,68,0.2),_transparent_42%),linear-gradient(180deg,_#f5f5f4_0%,_#e7e5e4_100%)] p-4 sm:p-6">
              <div className="flex flex-1 min-h-0 flex-col justify-center gap-4 rounded-none border-4 border-zinc-700 bg-zinc-950/92 px-5 py-6 text-zinc-100 shadow-[0_24px_60px_rgba(24,24,27,0.35)]">
                <div className="text-center">
                  <p className="text-[11px] tracking-[0.2em] text-zinc-500 uppercase">
                    Match Ended
                  </p>
                  <p className="mt-3 text-2xl leading-tight text-white sm:text-3xl">
                    {matchSummary?.winner === "draw"
                      ? "Draw"
                      : matchSummary?.winner === "team1"
                        ? "Coder Wins"
                        : "Reviewer Wins"}
                  </p>
                </div>

                <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 border-y-4 border-zinc-800 py-4">
                  <div className="min-w-0 bg-red-600 px-3 py-3 text-center text-white">
                    <p className="text-[10px] tracking-[0.16em] uppercase text-red-100">
                      Coder
                    </p>
                    <p className="mt-1 text-3xl leading-none">
                      {matchSummary?.scores.team1 ?? scores.team1}
                    </p>
                  </div>
                  <p className="text-2xl text-zinc-500">:</p>
                  <div className="min-w-0 bg-blue-600 px-3 py-3 text-center text-white">
                    <p className="text-[10px] tracking-[0.16em] uppercase text-blue-100">
                      Reviewer
                    </p>
                    <p className="mt-1 text-3xl leading-none">
                      {matchSummary?.scores.team2 ?? scores.team2}
                    </p>
                  </div>
                </div>

                <div className="grid gap-3 text-center text-xs text-zinc-400 sm:grid-cols-2 sm:text-left">
                  <div className="border-2 border-zinc-800 bg-zinc-900/80 px-3 py-3">
                    <p className="text-[10px] tracking-[0.18em] text-zinc-500 uppercase">
                      Status
                    </p>
                    <p className="mt-2 leading-relaxed text-zinc-200">
                      Waiting for the host to return everyone to the lobby.
                    </p>
                  </div>
                  <div className="border-2 border-zinc-800 bg-zinc-900/80 px-3 py-3">
                    <p className="text-[10px] tracking-[0.18em] text-zinc-500 uppercase">
                      Next Step
                    </p>
                    <p className="mt-2 leading-relaxed text-zinc-200">
                      Stay connected. You can start the next round from this screen.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ) : showLobbyControls ? (
            // Team selection UI (shown while in lobby phase)
            <div className="flex flex-1 min-h-0 w-full flex-col gap-2 p-2 sm:p-3">
              {/* Up button - Select Team 1 */}
              <button
                type="button"
                disabled={team1IsFull && myTeam !== "team1"}
                className={`min-h-[8rem] flex-1 touch-none rounded-none border-4 text-3xl text-white shadow-lg select-none hover:opacity-90 active:scale-95 sm:text-4xl ${
                  myTeam === "team1" ? "ring-4 ring-white" : "opacity-70"
                }`}
                style={{
                  backgroundColor: myTeam === "team1" ? TEAM1_COLOR : "#3f3f46",
                  borderColor:
                    myTeam === "team1"
                      ? TEAM1_COLOR
                      : myTeam === "team2"
                        ? TEAM2_COLOR
                        : "#3f3f46",
                  willChange: "transform",
                  transition: "none",
                }}
                onClick={() => selectTeam("team1")}
              >
                {team1IsFull && myTeam !== "team1" ? "CODER FULL" : "CODER"}
              </button>

              {/* Down button - Select Team 2 */}
              <button
                type="button"
                disabled={team2IsFull && myTeam !== "team2"}
                className={`min-h-[8rem] flex-1 touch-none rounded-none border-4 text-3xl text-white shadow-lg select-none hover:opacity-90 active:scale-95 sm:text-4xl ${
                  myTeam === "team2" ? "ring-4 ring-white" : "opacity-70"
                }`}
                style={{
                  backgroundColor: myTeam === "team2" ? TEAM2_COLOR : "#3f3f46",
                  borderColor:
                    myTeam === "team2"
                      ? TEAM2_COLOR
                      : myTeam === "team1"
                        ? TEAM1_COLOR
                        : "#3f3f46",
                  willChange: "transform",
                  transition: "none",
                }}
                onClick={() => selectTeam("team2")}
              >
                {team2IsFull && myTeam !== "team2" ? "REVIEWER FULL" : "REVIEWER"}
              </button>

              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-none border-4 border-zinc-500 bg-zinc-800/80 p-2 text-center text-white">
                  <p className="text-xs tracking-[0.14em] text-zinc-300 uppercase">
                    Coder Bots
                  </p>
                  <p className="mt-1 text-2xl font-black">{botCounts.team1}</p>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      className="h-10 rounded-none border-2 border-zinc-300 bg-zinc-900 text-xl font-black disabled:opacity-40"
                      disabled={botCounts.team1 <= 0}
                      onClick={() => updateBotCount("team1", botCounts.team1 - 1)}
                    >
                      -
                    </button>
                    <button
                      type="button"
                      className="h-10 rounded-none border-2 border-zinc-300 bg-zinc-900 text-xl font-black disabled:opacity-40"
                      disabled={
                        teamHumanCounts.team1 + botCounts.team1 >= MAX_TEAM_SLOTS
                      }
                      onClick={() => updateBotCount("team1", botCounts.team1 + 1)}
                    >
                      +
                    </button>
                  </div>
                </div>

                <div className="rounded-none border-4 border-zinc-500 bg-zinc-800/80 p-2 text-center text-white">
                  <p className="text-xs tracking-[0.14em] text-zinc-300 uppercase">
                    Reviewer Bots
                  </p>
                  <p className="mt-1 text-2xl font-black">{botCounts.team2}</p>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      className="h-10 rounded-none border-2 border-zinc-300 bg-zinc-900 text-xl font-black disabled:opacity-40"
                      disabled={botCounts.team2 <= 0}
                      onClick={() => updateBotCount("team2", botCounts.team2 - 1)}
                    >
                      -
                    </button>
                    <button
                      type="button"
                      className="h-10 rounded-none border-2 border-zinc-300 bg-zinc-900 text-xl font-black disabled:opacity-40"
                      disabled={
                        teamHumanCounts.team2 + botCounts.team2 >= MAX_TEAM_SLOTS
                      }
                      onClick={() => updateBotCount("team2", botCounts.team2 + 1)}
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>

              <button
                type="button"
                disabled={!myTeam}
                className="h-[4.5rem] touch-none rounded-none border-4 border-zinc-300 bg-zinc-800 text-xl text-white shadow-lg select-none enabled:active:scale-95 disabled:opacity-40 sm:h-20 sm:text-2xl"
                onClick={toggleReady}
              >
                {myTeam ? (isReady ? "READY" : "TAP TO READY") : "PICK A TEAM"}
              </button>
            </div>
          ) : showPausedOverlay ? (
            <div className="flex flex-1 min-h-0 w-full items-center justify-center p-4">
              <div className="w-full max-w-sm rounded-none border-4 border-zinc-600 bg-zinc-900/90 p-4 text-center">
                <p className="text-sm tracking-[0.18em] text-zinc-400 uppercase">
                  Match Paused
                </p>
                <p className="mt-2 text-xs text-zinc-300">
                  Waiting for host runtime sync...
                </p>
              </div>
            </div>
          ) : (
            <div className="flex flex-1 min-h-0 w-full flex-col gap-3 bg-[linear-gradient(180deg,_rgba(24,24,27,0.96)_0%,_rgba(12,10,9,0.98)_100%)] p-3">
              <div className="grid grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)] gap-3">
                <div className="border-2 border-white/10 bg-zinc-900/80 px-3 py-2 text-[10px] tracking-[0.16em] text-zinc-400 uppercase">
                  Team
                  <p className="mt-2 text-base tracking-[0.12em] text-white">
                    {myTeam === "team1" ? "Coder" : "Reviewer"}
                  </p>
                </div>
                <div className="border-2 border-white/10 bg-zinc-900/80 px-3 py-2 text-[10px] tracking-[0.16em] text-zinc-400 uppercase">
                  Controls
                  <p className="mt-2 text-xs leading-relaxed text-zinc-200 normal-case tracking-normal">
                    Hold defend to block. Tap left or right to throw a punch.
                  </p>
                </div>
              </div>

              <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)] gap-3">
                <button
                  type="button"
                  className="flex min-h-0 touch-none flex-col items-start justify-between rounded-none border-4 px-4 py-5 text-left text-white shadow-[0_22px_50px_rgba(24,24,27,0.38)] select-none active:scale-[0.985]"
                  style={{
                    background: `linear-gradient(180deg, ${teamAccent}, color-mix(in srgb, ${teamAccent} 56%, #18181b))`,
                    borderColor: teamAccent,
                    willChange: "transform",
                    transition: "none",
                  }}
                  onPointerDown={() => {
                    defendRef.current = true;
                  }}
                  onPointerUp={() => {
                    defendRef.current = false;
                  }}
                  onPointerCancel={() => {
                    defendRef.current = false;
                  }}
                  onPointerLeave={() => {
                    defendRef.current = false;
                  }}
                >
                  <div>
                    <p className="text-[10px] tracking-[0.18em] text-white/75 uppercase">
                      Hold
                    </p>
                    <p className="mt-3 max-w-full text-[1.45rem] leading-[0.95] sm:text-[1.7rem]">
                      Guard
                    </p>
                  </div>
                  <p className="max-w-full text-[11px] leading-relaxed text-white/90">
                    Hold to block.
                  </p>
                </button>

                <div className="grid min-h-0 grid-rows-2 gap-3">
                  <button
                    type="button"
                    className="flex min-h-0 touch-none flex-col items-start justify-between rounded-none border-4 px-4 py-5 text-left text-white shadow-[0_18px_40px_rgba(24,24,27,0.34)] select-none active:scale-[0.985]"
                    style={{
                      background: `linear-gradient(180deg, ${teamAccent}, color-mix(in srgb, ${teamAccent} 60%, #111827))`,
                      borderColor: teamAccent,
                      willChange: "transform",
                      transition: "none",
                    }}
                    onPointerDown={() => {
                      triggerLeftPunch();
                    }}
                  >
                    <p className="text-[10px] tracking-[0.18em] text-white/75 uppercase">
                      Tap
                    </p>
                    <p className="max-w-full text-[1.45rem] leading-[0.95] sm:text-[1.7rem]">
                      Left
                    </p>
                    <p className="text-[11px] text-white/90">Tap to punch left.</p>
                  </button>

                  <button
                    type="button"
                    className="flex min-h-0 touch-none flex-col items-start justify-between rounded-none border-4 px-4 py-5 text-left text-white shadow-[0_18px_40px_rgba(24,24,27,0.34)] select-none active:scale-[0.985]"
                    style={{
                      background: `linear-gradient(180deg, ${teamAccent}, color-mix(in srgb, ${teamAccent} 66%, #0f172a))`,
                      borderColor: teamAccent,
                      willChange: "transform",
                      transition: "none",
                    }}
                    onPointerDown={() => {
                      triggerRightPunch();
                    }}
                  >
                    <p className="text-[10px] tracking-[0.18em] text-white/75 uppercase">
                      Tap
                    </p>
                    <p className="max-w-full text-[1.45rem] leading-[0.95] sm:text-[1.7rem]">
                      Right
                    </p>
                    <p className="text-[11px] text-white/90">Tap to punch right.</p>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </ForcedOrientationShell>
    </div>
  );
}

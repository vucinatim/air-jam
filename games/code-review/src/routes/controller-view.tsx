import {
  useAirJamController,
  useControllerTick,
  useInputWriter,
} from "@air-jam/sdk";
import { ForcedOrientationShell } from "@air-jam/sdk/ui";
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
    controller.gameState === "playing";
  const showPausedOverlay = matchPhase === "playing" && !showGameplayControls;

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
        controller.gameState === "playing",
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
        <div className="pixel-font h-full w-full">
          {showEndedView ? (
            <div className="flex h-full w-full items-center justify-center p-4">
              <div className="w-full max-w-sm rounded-none border-4 border-zinc-600 bg-zinc-900/90 p-4 text-center text-zinc-100">
                <p className="text-xs tracking-[0.18em] text-zinc-400 uppercase">
                  Match Ended
                </p>
                <p className="mt-2 text-lg">
                  {matchSummary?.winner === "draw"
                    ? "Draw"
                    : matchSummary?.winner === "team1"
                      ? "Coder Wins"
                      : "Reviewer Wins"}
                </p>
                <p className="mt-3 text-sm text-zinc-300">
                  {matchSummary?.scores.team1 ?? scores.team1} -{" "}
                  {matchSummary?.scores.team2 ?? scores.team2}
                </p>
                <p className="mt-3 text-xs text-zinc-400">
                  Waiting for host to return to lobby...
                </p>
              </div>
            </div>
          ) : showLobbyControls ? (
            // Team selection UI (shown while in lobby phase)
            <div className="flex h-full w-full flex-col gap-2 p-2">
              {/* Up button - Select Team 1 */}
              <button
                type="button"
                disabled={team1IsFull && myTeam !== "team1"}
                className={`flex-1 touch-none rounded-none border-4 text-4xl text-white shadow-lg select-none hover:opacity-90 active:scale-95 ${
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
                className={`flex-1 touch-none rounded-none border-4 text-4xl text-white shadow-lg select-none hover:opacity-90 active:scale-95 ${
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
                className="h-20 touch-none rounded-none border-4 border-zinc-300 bg-zinc-800 text-2xl text-white shadow-lg select-none enabled:active:scale-95 disabled:opacity-40"
                onClick={toggleReady}
              >
                {myTeam ? (isReady ? "READY" : "TAP TO READY") : "PICK A TEAM"}
              </button>
            </div>
          ) : showPausedOverlay ? (
            <div className="flex h-full w-full items-center justify-center p-4">
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
            // Game control buttons — portrait layout, phone held on its side.
            // Left column: defend (hold). Right column: left + right punch.
            // All text rotated 90° so it reads naturally when sideways.
            <div className="flex h-full w-full flex-row gap-2 p-2">
              {/* Defend button — left column (bottom when held sideways) */}
              <button
                type="button"
                className="flex basis-1/3 touch-none items-center justify-center rounded-none border-4 text-2xl text-white shadow-lg select-none active:scale-95"
                style={{
                  backgroundColor: teamAccent,
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
                <span className="inline-block rotate-90">DEFEND</span>
              </button>

              {/* Punch buttons — right column (top when held sideways) */}
              <div className="flex flex-1 flex-col gap-2">
                {/* Left Punch button */}
                <button
                  type="button"
                  className="flex-1 touch-none rounded-none border-4 bg-zinc-800 text-3xl text-white shadow-lg select-none active:scale-95"
                  style={{
                    backgroundColor: teamAccent,
                    borderColor: teamAccent,
                    willChange: "transform",
                    transition: "none",
                  }}
                  onPointerDown={() => {
                    triggerLeftPunch();
                  }}
                >
                  <span className="inline-block rotate-90">LEFT</span>
                </button>

                {/* Right Punch button */}
                <button
                  type="button"
                  className="flex-1 touch-none rounded-none border-4 bg-zinc-800 text-3xl text-white shadow-lg select-none active:scale-95"
                  style={{
                    backgroundColor: teamAccent,
                    borderColor: teamAccent,
                    willChange: "transform",
                    transition: "none",
                  }}
                  onPointerDown={() => {
                    triggerRightPunch();
                  }}
                >
                  <span className="inline-block rotate-90">RIGHT</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </ForcedOrientationShell>
    </div>
  );
}

import {
  useAirJamController,
  useControllerTick,
  useInputWriter,
} from "@air-jam/sdk";
import { ForcedOrientationShell } from "@air-jam/sdk/ui";
import { useCallback, useEffect, useRef } from "react";
import { useGameStore } from "../game/stores";
import { PUNCH_COOLDOWN_MS } from "../game/input";

const TEAM1_COLOR = "#dc2626"; // Solaris (Red) — matches arena corner
const TEAM2_COLOR = "#2563eb"; // Nebulon (Blue) — matches arena corner
const MOBILE_BREAKPOINT = 768;

const isLikelyMobile = (): boolean => {
  if (typeof window === "undefined") return false;

  const userAgent = window.navigator.userAgent;
  const mobileUserAgent =
    /Mobi|Android|iPhone|iPad|iPod|Windows Phone|BlackBerry|BB10|Opera Mini|IEMobile|Mobile/i.test(
      userAgent,
    );
  const hasCoarsePointer = window.matchMedia("(pointer: coarse)").matches;
  const hasSmallScreen = window.innerWidth <= MOBILE_BREAKPOINT;

  return mobileUserAgent || hasCoarsePointer || hasSmallScreen;
};

const getFullscreenElement = (): Element | null => {
  const doc = document;
  return (
    doc.fullscreenElement ||
    (doc as { webkitFullscreenElement?: Element | null }).webkitFullscreenElement ||
    (doc as { mozFullScreenElement?: Element | null }).mozFullScreenElement ||
    (doc as { msFullscreenElement?: Element | null }).msFullscreenElement ||
    null
  );
};

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

const resolveDeviceOrientationEvent = (): DeviceOrientationEventWithPermission | null => {
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
  const teamAssignments = useGameStore(
    (state) => state.teamAssignments,
  );
  const actions = useGameStore.useActions();

  const myAssignment = controller.controllerId
    ? teamAssignments[controller.controllerId]
    : null;
  const myTeam = myAssignment?.team ?? null;
  const teamColor = myTeam === "team1" ? TEAM1_COLOR : myTeam === "team2" ? TEAM2_COLOR : null;
  const teamAccent = teamColor ?? "#27272a";
  const isMobileClient = isLikelyMobile();

  const requestFullscreenForMobile = useCallback(() => {
    if (!isMobileClient || typeof document === "undefined") return;

    if (getFullscreenElement()) return;

    const root = document.documentElement;
    const request =
      root.requestFullscreen ||
      (root as { webkitRequestFullscreen?: () => Promise<void> })
        .webkitRequestFullscreen ||
      (root as { mozRequestFullScreen?: () => Promise<void> }).mozRequestFullScreen ||
      (root as { msRequestFullscreen?: () => Promise<void> }).msRequestFullscreen;

    if (!request) return;

    void request.call(root);
  }, [isMobileClient]);

  const hasRequestedFullscreenRef = useRef(false);
  useEffect(() => {
    if (!isMobileClient) {
      hasRequestedFullscreenRef.current = false;
      return;
    }

    if (controller.gameState !== "playing") {
      hasRequestedFullscreenRef.current = false;
      return;
    }

    if (hasRequestedFullscreenRef.current) return;

    hasRequestedFullscreenRef.current = true;
    requestFullscreenForMobile();
  }, [controller.gameState, isMobileClient, requestFullscreenForMobile]);

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
        <div className="h-full w-full pixel-font">
          {controller.gameState === "paused" ? (
        // Team selection UI (shown when paused)
        <div className="flex h-full w-full flex-col gap-2 p-2">
          {/* Up button - Select Team 1 */}
          <button
            type="button"
            className={`flex-1 touch-none rounded-none border-4 text-4xl text-white shadow-lg select-none hover:opacity-90 active:scale-95 ${
              myTeam === "team1"
                ? "ring-4 ring-white"
                : "opacity-70"
            }`}
            style={{
              backgroundColor: myTeam === "team1" ? TEAM1_COLOR : "#3f3f46",
              borderColor:
                myTeam === "team1" ? TEAM1_COLOR : myTeam === "team2" ? TEAM2_COLOR : "#3f3f46",
              willChange: "transform",
              transition: "none",
            }}
            onTouchStart={() => {
              actions.joinTeam({ team: "team1" });
              requestPermissions();
              requestFullscreenForMobile();
            }}
            onMouseDown={() => {
              actions.joinTeam({ team: "team1" });
              requestPermissions();
              requestFullscreenForMobile();
            }}
          >
            CODER
          </button>

          {/* Down button - Select Team 2 */}
          <button
            type="button"
            className={`flex-1 touch-none rounded-none border-4 text-4xl text-white shadow-lg select-none hover:opacity-90 active:scale-95 ${
              myTeam === "team2"
                ? "ring-4 ring-white"
                : "opacity-70"
            }`}
            style={{
              backgroundColor: myTeam === "team2" ? TEAM2_COLOR : "#3f3f46",
              borderColor:
                myTeam === "team2" ? TEAM2_COLOR : myTeam === "team1" ? TEAM1_COLOR : "#3f3f46",
              willChange: "transform",
              transition: "none",
            }}
            onTouchStart={() => {
              actions.joinTeam({ team: "team2" });
              requestPermissions();
              requestFullscreenForMobile();
            }}
            onMouseDown={() => {
              actions.joinTeam({ team: "team2" });
              requestPermissions();
              requestFullscreenForMobile();
            }}
          >
            REVIEWER
          </button>
        </div>
      ) : (
        // Game control buttons — portrait layout, phone held on its side.
        // Left column: defend (hold). Right column: left + right punch.
        // All text rotated 90° so it reads naturally when sideways.
        <div className="flex h-full w-full flex-row gap-2 p-2">
          {/* Defend button — left column (bottom when held sideways) */}
          <button
            type="button"
            className="flex touch-none basis-1/3 items-center justify-center rounded-none border-4 text-2xl text-white shadow-lg select-none active:scale-95"
            style={{
              backgroundColor: teamAccent,
              borderColor: teamAccent,
              willChange: "transform",
              transition: "none",
            }}
            onTouchStart={() => {
              defendRef.current = true;
              requestFullscreenForMobile();
            }}
            onTouchEnd={() => {
              defendRef.current = false;
            }}
            onTouchCancel={() => {
              defendRef.current = false;
            }}
            onMouseDown={() => {
              defendRef.current = true;
              requestFullscreenForMobile();
            }}
              onMouseUp={() => {
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
              onTouchStart={() => {
                triggerLeftPunch();
                requestFullscreenForMobile();
              }}
              onMouseDown={() => {
                triggerLeftPunch();
                requestFullscreenForMobile();
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
              onTouchStart={() => {
                triggerRightPunch();
                requestFullscreenForMobile();
              }}
              onMouseDown={() => {
                triggerRightPunch();
                requestFullscreenForMobile();
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

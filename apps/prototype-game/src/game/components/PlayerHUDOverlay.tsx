import { useEffect, useRef, memo } from "react";
import { useHealthStore } from "../health-store";
import { useGameStore } from "../game-store";
import { useAbilitiesStore } from "../abilities-store";
import { shipPositions } from "./Ship";
import { Vector3, PerspectiveCamera } from "three";
import { cn } from "../../lib/utils";

// --- CONFIGURATION ---
const HUD_CONFIG = {
  OFFSET_Y: 4, // Units below the ship
  WIDTH: 80, // Width of HUD in px
  COLORS: {
    HIGH: "#22c55e", // Green (>60%)
    MID: "#eab308", // Yellow (>30%)
    LOW: "#ef4444", // Red
  },
};

// --- TYPES ---
interface HUDVisualsProps {
  health: number;
  maxHealth: number;
  abilityIcon?: string;
  isAbilityActive: boolean;
  // Refs for direct DOM manipulation (no re-renders)
  countdownCircleRef?: React.RefObject<SVGCircleElement | null>;
  durationTextRef?: React.RefObject<HTMLDivElement | null>;
}

interface PlayerHUDOverlayProps {
  canvasElement: HTMLCanvasElement | null;
  cameras: Array<{
    camera: PerspectiveCamera;
    viewport: { x: number; y: number; width: number; height: number };
  }>;
}

// ------------------------------------------------------------------
// 1. PRESENTATIONAL COMPONENT (Edit your HTML/CSS here!)
// ------------------------------------------------------------------
const HUDVisuals = memo(
  ({
    health,
    maxHealth,
    abilityIcon,
    isAbilityActive,
    countdownCircleRef,
    durationTextRef,
  }: HUDVisualsProps) => {
    const healthPercentage = (health / maxHealth) * 100;

    // Color Logic
    const color =
      healthPercentage > 60
        ? HUD_CONFIG.COLORS.HIGH
        : healthPercentage > 30
        ? HUD_CONFIG.COLORS.MID
        : HUD_CONFIG.COLORS.LOW;

    // SVG circle parameters for countdown
    const size = 40; // 10 * 4 (w-10 = 40px)
    const radius = 17;
    const circumference = 2 * Math.PI * radius;

    return (
      <div className="w-full pointer-events-none select-none">
        {/* Health Bar */}
        <div className="relative w-full h-5 bg-white/20 rounded overflow-hidden mb-1.5 backdrop-blur-sm">
          <div
            className="absolute inset-y-0 left-0 transition-all duration-200 ease-out opacity-80"
            style={{
              width: `${healthPercentage}%`,
              backgroundColor: color,
              boxShadow: `0 0 10px ${color}`,
            }}
          />
          <div className="absolute inset-0 flex items-center justify-center text-[10px] text-white font-mono font-bold drop-shadow-md">
            {Math.round(health)}/{maxHealth}
          </div>
        </div>

        {/* Ability Icon with Circular Countdown */}
        <div className="relative flex items-center justify-center">
          <div className="relative w-10 h-10">
            {/* Ability Icon */}
            <div
              className={cn(
                "absolute inset-0 w-full h-full rounded-full border-2 flex items-center justify-center text-sm transition-all z-10",
                isAbilityActive ? "border-transparent" : "border-white/30",
                abilityIcon ? "bg-white/20" : "transparent"
              )}
            >
              <span className="translate-y-px">{abilityIcon}</span>
            </div>

            {/* Circular Countdown Timer (WoW-style) - Always rendered, visibility controlled via DOM */}
            <svg
              className="absolute inset-0 w-full h-full transform -rotate-90"
              style={{ zIndex: 5, display: isAbilityActive ? "block" : "none" }}
            >
              {/* Background circle (full circle, semi-transparent) */}
              <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke="rgba(0, 0, 0, 0.4)"
                strokeWidth="3"
              />
              {/* Countdown circle (sweeps clockwise from top) - Updated via ref */}
              <circle
                ref={countdownCircleRef}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke={color}
                strokeWidth="3"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={circumference}
                style={{
                  transition: "stroke-dashoffset 0.1s linear",
                  filter: `drop-shadow(0 0 4px ${color})`,
                }}
              />
            </svg>
          </div>

          {/* Duration Text - Updated via ref */}
          <div
            ref={durationTextRef}
            className="absolute -bottom-4 left-1/2 -translate-x-1/2 text-[10px] text-white font-mono font-bold drop-shadow-md"
            style={{ display: "none" }}
          />
        </div>
      </div>
    );
  }
);

HUDVisuals.displayName = "HUDVisuals";

// ------------------------------------------------------------------
// 2. LOGIC COMPONENT (Handles 3D Tracking & Data Fetching)
// ------------------------------------------------------------------
const PlayerHUDItem = memo(function PlayerHUDItem({
  controllerId,
  canvasElement,
  viewport,
  camera,
}: {
  controllerId: string;
  canvasElement: HTMLCanvasElement | null;
  viewport: { x: number; y: number; width: number; height: number };
  camera: PerspectiveCamera;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const countdownCircleRef = useRef<SVGCircleElement | null>(null);
  const durationTextRef = useRef<HTMLDivElement | null>(null);
  const countdownAnimationRef = useRef<number | undefined>(undefined);

  // --- Data Stores ---
  const health = useHealthStore((state) => state.health[controllerId] ?? 100);
  const maxHealth = 100;
  const ability = useAbilitiesStore((state) => state.getAbility(controllerId));
  const isAbilityActive = useAbilitiesStore((state) =>
    state.isAbilityActive(controllerId)
  );

  // Update countdown circle and duration text via direct DOM manipulation (no re-renders)
  useEffect(() => {
    if (!isAbilityActive || !ability || ability.duration === 0) {
      // Hide countdown when not active
      if (countdownCircleRef.current) {
        countdownCircleRef.current.style.display = "none";
      }
      if (durationTextRef.current) {
        durationTextRef.current.style.display = "none";
      }
      if (countdownAnimationRef.current) {
        cancelAnimationFrame(countdownAnimationRef.current);
        countdownAnimationRef.current = undefined;
      }
      return;
    }

    // Start countdown animation loop
    const updateCountdown = () => {
      const store = useAbilitiesStore.getState();
      const currentAbility = store.getAbility(controllerId);
      const currentIsActive = store.isAbilityActive(controllerId);

      if (
        !currentIsActive ||
        !currentAbility ||
        currentAbility.duration === 0
      ) {
        if (countdownCircleRef.current) {
          countdownCircleRef.current.style.display = "none";
        }
        if (durationTextRef.current) {
          durationTextRef.current.style.display = "none";
        }
        return;
      }

      const remaining = store.getRemainingDuration(controllerId);
      const totalDuration = currentAbility.duration;

      if (remaining <= 0) {
        if (countdownCircleRef.current) {
          countdownCircleRef.current.style.display = "none";
        }
        if (durationTextRef.current) {
          durationTextRef.current.style.display = "none";
        }
        return;
      }

      // Update countdown circle
      if (countdownCircleRef.current) {
        const radius = 17;
        const circumference = 2 * Math.PI * radius;
        const percentage = (remaining / totalDuration) * 100;
        const offset = circumference - (percentage / 100) * circumference;
        countdownCircleRef.current.style.strokeDashoffset = `${offset}`;
        countdownCircleRef.current.style.display = "block";
      }

      // Update duration text
      if (durationTextRef.current) {
        const seconds = Math.ceil(remaining);
        durationTextRef.current.textContent = `${seconds}s`;
        durationTextRef.current.style.display = "block";
      }

      countdownAnimationRef.current = requestAnimationFrame(updateCountdown);
    };

    countdownAnimationRef.current = requestAnimationFrame(updateCountdown);

    return () => {
      if (countdownAnimationRef.current) {
        cancelAnimationFrame(countdownAnimationRef.current);
        countdownAnimationRef.current = undefined;
      }
    };
  }, [controllerId, isAbilityActive, ability]);

  // --- 3D Position Tracking (Runs outside React Render Cycle) ---
  // We use Refs for values accessed inside requestAnimationFrame to avoid stale closures
  const cameraRef = useRef(camera);
  const viewportRef = useRef(viewport);

  useEffect(() => {
    cameraRef.current = camera;
    viewportRef.current = viewport;
  }, [camera, viewport]);

  useEffect(() => {
    if (!canvasElement) return;

    let animId: number;
    const updatePosition = () => {
      const element = containerRef.current;
      const shipPos = shipPositions.get(controllerId);

      if (!element || !shipPos) {
        if (element) element.style.display = "none";
        animId = requestAnimationFrame(updatePosition);
        return;
      }

      // 1. World Position (Offset)
      const worldPos = new Vector3(
        shipPos.x,
        shipPos.y - HUD_CONFIG.OFFSET_Y,
        shipPos.z
      );

      // 2. Project to Normalized Device Coordinates (NDC)
      // Standard Three.js projection: Result is x/y between -1 and 1
      const vector = worldPos.clone().project(cameraRef.current);

      // 3. Visibility Check (Frustum Culling)
      // z > 1 means behind far plane, z < -1 means behind near plane
      // Usually checking if z < 1 (in front of far plane) and z > -1 (not clipped) is enough.
      const isVisible = vector.z < 1 && vector.z > -1;

      if (isVisible) {
        const vp = viewportRef.current;

        // 4. Convert NDC to Screen Pixels (Relative to the specific Viewport)
        const x = (vector.x * 0.5 + 0.5) * vp.width;
        const y = (vector.y * -0.5 + 0.5) * vp.height; // Flip Y for HTML

        // 5. Bounds Check (Is it actually inside the player's split screen?)
        if (x >= 0 && x <= vp.width && y >= 0 && y <= vp.height) {
          element.style.display = "block";
          element.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`;
        } else {
          element.style.display = "none";
        }
      } else {
        element.style.display = "none";
      }

      animId = requestAnimationFrame(updatePosition);
    };

    animId = requestAnimationFrame(updatePosition);
    return () => cancelAnimationFrame(animId);
  }, [controllerId, canvasElement]);

  return (
    <div
      ref={containerRef}
      className="absolute w-[80px] pointer-events-none select-none z-10"
      style={{
        display: "none", // Hidden by default, shown when visible
      }}
    >
      <HUDVisuals
        health={health}
        maxHealth={maxHealth}
        abilityIcon={ability?.icon}
        isAbilityActive={isAbilityActive}
        countdownCircleRef={countdownCircleRef}
        durationTextRef={durationTextRef}
      />
    </div>
  );
});

// ------------------------------------------------------------------
// 3. CONTAINER COMPONENT (Maps Players to Viewports)
// ------------------------------------------------------------------
export const PlayerHUDOverlay = memo(function PlayerHUDOverlay({
  canvasElement,
  cameras,
}: PlayerHUDOverlayProps) {
  const players = useGameStore((state) => state.players);

  // Don't render anything if no players
  if (players.length === 0 || !canvasElement) return null;

  // Get canvas dimensions for viewport positioning
  // Use getBoundingClientRect() to get CSS dimensions (viewport coords are in CSS pixels)
  const canvasRect = canvasElement.getBoundingClientRect();
  const canvasHeight = canvasRect.height;

  return (
    <>
      {players.map((player, index) => {
        const cameraData = cameras[index];
        if (!cameraData) return null;

        const { camera, viewport } = cameraData;

        // Convert WebGL viewport coordinates to HTML coordinates
        // WebGL: y=0 at bottom, HTML: y=0 at top
        // So we need to flip the y coordinate
        const htmlY = canvasHeight - viewport.y - viewport.height;

        return (
          <div
            key={player.controllerId}
            className="absolute pointer-events-none z-10"
            style={{
              left: `${viewport.x}px`,
              top: `${htmlY}px`,
              width: `${viewport.width}px`,
              height: `${viewport.height}px`,
            }}
          >
            <PlayerHUDItem
              controllerId={player.controllerId}
              canvasElement={canvasElement}
              viewport={viewport}
              camera={camera}
            />
          </div>
        );
      })}
    </>
  );
});

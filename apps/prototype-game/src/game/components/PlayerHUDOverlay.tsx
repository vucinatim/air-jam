import { useEffect, useRef, memo } from "react";
import { useHealthStore } from "../health-store";
import { useGameStore } from "../game-store";
import { useAbilitiesStore } from "../abilities-store";
import { shipPositions } from "./Ship";
import { Vector3 } from "three";
import type { PerspectiveCamera as ThreePerspectiveCamera } from "three";

interface PlayerHUDOverlayProps {
  canvasElement: HTMLCanvasElement | null;
  cameras: Array<{
    camera: ThreePerspectiveCamera;
    viewport: { x: number; y: number; width: number; height: number };
  }>;
}

const PlayerHUDItem = memo(function PlayerHUDItem({
  controllerId,
  canvasElement,
  viewport,
  camera,
}: {
  controllerId: string;
  canvasElement: HTMLCanvasElement | null;
  viewport: { x: number; y: number; width: number; height: number };
  camera: ThreePerspectiveCamera;
}) {
  const health = useHealthStore((state) => state.health[controllerId] ?? 100);
  const maxHealth = 100;
  const healthPercentage = (health / maxHealth) * 100;
  const ability = useAbilitiesStore((state) => state.getAbility(controllerId));
  const remainingDuration = useAbilitiesStore((state) =>
    state.getRemainingDuration(controllerId)
  );
  const isAbilityActive = useAbilitiesStore((state) =>
    state.isAbilityActive(controllerId)
  );
  const elementRef = useRef<HTMLDivElement>(null);
  const abilityIconRef = useRef<HTMLDivElement>(null);
  const abilityDurationRef = useRef<HTMLDivElement>(null);
  const animationFrameRef = useRef<number | undefined>(undefined);
  const durationTimerRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const cameraRef = useRef(camera);
  const viewportRef = useRef(viewport);

  // Determine health bar color based on health percentage
  const getHealthColor = () => {
    if (healthPercentage > 60) return "#22c55e"; // green
    if (healthPercentage > 30) return "#eab308"; // yellow
    return "#ef4444"; // red
  };

  // Update camera and viewport refs when they change (but don't trigger re-render)
  useEffect(() => {
    cameraRef.current = camera;
    viewportRef.current = viewport;
  }, [camera, viewport]);

  useEffect(() => {
    if (!canvasElement) return;

    const updatePosition = () => {
      const shipPos = shipPositions.get(controllerId);
      const element = elementRef.current;
      const currentCamera = cameraRef.current;
      const currentViewport = viewportRef.current;

      if (!shipPos || !element) {
        element?.style.setProperty("display", "none");
        animationFrameRef.current = requestAnimationFrame(updatePosition);
        return;
      }

      // World position 3 units below ship
      const worldPos = new Vector3(shipPos.x, shipPos.y - 3, shipPos.z);

      // Project world position to screen coordinates using THIS player's camera
      const vector = worldPos.clone().project(currentCamera);

      // Check if position is in front of camera (z between -1 and 1)
      if (vector.z > -1 && vector.z < 1) {
        // Convert normalized device coordinates to screen pixels
        // Position is relative to the viewport container (0,0 is top-left of container)
        const screenX = (vector.x * 0.5 + 0.5) * currentViewport.width;
        // Flip Y coordinate: WebGL has y=0 at bottom, HTML has y=0 at top
        // Make it relative to the viewport container
        const screenY = (vector.y * -0.5 + 0.5) * currentViewport.height;

        // Check if position is within viewport bounds (now relative to container)
        if (
          screenX >= 0 &&
          screenX <= currentViewport.width &&
          screenY >= 0 &&
          screenY <= currentViewport.height
        ) {
          // Direct DOM manipulation - no React re-render!
          // Position is relative to the container, not the full canvas
          element.style.left = `${screenX}px`;
          element.style.top = `${screenY}px`;
          element.style.display = "block";
        } else {
          // Ship is outside this player's viewport
          element.style.display = "none";
        }
      } else {
        // Ship is behind camera
        element.style.display = "none";
      }

      animationFrameRef.current = requestAnimationFrame(updatePosition);
    };

    animationFrameRef.current = requestAnimationFrame(updatePosition);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [controllerId, canvasElement]);

  // Update health bar fill width when health changes (only this triggers re-render)
  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    const healthBarFill = element.querySelector(
      ".health-bar-fill"
    ) as HTMLElement;
    const healthText = element.querySelector(".health-text") as HTMLElement;

    if (healthBarFill) {
      // Calculate color inline to avoid dependency issues
      const color =
        healthPercentage > 60
          ? "#22c55e"
          : healthPercentage > 30
          ? "#eab308"
          : "#ef4444";
      healthBarFill.style.width = `${healthPercentage}%`;
      healthBarFill.style.backgroundColor = color;
      healthBarFill.style.boxShadow = `0 0 8px ${color}`;
    }

    if (healthText) {
      healthText.textContent = `${Math.round(health)}/${maxHealth}`;
    }

    // Update ability UI - show icon if ability is in slot, show duration only if active
    if (abilityIconRef.current) {
      if (ability !== null) {
        abilityIconRef.current.textContent = ability.icon;
        abilityIconRef.current.style.display = "flex";
        // Show reduced opacity if not activated yet
        abilityIconRef.current.style.opacity = isAbilityActive ? "1" : "0.5";
      } else {
        abilityIconRef.current.style.display = "none";
      }
    }

    if (abilityDurationRef.current) {
      if (ability !== null && isAbilityActive) {
        const seconds = Math.ceil(remainingDuration);
        abilityDurationRef.current.textContent = `${seconds}s`;
        abilityDurationRef.current.style.display = "block";
      } else {
        abilityDurationRef.current.style.display = "none";
      }
    }
  }, [
    health,
    healthPercentage,
    maxHealth,
    ability,
    remainingDuration,
    isAbilityActive,
  ]);

  // Set up timer to update ability duration display every second
  useEffect(() => {
    if (!isAbilityActive || !ability) {
      // Clear timer if ability is not active
      if (durationTimerRef.current) {
        clearInterval(durationTimerRef.current);
        durationTimerRef.current = undefined;
      }
      return;
    }

    // Update duration immediately
    const updateDuration = () => {
      if (abilityDurationRef.current) {
        const store = useAbilitiesStore.getState();
        const currentRemaining = store.getRemainingDuration(controllerId);
        const seconds = Math.ceil(currentRemaining);
        abilityDurationRef.current.textContent = `${seconds}s`;

        // Hide if duration is 0 or less
        if (currentRemaining <= 0) {
          abilityDurationRef.current.style.display = "none";
        } else {
          abilityDurationRef.current.style.display = "block";
        }
      }
    };

    // Update immediately
    updateDuration();

    // Then update every second
    durationTimerRef.current = setInterval(updateDuration, 1000);

    return () => {
      if (durationTimerRef.current) {
        clearInterval(durationTimerRef.current);
        durationTimerRef.current = undefined;
      }
    };
  }, [controllerId, isAbilityActive, ability]);

  return (
    <div
      ref={elementRef}
      className="absolute -translate-x-1/2 -translate-y-1/2 w-[120px] pointer-events-none select-none z-10"
      style={{
        left: "0px",
        top: "0px",
        display: "none", // Hidden by default, shown when visible
      }}
    >
      {/* Health Bar Container */}
      <div className="relative w-full h-6 bg-white/20 rounded overflow-hidden mb-1">
        {/* Health Bar Fill */}
        <div
          className="health-bar-fill absolute opacity-50 inset-y-0 left-0 rounded transition-all duration-200 ease-out"
          style={{
            width: `${healthPercentage}%`,
            backgroundColor: getHealthColor(),
            boxShadow: `0 0 8px ${getHealthColor()}`,
          }}
        />
        {/* Health Text - Overlaid on top */}
        <div className="health-text absolute inset-0 flex items-center justify-center text-xs text-white font-mono font-bold [text-shadow:0_1px_2px_rgba(0,0,0,0.8)]">
          {Math.round(health)}/{maxHealth}
        </div>
      </div>

      {/* Ability Slot */}
      <div className="relative w-full h-8 bg-white/10 rounded overflow-hidden flex items-center justify-center">
        <div
          ref={abilityIconRef}
          className="text-lg flex items-center justify-center"
          style={{ display: "none" }}
        >
          {ability?.icon}
        </div>
        <div
          ref={abilityDurationRef}
          className="absolute bottom-0 left-0 right-0 text-[10px] text-white font-mono font-bold text-center [text-shadow:0_1px_2px_rgba(0,0,0,0.8)]"
          style={{ display: "none" }}
        >
          {Math.ceil(remainingDuration)}s
        </div>
      </div>
    </div>
  );
});

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

import { theOfficeTheme } from "../../game/theme";
/**
 * Game canvas component that handles all rendering.
 * Uses refs for game state to avoid re-renders during the game loop.
 */

import { useSimulationFrame } from "@air-jam/sdk";
import { memo, useCallback, useEffect, useRef, useState } from "react";
import { getPlayerById, PLAYERS } from "../../game/content/players";
import { BREAKROOM_LOCATIONS, LOCATIONS } from "../../game/domain/task-manager";
import {
  BOREDOM_BAR_COLOR,
  BOREDOM_BAR_LOW_COLOR,
  BREAKROOM_ACTIVE_COLOR,
  BREAKROOM_INACTIVE_COLOR,
  ENERGY_BAR_COLOR,
  ENERGY_BAR_LOW_COLOR,
  FIELD_HEIGHT,
  FIELD_WIDTH,
  LOCATION_ACTIVE_COLOR,
  LOCATION_COLOR,
  PADDING,
  PLAYER_COLORS,
  PLAYER_RADIUS,
  STAT_BAR_TRACK_COLOR,
  WALL_THICKNESS,
  WALLS,
} from "../../game/engine/office-layout";
import type { OfficeSimulationState } from "../../game/engine/office-simulation";
import { spaceStore } from "../../game/stores";

const loadImages = async (
  sources: { id: string; image?: string }[],
  into: Record<string, HTMLImageElement>,
) => {
  for (const source of sources) {
    if (!source.image || into[source.id]) continue;
    const image = new Image();
    image.src = source.image;
    await new Promise<void>((resolve) => {
      image.onload = () => resolve();
      image.onerror = () => resolve();
    });
    into[source.id] = image;
  }
};

/**
 * Draws a handdrawn/sketchy line on canvas.
 * Creates a wobbly effect using seeded random for consistency.
 */
function drawHanddrawnLine(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  thickness: number,
): void {
  // Seed random generator based on wall coordinates for consistency
  let seed = Math.floor(x1 * 1000 + y1 + x2 * 10 + y2 * 0.1) % 10000;
  const seededRandom = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };

  const length = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
  const segments = Math.max(3, Math.floor(length / 10));
  const roughness = 2;

  // Draw multiple passes for sketchy effect
  for (let pass = 0; pass < 2; pass++) {
    ctx.beginPath();
    ctx.lineWidth = thickness * (pass === 0 ? 1 : 0.7);

    // Start point with slight randomness
    const startOffsetX = (seededRandom() - 0.5) * roughness;
    const startOffsetY = (seededRandom() - 0.5) * roughness;
    ctx.moveTo(x1 + startOffsetX, y1 + startOffsetY);

    // Draw segments with wobble
    for (let i = 1; i <= segments; i++) {
      const t = i / segments;
      const baseX = x1 + (x2 - x1) * t;
      const baseY = y1 + (y2 - y1) * t;

      // Add random offset for handdrawn effect
      const offsetX = (seededRandom() - 0.5) * roughness;
      const offsetY = (seededRandom() - 0.5) * roughness;

      ctx.lineTo(baseX + offsetX, baseY + offsetY);
    }

    ctx.stroke();
  }
}

/** Draws the office floor from the simulation every display frame. */
export const GameCanvas = memo(function GameCanvas({
  players,
}: {
  players: { id: string }[];
}) {
  const playerImagesRef = useRef<Record<string, HTMLImageElement>>({});
  const locationImagesRef = useRef<Record<string, HTMLImageElement>>({});
  useEffect(() => {
    void loadImages(PLAYERS, playerImagesRef.current);
    void loadImages(
      [...LOCATIONS, ...BREAKROOM_LOCATIONS],
      locationImagesRef.current,
    );
  }, []);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const [canvasSize, setCanvasSize] = useState({
    width: FIELD_WIDTH,
    height: FIELD_HEIGHT,
  });

  // Handle canvas resize
  useEffect(() => {
    const container = canvasContainerRef.current;
    if (!container) return;

    const updateSize = () => {
      const rect = container.getBoundingClientRect();
      const aspectRatio = FIELD_WIDTH / FIELD_HEIGHT;

      let width = rect.width;
      let height = width / aspectRatio;

      if (height > rect.height) {
        height = rect.height;
        width = height * aspectRatio;
      }

      setCanvasSize({
        width: Math.floor(width),
        height: Math.floor(height),
      });
    };

    updateSize();

    const resizeObserver = new ResizeObserver(updateSize);
    resizeObserver.observe(container);

    window.addEventListener("resize", updateSize);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", updateSize);
    };
  }, []);

  // Render function
  const render = useCallback(
    (ctx: CanvasRenderingContext2D, sim: OfficeSimulationState) => {
      const canvas = canvasRef.current;
      const { playerAssignments, playerStats } = spaceStore.getState();
      if (!canvas) return;

      const { width: displayWidth, height: displayHeight } = canvasSize;
      const gameWidth = FIELD_WIDTH + PADDING * 2;
      const gameHeight = FIELD_HEIGHT + PADDING * 2;
      const dpr = window.devicePixelRatio || 1;

      // Setup canvas size and scaling
      canvas.width = displayWidth * dpr;
      canvas.height = displayHeight * dpr;
      canvas.style.width = `${displayWidth}px`;
      canvas.style.height = `${displayHeight}px`;

      const scaleX = displayWidth / gameWidth;
      const scaleY = displayHeight / gameHeight;

      ctx.setTransform(dpr * scaleX, 0, 0, dpr * scaleY, PADDING, PADDING);

      // Clear and draw background
      ctx.clearRect(-PADDING, -PADDING, gameWidth, gameHeight);

      // Draw walls - handdrawn style
      ctx.strokeStyle = theOfficeTheme.colors.black;
      ctx.lineCap = "round";
      WALLS.forEach((wall) => {
        drawHanddrawnLine(
          ctx,
          wall.x1,
          wall.y1,
          wall.x2,
          wall.y2,
          WALL_THICKNESS,
        );
      });

      // Draw work locations
      LOCATIONS.forEach((location) => {
        const hasTask = sim.tasks.hasTaskAt(location.id);
        const locationImage = locationImagesRef.current[location.id];

        if (locationImage) {
          // Draw yellow radial gradient when active - use shorter dimension for proportional glow
          if (hasTask) {
            const centerX = location.x + location.width / 2;
            const centerY = location.y + location.height / 2;
            const radius = Math.min(location.width, location.height) / 2 + 15;
            const gradient = ctx.createRadialGradient(
              centerX,
              centerY,
              0,
              centerX,
              centerY,
              radius,
            );
            gradient.addColorStop(0, theOfficeTheme.colors.playerGlow);
            gradient.addColorStop(
              1,
              theOfficeTheme.colors.playerGlowTransparent,
            );
            ctx.fillStyle = gradient;
            ctx.fillRect(
              location.x - 10,
              location.y - 10,
              location.width + 20,
              location.height + 20,
            );
          }
          // Draw location image
          ctx.drawImage(
            locationImage,
            location.x,
            location.y,
            location.width,
            location.height,
          );
        } else {
          // Draw square box (existing behavior)
          ctx.fillStyle = hasTask ? LOCATION_ACTIVE_COLOR : LOCATION_COLOR;
          ctx.fillRect(location.x, location.y, location.width, location.height);
        }
      });

      // Draw breakroom locations
      BREAKROOM_LOCATIONS.forEach((location) => {
        const activity = sim.breaks;
        const hasActivity = Object.values(activity).some(
          (a) => a && a.locationId === location.id,
        );
        const locationImage = locationImagesRef.current[location.id];

        if (locationImage) {
          // Draw yellow radial gradient when active - use shorter dimension for proportional glow
          if (hasActivity) {
            const centerX = location.x + location.width / 2;
            const centerY = location.y + location.height / 2;
            const radius = Math.min(location.width, location.height) / 2 + 15;
            const gradient = ctx.createRadialGradient(
              centerX,
              centerY,
              0,
              centerX,
              centerY,
              radius,
            );
            gradient.addColorStop(0, theOfficeTheme.colors.playerGlow);
            gradient.addColorStop(
              1,
              theOfficeTheme.colors.playerGlowTransparent,
            );
            ctx.fillStyle = gradient;
            ctx.fillRect(
              location.x - 10,
              location.y - 10,
              location.width + 20,
              location.height + 20,
            );
          }
          // Draw location image
          ctx.drawImage(
            locationImage,
            location.x,
            location.y,
            location.width,
            location.height,
          );
        } else {
          // Breakroom: warm terracotta / muted orange palette
          ctx.fillStyle = hasActivity
            ? BREAKROOM_ACTIVE_COLOR
            : BREAKROOM_INACTIVE_COLOR;
          ctx.fillRect(location.x, location.y, location.width, location.height);
        }
      });

      // Draw players
      players.forEach((p, index) => {
        const pos = sim.positions[p.id];
        if (!pos) return;

        const playerId = playerAssignments[p.id];
        const player = playerId ? getPlayerById(playerId) : null;
        const playerImage = playerId ? playerImagesRef.current[playerId] : null;
        const stats = playerStats[p.id];
        const isDead = stats && !stats.alive;

        // Apply grayscale filter for dead players
        if (isDead) {
          ctx.save();
          ctx.filter = "grayscale(100%)";
        }

        // Draw player circle
        ctx.fillStyle = PLAYER_COLORS[index % PLAYER_COLORS.length];
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, PLAYER_RADIUS, 0, Math.PI * 2);
        ctx.fill();

        // Draw player image or initials
        if (playerImage) {
          const imgSize = PLAYER_RADIUS * 2;
          ctx.save();
          ctx.beginPath();
          ctx.arc(pos.x, pos.y, PLAYER_RADIUS, 0, Math.PI * 2);
          ctx.closePath();
          ctx.clip();

          const srcW = playerImage.naturalWidth;
          const srcH = playerImage.naturalHeight;
          const srcSize = Math.min(srcW, srcH);
          const srcX = (srcW - srcSize) / 2;
          const srcY = (srcH - srcSize) / 2;

          ctx.drawImage(
            playerImage,
            srcX,
            srcY,
            srcSize,
            srcSize,
            pos.x - PLAYER_RADIUS,
            pos.y - PLAYER_RADIUS,
            imgSize,
            imgSize,
          );
          ctx.restore();
        } else {
          const initials = player?.name?.charAt(0) || "?";
          ctx.font = `bold 14px ${theOfficeTheme.fonts.canvas}`;
          ctx.fillStyle = theOfficeTheme.colors.white;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(initials, pos.x, pos.y);
        }

        // Restore from grayscale if dead
        if (isDead) {
          ctx.restore();
          return; // Skip stat bars for dead players
        }

        const matchElapsedMs = sim.elapsedMs;
        const taskProgress = sim.tasks.getTaskProgress(p.id, matchElapsedMs);
        const breakroomActivity = sim.breaks[p.id];

        // Calculate unified progress (breakroom takes priority)
        let unifiedProgress = 0;
        if (breakroomActivity) {
          const elapsed = matchElapsedMs - breakroomActivity.startTime;
          unifiedProgress = Math.min(
            elapsed / sim.settings.breakroomActivityDurationMs,
            1,
          );
        } else if (taskProgress > 0) {
          unifiedProgress = taskProgress;
        }

        // Start position above player for progress bars
        let currentBarY = pos.y - PLAYER_RADIUS - 20;

        // Draw unified progress bar (green for both tasks and breakroom activities)
        if (unifiedProgress > 0) {
          const barWidth = 40;
          const barHeight = 6;
          const barX = pos.x - barWidth / 2;

          ctx.fillStyle = STAT_BAR_TRACK_COLOR;
          ctx.fillRect(barX, currentBarY, barWidth, barHeight);

          ctx.fillStyle = LOCATION_ACTIVE_COLOR;
          ctx.fillRect(
            barX,
            currentBarY,
            barWidth * unifiedProgress,
            barHeight,
          );

          currentBarY += barHeight + 4;
        }

        // Draw player stat arcs around the player (only for alive players)
        if (stats?.alive) {
          const arcRadius = PLAYER_RADIUS + 6;
          const arcWidth = 3;

          // Energy arc - left side (135° to 225°), depletes downward
          ctx.beginPath();
          ctx.arc(
            pos.x,
            pos.y,
            arcRadius,
            Math.PI * 0.75,
            Math.PI * 1.25,
            false,
          );
          ctx.lineWidth = arcWidth;
          ctx.strokeStyle = STAT_BAR_TRACK_COLOR;
          ctx.stroke();

          // Energy fill - depletes from top (100%) toward bottom (0%)
          const energyArcLength = Math.PI * 0.5; // 90 degrees
          const energyEmptyPortion = energyArcLength * (1 - stats.energy / 100);
          const energyStart = Math.PI * 0.75 + energyEmptyPortion;
          ctx.beginPath();
          ctx.arc(pos.x, pos.y, arcRadius, energyStart, Math.PI * 1.25, false);
          ctx.strokeStyle =
            stats.energy > 30 ? ENERGY_BAR_COLOR : ENERGY_BAR_LOW_COLOR;
          ctx.stroke();

          // Boredom arc - right side (315° to 45°), depletes downward
          ctx.beginPath();
          ctx.arc(
            pos.x,
            pos.y,
            arcRadius,
            Math.PI * 1.75,
            Math.PI * 2.25,
            false,
          );
          ctx.lineWidth = arcWidth;
          ctx.strokeStyle = STAT_BAR_TRACK_COLOR;
          ctx.stroke();

          // Boredom fill - depletes from top (100%) toward bottom (0%)
          const boredomArcLength = Math.PI * 0.5; // 90 degrees
          const boredomEmptyPortion =
            boredomArcLength * (1 - stats.boredom / 100);
          const boredomStart = Math.PI * 1.75 + boredomEmptyPortion;
          ctx.beginPath();
          ctx.arc(pos.x, pos.y, arcRadius, boredomStart, Math.PI * 2.25, false);
          ctx.strokeStyle =
            stats.boredom > 30 ? BOREDOM_BAR_COLOR : BOREDOM_BAR_LOW_COLOR;
          ctx.stroke();
        }
      });
    },
    [canvasSize, players],
  );

  useSimulationFrame<OfficeSimulationState>(({ sim }) => {
    const ctx = canvasRef.current?.getContext("2d");
    if (ctx) render(ctx, sim);
  });

  return (
    <div ref={canvasContainerRef} className="relative h-full w-full">
      <canvas
        ref={canvasRef}
        className="absolute top-1/2 left-1/2 block -translate-x-1/2 -translate-y-1/2"
      />
    </div>
  );
});

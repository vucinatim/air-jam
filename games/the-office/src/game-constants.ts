/**
 * Game constants, geometry functions, and collision detection utilities.
 * Extracted from the main host view for better maintainability.
 */

import { LOCATIONS, type Location } from "./task-manager";

// Field dimensions
export const FIELD_WIDTH = 800;
export const FIELD_HEIGHT = 600;
export const PADDING = 8;
export const PLAYER_RADIUS = 20;
export const TAG_RANGE = 60;
export const PLAYER_SPEED = 5;
export const WALL_THICKNESS = 12;

// Colors
export const WALL_COLOR = "#b5a07a"; // warm sandy wall
export const LOCATION_COLOR = "#d4b896"; // warm tan for inactive locations
export const LOCATION_ACTIVE_COLOR = "#6aaa64"; // muted green for active tasks
export const PLAYER_COLORS = [
  "#e6a817",
  "#5b9bd5",
  "#6aaa64",
  "#c97dd4",
  "#e06060",
];

/** Predefined spawn positions for up to 9 players (only one player per position) */
export const SPAWN_POSITIONS: { x: number; y: number }[] = [
  { x: 100, y: 350 },
  { x: 200, y: 220 },
  { x: 520, y: 100 },
  { x: 560, y: 500 },
  { x: 700, y: 350 },
  { x: 600, y: 180 },
  { x: 250, y: 550 },
  { x: 420, y: 550 },
  { x: 400, y: 360 },
];

// Canvas background
export const CANVAS_BG_COLOR = "#ebebf0";

// Breakroom colors
export const BREAKROOM_ACTIVE_COLOR = "#e8936a";
export const BREAKROOM_INACTIVE_COLOR = "#c4855a";

// Stat bar colors
export const STAT_BAR_TRACK_COLOR = "#d6c8b0";
export const ENERGY_BAR_COLOR = "#d46060";
export const ENERGY_BAR_LOW_COLOR = "#a03030";
export const BOREDOM_BAR_COLOR = "#5b9bd5";
export const BOREDOM_BAR_LOW_COLOR = "#3a7bb5";

// Wall interface
export interface Wall {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

// SVG coordinate mapping constants
const SVG_MIN_X = 41.8;
const SVG_MAX_X = 569.5;
const SVG_MIN_Y = 138.8;
const SVG_MAX_Y = 654.9;
const SVG_WIDTH = SVG_MAX_X - SVG_MIN_X;
const SVG_HEIGHT = SVG_MAX_Y - SVG_MIN_Y;

/**
 * Maps SVG X coordinate to game field X coordinate.
 */
export function mapX(svgX: number): number {
  return ((svgX - SVG_MIN_X) / SVG_WIDTH) * FIELD_WIDTH;
}

/**
 * Maps SVG Y coordinate to game field Y coordinate.
 */
export function mapY(svgY: number): number {
  return ((svgY - SVG_MIN_Y) / SVG_HEIGHT) * FIELD_HEIGHT;
}

/**
 * Creates a wall from SVG coordinates.
 */
export function svgWall(x1: number, y1: number, x2: number, y2: number): Wall {
  return { x1: mapX(x1), y1: mapY(y1), x2: mapX(x2), y2: mapY(y2) };
}

/** Walls extracted from layout.svg Layer_2 */
export const WALLS: Wall[] = [
  // Top wall
  svgWall(41.8, 142, 569.5, 142),
  // Left wall (top to mid-horizontal)
  svgWall(41.8, 142, 41.8, 497.1),
  // Right wall (full height)
  svgWall(569.5, 142, 569.5, 654.9),
  // Bottom wall (right section)
  svgWall(156.3, 654.5, 569.5, 654.5),
  // Inner left vertical (bottom section)
  svgWall(156.3, 497.1, 156.3, 654.5),
  // Inner horizontal left (upper)
  svgWall(41.8, 497.1, 68.1, 497.1),
  svgWall(120.8, 497.1, 191.1, 497.1),
  // Middle horizontal segment (conference room wall)
  svgWall(261.2, 404.8, 334.1, 404.8),
  // Middle vertical bottom part
  svgWall(297.6, 329.6, 297.6, 404.8),
  // Middle vertical top part
  svgWall(297.6, 250.8, 297.6, 142),
  // Lower middle horizontal
  svgWall(260.6, 497.1, 371.9, 497.1),
  // Lower right inner vertical
  svgWall(371.9, 654.5, 371.9, 497.1),
  // Left horizontal at ~408 (door gap between this and right side)
  svgWall(41.8, 407.9, 191.1, 407.9),
  // Right horizontal at ~408
  svgWall(385.9, 407.9, 569.5, 407.9),
];

/**
 * Returns the shortest distance from a point to a line segment.
 */
export function distanceToSegment(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) {
    const ex = px - x1;
    const ey = py - y1;
    return Math.sqrt(ex * ex + ey * ey);
  }
  let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const closestX = x1 + t * dx;
  const closestY = y1 + t * dy;
  const ex = px - closestX;
  const ey = py - closestY;
  return Math.sqrt(ex * ex + ey * ey);
}

/**
 * Checks if a circle intersects with a wall segment.
 */
export function circleIntersectsWall(
  cx: number,
  cy: number,
  radius: number,
  wall: Wall,
): boolean {
  const dist = distanceToSegment(cx, cy, wall.x1, wall.y1, wall.x2, wall.y2);
  return dist < radius + WALL_THICKNESS / 2;
}

/**
 * Checks if a circle intersects with a rectangle.
 */
export function circleIntersectsRect(
  cx: number,
  cy: number,
  radius: number,
  rect: { x: number; y: number; width: number; height: number },
): boolean {
  const closestX = Math.max(rect.x, Math.min(cx, rect.x + rect.width));
  const closestY = Math.max(rect.y, Math.min(cy, rect.y + rect.height));
  const dx = cx - closestX;
  const dy = cy - closestY;
  return dx * dx + dy * dy < radius * radius;
}

/**
 * Checks if a position is valid (within bounds and not colliding with walls or locations).
 */
export function isValidPosition(x: number, y: number, radius: number): boolean {
  if (x - radius < 0 || x + radius > FIELD_WIDTH) return false;
  if (y - radius < 0 || y + radius > FIELD_HEIGHT) return false;
  for (const wall of WALLS) {
    if (circleIntersectsWall(x, y, radius, wall)) return false;
  }
  for (const loc of LOCATIONS) {
    if (circleIntersectsRect(x, y, radius, loc)) return false;
  }
  return true;
}

/**
 * Checks if a point is near a location.
 */
export function isNearLocation(
  x: number,
  y: number,
  locationId: string,
  locations: Location[],
): boolean {
  const location = locations.find((l) => l.id === locationId);
  if (!location) return false;
  const centerX = location.x + location.width / 2;
  const centerY = location.y + location.height / 2;
  const dist = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);
  return dist < TAG_RANGE + Math.max(location.width, location.height) / 2;
}

/**
 * Checks if two circles overlap.
 */
export function circlesOverlap(
  x1: number,
  y1: number,
  r1: number,
  x2: number,
  y2: number,
  r2: number,
): boolean {
  const dx = x1 - x2;
  const dy = y1 - y2;
  const dist = Math.sqrt(dx * dx + dy * dy);
  return dist < r1 + r2;
}

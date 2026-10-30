import { officeSettings } from "../game/contracts/settings";
import {
  BREAKROOM_LOCATIONS,
  LOCATIONS,
  type Location,
} from "../game/domain/task-manager";
import {
  FIELD_HEIGHT,
  FIELD_WIDTH,
  isNearLocation,
  isValidPosition,
  PLAYER_RADIUS,
} from "../game/engine/office-layout";

/**
 * Walking routes through the office for test players. The host moves a
 * coworker in straight steps and slides along walls, so a straight line to a
 * desk often dead-ends; players instead follow a shortest path over a grid of
 * walkable cells built from the game's own collision rule.
 */
const CELL = 10;
const COLUMNS = Math.floor(FIELD_WIDTH / CELL);
const ROWS = Math.floor(FIELD_HEIGHT / CELL);
const SIMULATION_STEPS_PER_SECOND = 60;
/** Spacing of the collision samples along a straight walk. */
const SAMPLE_STEP = 4;

export const ALL_LOCATIONS: Location[] = [...LOCATIONS, ...BREAKROOM_LOCATIONS];

const centre = (cell: number) => ({
  x: (cell % COLUMNS) * CELL + CELL / 2,
  y: Math.floor(cell / COLUMNS) * CELL + CELL / 2,
});
let walkable: boolean[] | undefined;
function walkableCells() {
  walkable ??= Array.from({ length: COLUMNS * ROWS }, (_, cell) => {
    const { x, y } = centre(cell);
    return isValidPosition(x, y, PLAYER_RADIUS);
  });
  return walkable;
}
function nearestWalkable(x: number, y: number) {
  const cells = walkableCells();
  let best = -1;
  let bestDistance = Infinity;
  for (let cell = 0; cell < cells.length; cell++) {
    if (!cells[cell]) continue;
    const point = centre(cell);
    const distance = (point.x - x) ** 2 + (point.y - y) ** 2;
    if (distance < bestDistance) {
      best = cell;
      bestDistance = distance;
    }
  }
  return best;
}

/** Whether a coworker can walk straight from one point to another. */
function clear(from: { x: number; y: number }, to: { x: number; y: number }) {
  const length = Math.hypot(to.x - from.x, to.y - from.y);
  const samples = Math.max(1, Math.ceil(length / SAMPLE_STEP));
  for (let sample = 1; sample <= samples; sample++) {
    const share = sample / samples;
    if (
      !isValidPosition(
        from.x + (to.x - from.x) * share,
        from.y + (to.y - from.y) * share,
        PLAYER_RADIUS,
      )
    )
      return false;
  }
  return true;
}

export type Route = {
  /** Already close enough to use the location. */
  arrived: boolean;
  /** Unit movement towards the next cell of the shortest walk, when not arrived. */
  movementX: number;
  movementY: number;
  /** Walking time along the route at full speed. */
  seconds: number;
};

/** The shortest walk from a position to anywhere a location can be used from. */
export function routeTo(
  from: { x: number; y: number },
  locationId: string,
): Route | null {
  if (isNearLocation(from.x, from.y, locationId, ALL_LOCATIONS))
    return { arrived: true, movementX: 0, movementY: 0, seconds: 0 };
  const cells = walkableCells();
  const start = nearestWalkable(from.x, from.y);
  if (start < 0) return null;
  const previous = new Int32Array(cells.length).fill(-2);
  previous[start] = -1;
  const queue = [start];
  for (let head = 0; head < queue.length; head++) {
    const cell = queue[head];
    const point = centre(cell);
    if (isNearLocation(point.x, point.y, locationId, ALL_LOCATIONS)) {
      const path = [cell];
      while (previous[path[0]] >= 0) path.unshift(previous[path[0]]);
      // Head for the farthest point of the path reachable in a straight line,
      // so a direction held for a whole decision never cuts into a wall.
      let aim = centre(path[0]);
      for (let index = path.length - 1; index > 0; index--)
        if (clear(from, centre(path[index]))) {
          aim = centre(path[index]);
          break;
        }
      const dx = aim.x - from.x;
      const dy = aim.y - from.y;
      const length = Math.hypot(dx, dy) || 1;
      return {
        arrived: false,
        movementX: dx / length,
        movementY: dy / length,
        seconds:
          (path.length * CELL) /
          (officeSettings.playerSpeed.default * SIMULATION_STEPS_PER_SECOND),
      };
    }
    const column = cell % COLUMNS;
    for (const next of [
      column > 0 ? cell - 1 : -1,
      column < COLUMNS - 1 ? cell + 1 : -1,
      cell - COLUMNS,
      cell + COLUMNS,
    ])
      if (
        next >= 0 &&
        next < cells.length &&
        cells[next] &&
        previous[next] === -2
      ) {
        previous[next] = cell;
        queue.push(next);
      }
  }
  return null;
}

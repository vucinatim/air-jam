interface Point {
  x: number;
  y: number;
}

/** Recover pad-local coordinates after SurfaceViewport rotation and scaling. */
export function resolvePadDirection(
  point: Point,
  origin: Point,
  right: Point,
  bottom: Point,
): Point {
  const xAxis = { x: right.x - origin.x, y: right.y - origin.y };
  const yAxis = { x: bottom.x - origin.x, y: bottom.y - origin.y };
  const determinant = xAxis.x * yAxis.y - xAxis.y * yAxis.x;
  if (!Number.isFinite(determinant) || Math.abs(determinant) < 0.001)
    return { x: 0, y: 0 };

  const offset = { x: point.x - origin.x, y: point.y - origin.y };
  const x = (2 * (offset.x * yAxis.y - offset.y * yAxis.x)) / determinant - 1;
  const y = (2 * (xAxis.x * offset.y - xAxis.y * offset.x)) / determinant - 1;
  if (Math.max(Math.abs(x), Math.abs(y)) < 0.22) return { x: 0, y: 0 };
  return Math.abs(x) > Math.abs(y)
    ? { x: x > 0 ? 1 : -1, y: 0 }
    : { x: 0, y: y > 0 ? 1 : -1 };
}

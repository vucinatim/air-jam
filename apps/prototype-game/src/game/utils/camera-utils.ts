export type Viewport = { x: number; y: number; width: number; height: number };

export function computeViewports(
  count: number,
  width: number,
  height: number
): Viewport[] {
  if (count <= 1) {
    return [{ x: 0, y: 0, width, height }];
  }
  if (count === 2) {
    return [
      { x: 0, y: height / 2, width, height: height / 2 }, // top
      { x: 0, y: 0, width, height: height / 2 }, // bottom
    ];
  }
  // 3 or 4 => 2x2 grid; last slot empty if only 3 players
  const halfW = width / 2;
  const halfH = height / 2;
  return [
    { x: 0, y: halfH, width: halfW, height: halfH }, // top-left
    { x: halfW, y: halfH, width: halfW, height: halfH }, // top-right
    { x: 0, y: 0, width: halfW, height: halfH }, // bottom-left
    { x: halfW, y: 0, width: halfW, height: halfH }, // bottom-right
  ].slice(0, count);
}








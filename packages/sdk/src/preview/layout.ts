export const PREVIEW_WORKSPACE_Z_INDEX = 2_147_483_000;

export const PREVIEW_WINDOW_WIDTH = 312;
export const PREVIEW_WINDOW_HEIGHT = 554;
export const PREVIEW_WINDOW_MIN_WIDTH = 260;
export const PREVIEW_WINDOW_MIN_HEIGHT = 440;
export const PREVIEW_WINDOW_MAX_WIDTH = 480;
export const PREVIEW_WINDOW_MAX_HEIGHT = 860;
export const PREVIEW_WINDOW_TITLEBAR_HEIGHT = 38;
export const PREVIEW_WINDOW_RESIZE_EDGE_HIT_SIZE = 12;
export const PREVIEW_WINDOW_RESIZE_CORNER_HIT_SIZE = 20;

export type PreviewControllerResizeHandle =
  | "n"
  | "s"
  | "e"
  | "w"
  | "ne"
  | "nw"
  | "se"
  | "sw";

export interface PreviewControllerBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const getResizedPreviewBounds = (
  bounds: PreviewControllerBounds,
  handle: PreviewControllerResizeHandle,
  deltaX: number,
  deltaY: number,
): PreviewControllerBounds => {
  const resizingWest = handle.includes("w");
  const resizingEast = handle.includes("e");
  const resizingNorth = handle.includes("n");
  const resizingSouth = handle.includes("s");

  return {
    x: resizingWest ? bounds.x + deltaX : bounds.x,
    y: resizingNorth ? bounds.y + deltaY : bounds.y,
    width:
      bounds.width +
      (resizingEast ? deltaX : 0) -
      (resizingWest ? deltaX : 0),
    height:
      bounds.height +
      (resizingSouth ? deltaY : 0) -
      (resizingNorth ? deltaY : 0),
  };
};

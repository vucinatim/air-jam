import type { ControllerOrientation } from "../protocol/controller";

export const PREVIEW_WORKSPACE_Z_INDEX = 2_147_483_000;

export const PREVIEW_WINDOW_DEFAULT_BOUNDS: Record<
  ControllerOrientation,
  { width: number; height: number }
> = {
  portrait: {
    width: 312,
    height: 554,
  },
  landscape: {
    width: 554,
    height: 312,
  },
};

export const PREVIEW_WINDOW_SIZE_CONSTRAINTS: Record<
  ControllerOrientation,
  {
    minWidth: number;
    minHeight: number;
    maxWidth: number;
    maxHeight: number;
  }
> = {
  portrait: {
    minWidth: 260,
    minHeight: 440,
    maxWidth: 480,
    maxHeight: 860,
  },
  landscape: {
    minWidth: 440,
    minHeight: 260,
    maxWidth: 860,
    maxHeight: 480,
  },
};
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

export const getDefaultPreviewWindowBounds = (
  orientation: ControllerOrientation,
) => PREVIEW_WINDOW_DEFAULT_BOUNDS[orientation];

export const getPreviewWindowSizeConstraints = (
  orientation: ControllerOrientation,
) => PREVIEW_WINDOW_SIZE_CONSTRAINTS[orientation];

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
      bounds.width + (resizingEast ? deltaX : 0) - (resizingWest ? deltaX : 0),
    height:
      bounds.height +
      (resizingSouth ? deltaY : 0) -
      (resizingNorth ? deltaY : 0),
  };
};

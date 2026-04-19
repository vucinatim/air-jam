import type { ControllerOrientation } from "../protocol/controller";

export const PREVIEW_WORKSPACE_Z_INDEX = 2_147_483_000;
export const PREVIEW_WINDOW_TITLEBAR_HEIGHT = 38;
export const PREVIEW_WINDOW_RESIZE_EDGE_HIT_SIZE = 12;
export const PREVIEW_WINDOW_RESIZE_CORNER_HIT_SIZE = 20;

export interface PreviewControllerDeviceProfile {
  id: string;
  label: string;
  portrait: { width: number; height: number };
}

export const IPHONE_16_PREVIEW_DEVICE: PreviewControllerDeviceProfile = {
  id: "iphone-16",
  label: "iPhone 16 browser",
  portrait: {
    width: 393,
    height: 740,
  },
};

export const DEFAULT_PREVIEW_CONTROLLER_DEVICE = IPHONE_16_PREVIEW_DEVICE;
export const DEFAULT_PREVIEW_CONTROLLER_SCALE = 0.8;
export const PREVIEW_CONTROLLER_MIN_SCALE = 0.55;
export const PREVIEW_CONTROLLER_MAX_SCALE = 1.12;

export const getPreviewControllerViewportSize = (
  orientation: ControllerOrientation,
  device: PreviewControllerDeviceProfile = DEFAULT_PREVIEW_CONTROLLER_DEVICE,
) =>
  orientation === "portrait"
    ? device.portrait
    : {
        width: device.portrait.height,
        height: device.portrait.width,
      };

export const getPreviewControllerScaleConstraints = () => ({
  min: PREVIEW_CONTROLLER_MIN_SCALE,
  max: PREVIEW_CONTROLLER_MAX_SCALE,
});

export const getPreviewWindowBoundsForScale = (
  orientation: ControllerOrientation,
  scale: number,
  device: PreviewControllerDeviceProfile = DEFAULT_PREVIEW_CONTROLLER_DEVICE,
) => {
  const viewport = getPreviewControllerViewportSize(orientation, device);
  return {
    width: viewport.width * scale,
    height: PREVIEW_WINDOW_TITLEBAR_HEIGHT + viewport.height * scale,
  };
};

export const getPreviewControllerScaleForBounds = (
  orientation: ControllerOrientation,
  bounds: { width: number; height: number },
  mode: "grow" | "shrink" | "fit" = "fit",
  device: PreviewControllerDeviceProfile = DEFAULT_PREVIEW_CONTROLLER_DEVICE,
): number => {
  const viewport = getPreviewControllerViewportSize(orientation, device);
  const widthScale = bounds.width / viewport.width;
  const heightScale =
    (bounds.height - PREVIEW_WINDOW_TITLEBAR_HEIGHT) / viewport.height;
  const rawScale =
    mode === "grow"
      ? Math.max(widthScale, heightScale)
      : mode === "shrink"
        ? Math.min(widthScale, heightScale)
        : Math.min(widthScale, heightScale);
  const constraints = getPreviewControllerScaleConstraints();

  return Math.min(Math.max(rawScale, constraints.min), constraints.max);
};

export const getPreviewControllerScaleForResize = ({
  orientation,
  bounds,
  originBounds,
  handle,
  device = DEFAULT_PREVIEW_CONTROLLER_DEVICE,
}: {
  orientation: ControllerOrientation;
  bounds: { width: number; height: number };
  originBounds: { width: number; height: number };
  handle: PreviewControllerResizeHandle;
  device?: PreviewControllerDeviceProfile;
}): number => {
  const viewport = getPreviewControllerViewportSize(orientation, device);
  const widthScale = bounds.width / viewport.width;
  const heightScale =
    (bounds.height - PREVIEW_WINDOW_TITLEBAR_HEIGHT) / viewport.height;

  if (handle === "e" || handle === "w") {
    const constraints = getPreviewControllerScaleConstraints();
    return Math.min(Math.max(widthScale, constraints.min), constraints.max);
  }

  if (handle === "n" || handle === "s") {
    const constraints = getPreviewControllerScaleConstraints();
    return Math.min(Math.max(heightScale, constraints.min), constraints.max);
  }

  const widthDelta = Math.abs(bounds.width - originBounds.width);
  const heightDelta = Math.abs(bounds.height - originBounds.height);
  const rawScale =
    widthDelta / viewport.width >= heightDelta / viewport.height
      ? widthScale
      : heightScale;
  const constraints = getPreviewControllerScaleConstraints();

  return Math.min(Math.max(rawScale, constraints.min), constraints.max);
};

export const PREVIEW_WINDOW_DEFAULT_BOUNDS: Record<
  ControllerOrientation,
  { width: number; height: number }
> = {
  portrait: getPreviewWindowBoundsForScale(
    "portrait",
    DEFAULT_PREVIEW_CONTROLLER_SCALE,
  ),
  landscape: getPreviewWindowBoundsForScale(
    "landscape",
    DEFAULT_PREVIEW_CONTROLLER_SCALE,
  ),
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
    minWidth: getPreviewWindowBoundsForScale(
      "portrait",
      PREVIEW_CONTROLLER_MIN_SCALE,
    ).width,
    minHeight: getPreviewWindowBoundsForScale(
      "portrait",
      PREVIEW_CONTROLLER_MIN_SCALE,
    ).height,
    maxWidth: getPreviewWindowBoundsForScale(
      "portrait",
      PREVIEW_CONTROLLER_MAX_SCALE,
    ).width,
    maxHeight: getPreviewWindowBoundsForScale(
      "portrait",
      PREVIEW_CONTROLLER_MAX_SCALE,
    ).height,
  },
  landscape: {
    minWidth: getPreviewWindowBoundsForScale(
      "landscape",
      PREVIEW_CONTROLLER_MIN_SCALE,
    ).width,
    minHeight: getPreviewWindowBoundsForScale(
      "landscape",
      PREVIEW_CONTROLLER_MIN_SCALE,
    ).height,
    maxWidth: getPreviewWindowBoundsForScale(
      "landscape",
      PREVIEW_CONTROLLER_MAX_SCALE,
    ).width,
    maxHeight: getPreviewWindowBoundsForScale(
      "landscape",
      PREVIEW_CONTROLLER_MAX_SCALE,
    ).height,
  },
};

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

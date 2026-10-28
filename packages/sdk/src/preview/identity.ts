import { generateControllerId } from "../utils/ids";

export const AIR_JAM_PREVIEW_FLAG_QUERY_PARAM = "aj_preview";
export const AIR_JAM_PREVIEW_DEVICE_QUERY_PARAM = "aj_preview_device";
export const AIR_JAM_PREVIEW_PARENT_QUERY_PARAM = "aj_preview_parent";

export interface PreviewControllerIdentity {
  controllerId: string;
  deviceId: string;
}

const generatePreviewDeviceId = (): string => {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return `pd_${crypto.randomUUID()}`;
  }

  return `pd_${generateControllerId()}_${Date.now().toString(36)}`;
};

export const createPreviewControllerIdentity =
  (): PreviewControllerIdentity => ({
    controllerId: generateControllerId(),
    deviceId: generatePreviewDeviceId(),
  });

export const normalizePreviewDeviceId = (
  value: string | null | undefined,
): string | null => {
  if (!value) {
    return null;
  }

  const normalized = value.trim();
  return normalized.length >= 8 ? normalized : null;
};

export const isPreviewControllerSearchParams = (
  params: URLSearchParams,
): boolean => {
  const flag = params.get(AIR_JAM_PREVIEW_FLAG_QUERY_PARAM);
  return flag === "1" || flag === "true";
};

export const readPreviewControllerDeviceIdFromSearchParams = (
  params: URLSearchParams,
): string | null => {
  if (!isPreviewControllerSearchParams(params)) {
    return null;
  }

  return normalizePreviewDeviceId(
    params.get(AIR_JAM_PREVIEW_DEVICE_QUERY_PARAM),
  );
};

export const readPreviewControllerDeviceIdFromLocation = (): string | null => {
  if (typeof window === "undefined") {
    return null;
  }

  return readPreviewControllerDeviceIdFromSearchParams(
    new URLSearchParams(window.location.search),
  );
};

/**
 * The page framing a preview phone: its direct parent frame, at the origin
 * its launch declared, or else the phone's own origin, as the preview
 * workspace launches it. Null for anything but a framed preview phone.
 */
export const readPreviewControllerParent = (): {
  window: Window;
  origin: string;
} | null => {
  if (
    typeof window === "undefined" ||
    window.parent === window ||
    readPreviewControllerDeviceIdFromLocation() === null
  ) {
    return null;
  }

  const declared = new URLSearchParams(window.location.search).get(
    AIR_JAM_PREVIEW_PARENT_QUERY_PARAM,
  );
  return {
    window: window.parent,
    origin: declared ? new URL(declared).origin : window.location.origin,
  };
};

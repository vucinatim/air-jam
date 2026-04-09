import { generateControllerId } from "../utils/ids";

export const AIR_JAM_PREVIEW_FLAG_QUERY_PARAM = "aj_preview";
export const AIR_JAM_PREVIEW_DEVICE_QUERY_PARAM = "aj_preview_device";

export interface PreviewControllerIdentity {
  controllerId: string;
  deviceId: string;
}

const generatePreviewDeviceId = (): string => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
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

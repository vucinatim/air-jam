import {
  appendRuntimeQueryParams,
  getRuntimeUrlOrigin,
  normalizeRuntimeUrl,
} from "../protocol/url-policy";
import {
  AIR_JAM_PREVIEW_DEVICE_QUERY_PARAM,
  AIR_JAM_PREVIEW_FLAG_QUERY_PARAM,
  createPreviewControllerIdentity,
  type PreviewControllerIdentity,
} from "./identity";

export interface BuildPreviewControllerUrlOptions {
  joinUrl: string;
  controllerId: string;
  previewDeviceId?: string | null;
  allowedOrigins?: readonly string[];
}

export interface PreviewControllerLaunch extends PreviewControllerIdentity {
  url: string;
}

const normalizeAllowedOrigins = (
  allowedOrigins: readonly string[] | undefined,
): string[] => {
  if (!allowedOrigins || allowedOrigins.length === 0) {
    return [];
  }

  return allowedOrigins
    .map((origin) => getRuntimeUrlOrigin(origin))
    .filter((origin): origin is string => origin !== null);
};

export const buildPreviewControllerUrl = ({
  joinUrl,
  controllerId,
  previewDeviceId,
  allowedOrigins,
}: BuildPreviewControllerUrlOptions): string | null => {
  const normalizedJoinUrl = normalizeRuntimeUrl(joinUrl);
  if (!normalizedJoinUrl) {
    return null;
  }

  const joinOrigin = getRuntimeUrlOrigin(normalizedJoinUrl);
  const normalizedAllowedOrigins = normalizeAllowedOrigins(allowedOrigins);
  if (
    normalizedAllowedOrigins.length > 0 &&
    (!joinOrigin || !normalizedAllowedOrigins.includes(joinOrigin))
  ) {
    return null;
  }

  return appendRuntimeQueryParams(normalizedJoinUrl, {
    controllerId,
    [AIR_JAM_PREVIEW_FLAG_QUERY_PARAM]: "1",
    [AIR_JAM_PREVIEW_DEVICE_QUERY_PARAM]: previewDeviceId,
  });
};

export const createPreviewControllerLaunch = ({
  joinUrl,
  allowedOrigins,
}: {
  joinUrl: string;
  allowedOrigins?: readonly string[];
}): PreviewControllerLaunch | null => {
  const identity = createPreviewControllerIdentity();
  const url = buildPreviewControllerUrl({
    joinUrl,
    controllerId: identity.controllerId,
    previewDeviceId: identity.deviceId,
    allowedOrigins,
  });

  if (!url) {
    return null;
  }

  return {
    ...identity,
    url,
  };
};

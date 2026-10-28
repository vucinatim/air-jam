import {
  appendRuntimeQueryParams,
  getRuntimeUrlOrigin,
  normalizeRuntimeUrl,
} from "../protocol/url-policy";
import { AIR_JAM_LOCAL_SEAT_QUERY_PARAM } from "../runtime/local-seats";
import {
  AIR_JAM_PREVIEW_DEVICE_QUERY_PARAM,
  AIR_JAM_PREVIEW_FLAG_QUERY_PARAM,
  AIR_JAM_PREVIEW_PARENT_QUERY_PARAM,
  createPreviewControllerIdentity,
  type PreviewControllerIdentity,
} from "./identity";

export interface BuildPreviewControllerUrlOptions {
  joinUrl: string;
  controllerId: string;
  previewDeviceId?: string | null;
  allowedOrigins?: readonly string[];
  embedOrigin?: string | null;
  /**
   * The origin of the page that frames the phone, the only one it takes
   * messages from and answers; defaults to the phone's own origin.
   */
  parentOrigin?: string | null;
  /** Launches the phone as a local player's seat under this name. */
  localSeat?: string | null;
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
  embedOrigin,
  parentOrigin,
  localSeat,
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

  const previewBaseUrl = (() => {
    if (!embedOrigin) {
      return normalizedJoinUrl;
    }

    // Preview controllers are an embedded local tooling surface, not the
    // canonical phone/share URL. Keep joinUrl authoritative for validation and
    // room/capability params, but rebase the iframe onto the current app origin
    // so browser tooling can interact with it without cross-origin iframe
    // restrictions.
    const normalizedEmbedOrigin = getRuntimeUrlOrigin(embedOrigin);
    if (!normalizedEmbedOrigin) {
      return null;
    }

    const nextUrl = new URL(normalizedJoinUrl);
    const nextOrigin = new URL(normalizedEmbedOrigin);
    nextUrl.protocol = nextOrigin.protocol;
    nextUrl.host = nextOrigin.host;
    return nextUrl.toString();
  })();

  if (!previewBaseUrl) {
    return null;
  }

  const normalizedParentOrigin = parentOrigin
    ? getRuntimeUrlOrigin(parentOrigin)
    : null;
  if (parentOrigin && !normalizedParentOrigin) {
    return null;
  }

  return appendRuntimeQueryParams(previewBaseUrl, {
    controllerId,
    [AIR_JAM_PREVIEW_FLAG_QUERY_PARAM]: "1",
    [AIR_JAM_PREVIEW_DEVICE_QUERY_PARAM]: previewDeviceId,
    [AIR_JAM_PREVIEW_PARENT_QUERY_PARAM]: normalizedParentOrigin,
    [AIR_JAM_LOCAL_SEAT_QUERY_PARAM]: localSeat,
  });
};

export const createPreviewControllerLaunch = ({
  joinUrl,
  allowedOrigins,
  embedOrigin,
  parentOrigin,
  localSeat,
}: Omit<
  BuildPreviewControllerUrlOptions,
  "controllerId" | "previewDeviceId"
>): PreviewControllerLaunch | null => {
  const identity = createPreviewControllerIdentity();
  const url = buildPreviewControllerUrl({
    joinUrl,
    controllerId: identity.controllerId,
    previewDeviceId: identity.deviceId,
    allowedOrigins,
    embedOrigin,
    parentOrigin,
    localSeat,
  });

  if (!url) {
    return null;
  }

  return {
    ...identity,
    url,
  };
};

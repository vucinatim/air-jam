import type { ResolvedAirJamRuntimeTopology } from "@air-jam/runtime-topology";
import {
  parseRuntimeTopologyFromSearchParams,
  resolveRuntimeTopology,
} from "@air-jam/runtime-topology";
import { normalizeRuntimeUrl } from "../protocol/url-policy";
import type { PlayerProfile } from "../protocol";
import type { ArcadeSurfaceRuntimeIdentity } from "./arcade-surface-identity";
import { parseOptionalArcadeSurfaceFromSearchParams } from "./arcade-runtime-url";

export interface ChildHostRuntimeParams {
  room: string;
  capabilityToken: string;
  capabilityExpiresAt?: number;
  joinUrl?: string;
  topology: ResolvedAirJamRuntimeTopology;
  arcadeSurface: ArcadeSurfaceRuntimeIdentity;
}

export interface EmbeddedControllerRuntimeParams {
  room: string;
  controllerId: string;
  topology: ResolvedAirJamRuntimeTopology;
  arcadeSurface: ArcadeSurfaceRuntimeIdentity;
  playerProfile?: {
    label?: PlayerProfile["label"];
    avatarId?: PlayerProfile["avatarId"];
  };
}

const parseOrigin = (value: string | null | undefined): string | null => {
  if (!value) {
    return null;
  }

  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
};

const resolveLegacyEmbeddedTopology = ({
  surfaceRole,
  joinUrl,
}: {
  surfaceRole: "host" | "controller";
  joinUrl?: string;
}): ResolvedAirJamRuntimeTopology | null => {
  if (typeof window === "undefined") {
    return null;
  }

  const appOrigin = window.location.origin;
  const joinUrlOrigin = parseOrigin(joinUrl);
  const referrerOrigin = parseOrigin(document.referrer);
  const embedParentOrigin = joinUrlOrigin ?? referrerOrigin ?? appOrigin;
  const publicHost = joinUrlOrigin ?? appOrigin;
  const secureTransport =
    appOrigin.startsWith("https://") &&
    publicHost.startsWith("https://") &&
    embedParentOrigin.startsWith("https://");

  return resolveRuntimeTopology({
    runtimeMode: "arcade-live",
    surfaceRole,
    appOrigin,
    backendOrigin: appOrigin,
    socketOrigin: appOrigin,
    publicHost,
    assetBasePath: "/",
    secureTransport,
    embedded: true,
    embedParentOrigin,
    proxyStrategy: "none",
  });
};

export const readChildHostRuntimeParams = (): ChildHostRuntimeParams | null => {
  if (typeof window === "undefined") {
    return null;
  }

  const params = new URLSearchParams(window.location.search);
  const room = params.get("aj_room");
  const capabilityToken = params.get("aj_cap");
  if (!room || !capabilityToken) {
    return null;
  }

  const rawCapabilityExpiresAt = params.get("aj_cap_exp");
  const parsedCapabilityExpiresAt = rawCapabilityExpiresAt
    ? Number(rawCapabilityExpiresAt)
    : NaN;

  const joinUrl = params.get("aj_join_url");
  const normalizedJoinUrl = joinUrl ? normalizeRuntimeUrl(joinUrl) : null;
  const topology =
    parseRuntimeTopologyFromSearchParams(params) ??
    resolveLegacyEmbeddedTopology({
      surfaceRole: "host",
      joinUrl: normalizedJoinUrl ?? undefined,
    });
  if (!topology) {
    return null;
  }

  const arcadeSurface = parseOptionalArcadeSurfaceFromSearchParams(params);
  if (!arcadeSurface) {
    return null;
  }

  return {
    room,
    capabilityToken,
    capabilityExpiresAt: Number.isFinite(parsedCapabilityExpiresAt)
      ? parsedCapabilityExpiresAt
      : undefined,
    joinUrl: normalizedJoinUrl ?? undefined,
    topology,
    arcadeSurface,
  };
};

export const readEmbeddedControllerRuntimeParams =
  (): EmbeddedControllerRuntimeParams | null => {
    if (typeof window === "undefined") {
      return null;
    }

    const params = new URLSearchParams(window.location.search);
    const room = params.get("aj_room");
    const controllerId = params.get("aj_controller_id");
    if (!room || !controllerId) {
      return null;
    }

    const topology =
      parseRuntimeTopologyFromSearchParams(params) ??
      resolveLegacyEmbeddedTopology({
        surfaceRole: "controller",
      });
    if (!topology) {
      return null;
    }

    const arcadeSurface = parseOptionalArcadeSurfaceFromSearchParams(params);
    if (!arcadeSurface) {
      return null;
    }

    const rawLabel = params.get("aj_player_label")?.trim();
    const rawAvatarId = params.get("aj_player_avatar")?.trim();
    const playerProfile =
      rawLabel || rawAvatarId
        ? {
            ...(rawLabel ? { label: rawLabel } : {}),
            ...(rawAvatarId ? { avatarId: rawAvatarId } : {}),
          }
        : undefined;

    return {
      room,
      controllerId,
      topology,
      arcadeSurface,
      ...(playerProfile ? { playerProfile } : {}),
    };
  };

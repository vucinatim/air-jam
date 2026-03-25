import { normalizeRuntimeUrl } from "../protocol/url-policy";
import type { PlayerProfile } from "../protocol";
import type { ArcadeSurfaceRuntimeIdentity } from "./arcade-surface-identity";
import { parseOptionalArcadeSurfaceFromSearchParams } from "./arcade-runtime-url";

export interface ChildHostRuntimeParams {
  room: string;
  token: string;
  joinUrl?: string;
  arcadeSurface: ArcadeSurfaceRuntimeIdentity;
}

export interface EmbeddedControllerRuntimeParams {
  room: string;
  controllerId: string;
  arcadeSurface: ArcadeSurfaceRuntimeIdentity;
  playerProfile?: {
    label?: PlayerProfile["label"];
    avatarId?: PlayerProfile["avatarId"];
  };
}

export const readChildHostRuntimeParams = (): ChildHostRuntimeParams | null => {
  if (typeof window === "undefined") {
    return null;
  }

  const params = new URLSearchParams(window.location.search);
  const room = params.get("aj_room");
  const token = params.get("aj_token");
  if (!room || !token) {
    return null;
  }

  const joinUrl = params.get("aj_join_url");
  const normalizedJoinUrl = joinUrl ? normalizeRuntimeUrl(joinUrl) : null;

  const arcadeSurface = parseOptionalArcadeSurfaceFromSearchParams(params);
  if (!arcadeSurface) {
    return null;
  }

  return {
    room,
    token,
    joinUrl: normalizedJoinUrl ?? undefined,
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
      arcadeSurface,
      ...(playerProfile ? { playerProfile } : {}),
    };
  };

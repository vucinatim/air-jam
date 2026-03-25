import { normalizeRuntimeUrl } from "../protocol/url-policy";
import type { ArcadeSurfaceRuntimeIdentity } from "./arcade-surface-identity";
import {
  parseOptionalArcadeSurfaceFromSearchParams,
} from "./arcade-runtime-url";

export {
  arcadeSurfaceRuntimeUrlParams,
  parseOptionalArcadeSurfaceFromSearchParams,
} from "./arcade-runtime-url";

export interface ChildHostRuntimeParams {
  room: string;
  token: string;
  joinUrl?: string;
  arcadeSurface?: ArcadeSurfaceRuntimeIdentity;
}

export interface EmbeddedControllerRuntimeParams {
  room: string;
  controllerId: string;
  arcadeSurface?: ArcadeSurfaceRuntimeIdentity;
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

  return {
    room,
    token,
    joinUrl: normalizedJoinUrl ?? undefined,
    ...(arcadeSurface ? { arcadeSurface } : {}),
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

    return {
      room,
      controllerId,
      ...(arcadeSurface ? { arcadeSurface } : {}),
    };
  };

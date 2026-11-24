import type { PlayerProfile } from "../protocol";
import { normalizeRuntimeUrl } from "../protocol/url-policy";
import type { ResolvedAirJamRuntimeTopology } from "../runtime-topology";
import { parseRuntimeTopologyFromSearchParams } from "../runtime-topology";
import { parseOptionalArcadeSurfaceFromSearchParams } from "./arcade-runtime-url";
import type { ArcadeSurfaceRuntimeIdentity } from "./arcade-surface-identity";
import {
  controllerBridgeContextSchema,
  type ControllerBridgeContext,
} from "./controller-bridge-context";

export interface ChildHostRuntimeParams {
  room: string;
  joinUrl?: string;
  topology: ResolvedAirJamRuntimeTopology;
  arcadeSurface: ArcadeSurfaceRuntimeIdentity;
}

export type EmbeddedControllerRuntimeParams = ControllerBridgeContext & {
  room: string;
  topology: ResolvedAirJamRuntimeTopology;
  playerProfile?: {
    label?: PlayerProfile["label"];
    avatarId?: PlayerProfile["avatarId"];
  };
};

export const readChildHostRuntimeParams = (): ChildHostRuntimeParams | null => {
  if (typeof window === "undefined") {
    return null;
  }

  const params = new URLSearchParams(window.location.search);
  const room = params.get("aj_room");
  if (!room) {
    return null;
  }

  const joinUrl = params.get("aj_join_url");
  const normalizedJoinUrl = joinUrl ? normalizeRuntimeUrl(joinUrl) : null;
  const topology = parseRuntimeTopologyFromSearchParams(params);
  if (!topology) {
    return null;
  }

  const arcadeSurface = parseOptionalArcadeSurfaceFromSearchParams(params);
  if (!arcadeSurface) {
    return null;
  }

  return {
    room,
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
    if (!room) {
      return null;
    }

    const topology = parseRuntimeTopologyFromSearchParams(params);
    if (!topology) {
      return null;
    }

    const harnessContext = params.has("aj_harness_session")
      ? controllerBridgeContextSchema.parse({
          harnessSessionId: params.get("aj_harness_session"),
        })
      : null;
    const context = controllerBridgeContextSchema.safeParse(
      harnessContext
        ? harnessContext
        : { arcadeSurface: parseOptionalArcadeSurfaceFromSearchParams(params) },
    );
    if (!context.success) {
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
      topology,
      ...context.data,
      ...(playerProfile ? { playerProfile } : {}),
    };
  };

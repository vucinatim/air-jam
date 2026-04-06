import type { ResolvedAirJamRuntimeTopology } from "@air-jam/runtime-topology";
import { runtimeTopologyToQueryParams } from "@air-jam/runtime-topology";
import {
  arcadeSurfaceRuntimeUrlParams,
  type ArcadeSurfaceRuntimeIdentity,
} from "./surface";
import type { ChildHostCapability } from "../protocol";
import {
  appendRuntimeQueryParams,
  getRuntimeUrlOrigin,
  normalizeRuntimeUrl,
} from "../protocol/url-policy";
export { urlBuilder } from "../utils/url-builder";
export {
  appendRuntimeQueryParams,
  getRuntimeUrlOrigin,
  normalizeRuntimeUrl,
};
export { arcadeSurfaceRuntimeUrlParams } from "./surface";

export const buildArcadeGameIframeSrc = ({
  normalizedUrl,
  roomId,
  launchCapability,
  joinUrl,
  topology,
  arcadeSurface,
}: {
  normalizedUrl: string;
  roomId: string;
  launchCapability: ChildHostCapability;
  joinUrl?: string | null;
  topology: ResolvedAirJamRuntimeTopology;
  arcadeSurface: ArcadeSurfaceRuntimeIdentity;
}): string | null =>
  appendRuntimeQueryParams(normalizedUrl, {
    aj_room: roomId,
    aj_cap: launchCapability.token,
    aj_cap_exp: String(launchCapability.expiresAt),
    aj_join_url: joinUrl,
    ...runtimeTopologyToQueryParams(topology),
    ...arcadeSurfaceRuntimeUrlParams(arcadeSurface),
  });

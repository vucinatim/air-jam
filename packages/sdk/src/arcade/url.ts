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

export const buildArcadeControllerRuntimeUrl = (
  normalizedUrl: string,
): string | null => {
  try {
    const runtimeUrl = new URL(normalizedUrl);
    const trimmedPath =
      runtimeUrl.pathname !== "/" && runtimeUrl.pathname.endsWith("/")
        ? runtimeUrl.pathname.slice(0, -1)
        : runtimeUrl.pathname;
    const pathSegments = trimmedPath.split("/").filter(Boolean);
    const controllerPath =
      trimmedPath === "/" || pathSegments.length <= 1
        ? "/controller"
        : `${trimmedPath}/controller`;

    return new URL(controllerPath, runtimeUrl.origin).toString();
  } catch {
    return null;
  }
};

import {
  appendRuntimeQueryParams,
  getRuntimeUrlOrigin,
  normalizeRuntimeUrl,
} from "../protocol/url-policy";
import type { ResolvedAirJamRuntimeTopology } from "../runtime-topology";
import { runtimeTopologyToQueryParams } from "../runtime-topology";
import {
  arcadeSurfaceRuntimeUrlParams,
  type ArcadeSurfaceRuntimeIdentity,
} from "./surface";
export { appendRuntimeQueryParams, getRuntimeUrlOrigin, normalizeRuntimeUrl };

export const buildArcadeGameIframeSrc = ({
  normalizedUrl,
  roomId,
  joinUrl,
  localControllerUrl,
  topology,
  arcadeSurface,
}: {
  normalizedUrl: string;
  roomId: string;
  joinUrl?: string | null;
  localControllerUrl?: string | null;
  topology: ResolvedAirJamRuntimeTopology;
  arcadeSurface: ArcadeSurfaceRuntimeIdentity;
}): string | null =>
  appendRuntimeQueryParams(normalizedUrl, {
    aj_room: roomId,
    aj_join_url: joinUrl,
    aj_local_controller_url: localControllerUrl,
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

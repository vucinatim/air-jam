import {
  arcadeSurfaceRuntimeUrlParams,
  type ArcadeSurfaceRuntimeIdentity,
} from "./surface";
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
  joinToken,
  joinUrl,
  arcadeSurface,
}: {
  normalizedUrl: string;
  roomId: string;
  joinToken: string;
  joinUrl?: string | null;
  arcadeSurface: ArcadeSurfaceRuntimeIdentity;
}): string | null =>
  appendRuntimeQueryParams(normalizedUrl, {
    aj_room: roomId,
    aj_token: joinToken,
    aj_join_url: joinUrl,
    ...arcadeSurfaceRuntimeUrlParams(arcadeSurface),
  });

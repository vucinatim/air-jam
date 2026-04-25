import { AIR_JAM_DEFAULT_STORE_DOMAIN } from "../store/air-jam-store-domain-constants";
import type { ArcadeSurfaceRuntimeIdentity } from "./arcade-surface-identity";

/**
 * Query param for the canonical replicated store domain in embedded runtimes.
 * When set, {@link resolveImplicitReplicatedStoreDomainFromSearchParams} prefers it over derivation from `aj_arcade_*`.
 */
export const AIRJAM_STORE_DOMAIN_URL_PARAM = "aj_store_domain";

const clampStoreDomain = (value: string): string =>
  value.length > 128 ? value.slice(0, 128) : value;

/**
 * Stable replicated store domain for an embedded Arcade surface identity (epoch-bound).
 * Used for host/controller `createAirJamStore` in iframes so shell `default` and prior runs do not collide.
 */
export const embeddedReplicatedStoreDomainFromArcadeIdentity = (
  identity: ArcadeSurfaceRuntimeIdentity,
): string => {
  if (identity.kind === "game") {
    const gameKey = identity.gameId ?? "_";
    return clampStoreDomain(`aj.embedded.game:${identity.epoch}:${gameKey}`);
  }
  return clampStoreDomain(`aj.embedded.browser:${identity.epoch}`);
};

/**
 * Query params used to pass {@link ArcadeSurfaceRuntimeIdentity} and replicated store domain into embedded iframes.
 */
export const arcadeSurfaceRuntimeUrlParams = (
  identity: ArcadeSurfaceRuntimeIdentity,
): Record<string, string> => ({
  aj_arcade_epoch: String(identity.epoch),
  aj_arcade_kind: identity.kind,
  ...(identity.gameId != null ? { aj_arcade_game_id: identity.gameId } : {}),
  [AIRJAM_STORE_DOMAIN_URL_PARAM]:
    embeddedReplicatedStoreDomainFromArcadeIdentity(identity),
});

export const parseOptionalArcadeSurfaceFromSearchParams = (
  params: URLSearchParams,
): ArcadeSurfaceRuntimeIdentity | undefined => {
  const epochStr = params.get("aj_arcade_epoch");
  const kind = params.get("aj_arcade_kind");
  if (epochStr === null || (kind !== "browser" && kind !== "game")) {
    return undefined;
  }

  const epoch = Number(epochStr);
  if (!Number.isFinite(epoch) || epoch < 0 || !Number.isInteger(epoch)) {
    return undefined;
  }

  const gameIdRaw = params.get("aj_arcade_game_id");
  const gameId =
    kind === "browser"
      ? null
      : gameIdRaw && gameIdRaw.length > 0
        ? gameIdRaw
        : null;

  return { epoch, kind, gameId };
};

/**
 * Resolves the implicit networked store domain from the current URL (embedded) or {@link AIR_JAM_DEFAULT_STORE_DOMAIN}.
 * Prefer {@link AIRJAM_STORE_DOMAIN_URL_PARAM} when present; otherwise derive from `aj_arcade_*` when valid.
 */
export const resolveImplicitReplicatedStoreDomainFromSearchParams = (
  params: URLSearchParams,
): string => {
  const explicit = params.get(AIRJAM_STORE_DOMAIN_URL_PARAM)?.trim();
  if (explicit && explicit.length > 0) {
    return clampStoreDomain(explicit);
  }

  const surface = parseOptionalArcadeSurfaceFromSearchParams(params);
  if (surface) {
    return embeddedReplicatedStoreDomainFromArcadeIdentity(surface);
  }

  return AIR_JAM_DEFAULT_STORE_DOMAIN;
};

/**
 * Browser-only resolver for implicit store domain (SSR-safe: returns default without `window`).
 */
export const resolveImplicitReplicatedStoreDomainFromWindow = (): string => {
  if (typeof window === "undefined") {
    return AIR_JAM_DEFAULT_STORE_DOMAIN;
  }
  return resolveImplicitReplicatedStoreDomainFromSearchParams(
    new URLSearchParams(window.location.search),
  );
};

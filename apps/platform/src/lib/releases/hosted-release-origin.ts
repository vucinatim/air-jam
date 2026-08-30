import { resolvePlatformDeploymentConfig } from "@/lib/platform-deployment-config";

export const HOSTED_RELEASE_PUBLIC_ORIGIN_ENV =
  "AIRJAM_RELEASES_PUBLIC_ORIGIN" as const;
export const BUILT_PLATFORM_PUBLIC_ORIGIN_ENV =
  "AIRJAM_BUILT_PLATFORM_PUBLIC_ORIGIN" as const;

export type HostedReleaseOriginAssessment =
  | {
      status: "ready";
      publicOrigin: string;
      platformOrigin: string;
      cookieSite: string;
    }
  | {
      status: "disabled" | "invalid";
      publicOrigin: null;
      platformOrigin: string;
      reason: string;
    };

export class HostedReleaseOriginConfigurationError extends Error {
  readonly code = "HOSTED_RELEASE_ORIGIN_NOT_READY";

  constructor(message: string) {
    super(message);
    this.name = "HostedReleaseOriginConfigurationError";
  }
}

const trimToNull = (value: string | undefined): string | null => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

const normalizeHostname = (hostname: string): string =>
  hostname
    .toLowerCase()
    .replace(/^\[|\]$/g, "")
    .replace(/\.$/, "");

const isIpAddress = (hostname: string): boolean =>
  /^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname) || hostname.includes(":");

/**
 * Conservative cookie-site boundary used for deployment validation.
 *
 * The final two labels are intentionally used instead of accepting sibling
 * subdomains. This rejects some uncommon public-suffix shapes more strictly
 * than necessary, but never weakens the required boundary. Air Jam release
 * delivery should use a visibly independent site such as an
 * `airjamusercontent` domain, not another `*.airjam.io` hostname.
 */
export const resolveConservativeCookieSite = (hostname: string): string => {
  const normalized = normalizeHostname(hostname);
  if (!normalized || normalized === "localhost" || isIpAddress(normalized)) {
    return normalized;
  }

  const labels = normalized.split(".").filter(Boolean);
  return labels.length <= 2 ? normalized : labels.slice(-2).join(".");
};

const parseConfiguredOrigin = (
  rawOrigin: string,
): { origin: string; hostname: string; protocol: string } | null => {
  try {
    const url = new URL(rawOrigin);
    if (
      url.username ||
      url.password ||
      url.pathname !== "/" ||
      url.search ||
      url.hash ||
      (url.protocol !== "https:" && url.protocol !== "http:")
    ) {
      return null;
    }

    return {
      origin: url.origin,
      hostname: normalizeHostname(url.hostname),
      protocol: url.protocol,
    };
  } catch {
    return null;
  }
};

const escapeRegularExpression = (value: string): string =>
  value.replace(/[|\\{}()[\]^$+?.]/g, "\\$&");

const trustedOriginPatternMatches = (
  origin: string,
  trustedPattern: string,
): boolean => {
  if (!trustedPattern.includes("*")) {
    return origin === trustedPattern;
  }

  const expression = trustedPattern
    .split("*")
    .map(escapeRegularExpression)
    .join(".*");
  return new RegExp(`^${expression}$`).test(origin);
};

export const assessHostedReleaseOrigin = (
  env: NodeJS.ProcessEnv = process.env,
): HostedReleaseOriginAssessment => {
  const deployment = resolvePlatformDeploymentConfig(env);
  const rawOrigin = trimToNull(env[HOSTED_RELEASE_PUBLIC_ORIGIN_ENV]);
  const required = isHostedReleaseOriginRequired(env);

  if (required && !deployment.hasExplicitPlatformPublicOrigin) {
    return {
      status: "invalid",
      publicOrigin: null,
      platformOrigin: deployment.platformPublicOrigin,
      reason:
        "Hosted release delivery requires an explicit authenticated platform public origin in production.",
    };
  }

  const builtPlatformOrigin = trimToNull(env[BUILT_PLATFORM_PUBLIC_ORIGIN_ENV]);
  if (
    builtPlatformOrigin &&
    parseConfiguredOrigin(builtPlatformOrigin)?.origin !==
      deployment.platformPublicOrigin
  ) {
    return {
      status: "invalid",
      publicOrigin: null,
      platformOrigin: deployment.platformPublicOrigin,
      reason:
        "The runtime platform origin does not match the platform origin baked into the release response policy. Rebuild before enabling hosted release delivery.",
    };
  }

  if (!rawOrigin) {
    return {
      status: "disabled",
      publicOrigin: null,
      platformOrigin: deployment.platformPublicOrigin,
      reason: `${HOSTED_RELEASE_PUBLIC_ORIGIN_ENV} is not configured. Hosted release delivery is disabled rather than falling back to the authenticated platform origin.`,
    };
  }

  const parsed = parseConfiguredOrigin(rawOrigin);
  if (!parsed) {
    return {
      status: "invalid",
      publicOrigin: null,
      platformOrigin: deployment.platformPublicOrigin,
      reason: `${HOSTED_RELEASE_PUBLIC_ORIGIN_ENV} must be an absolute http(s) origin without a path, credentials, query, or fragment.`,
    };
  }

  const platformUrl = new URL(deployment.platformPublicOrigin);
  const platformHostname = normalizeHostname(platformUrl.hostname);
  const releaseCookieSite = resolveConservativeCookieSite(parsed.hostname);
  const platformCookieSite = resolveConservativeCookieSite(platformHostname);

  if (parsed.origin === deployment.platformPublicOrigin) {
    return {
      status: "invalid",
      publicOrigin: null,
      platformOrigin: deployment.platformPublicOrigin,
      reason: `${HOSTED_RELEASE_PUBLIC_ORIGIN_ENV} must not equal the authenticated platform origin.`,
    };
  }

  if (
    releaseCookieSite &&
    platformCookieSite &&
    releaseCookieSite === platformCookieSite
  ) {
    return {
      status: "invalid",
      publicOrigin: null,
      platformOrigin: deployment.platformPublicOrigin,
      reason: `${HOSTED_RELEASE_PUBLIC_ORIGIN_ENV} must use a separate cookie site, not a sibling or parent of the authenticated platform hostname.`,
    };
  }

  const requiresHttps =
    env.NODE_ENV === "production" ||
    env.RAILWAY_ENVIRONMENT_NAME?.trim() === "production";
  if (requiresHttps && parsed.protocol !== "https:") {
    return {
      status: "invalid",
      publicOrigin: null,
      platformOrigin: deployment.platformPublicOrigin,
      reason: `${HOSTED_RELEASE_PUBLIC_ORIGIN_ENV} must use https in production.`,
    };
  }

  if (
    deployment.authTrustedOrigins.some((trustedOrigin) =>
      trustedOriginPatternMatches(parsed.origin, trustedOrigin),
    )
  ) {
    return {
      status: "invalid",
      publicOrigin: null,
      platformOrigin: deployment.platformPublicOrigin,
      reason: `${HOSTED_RELEASE_PUBLIC_ORIGIN_ENV} must not be included in Better Auth trusted origins.`,
    };
  }

  return {
    status: "ready",
    publicOrigin: parsed.origin,
    platformOrigin: deployment.platformPublicOrigin,
    cookieSite: releaseCookieSite,
  };
};

export const requireHostedReleasePublicOrigin = (
  env: NodeJS.ProcessEnv = process.env,
): string => {
  const assessment = assessHostedReleaseOrigin(env);
  if (assessment.status !== "ready") {
    throw new HostedReleaseOriginConfigurationError(assessment.reason);
  }

  return assessment.publicOrigin;
};

export const normalizeIncomingRequestHost = (
  rawHost: string | null | undefined,
): string | null => {
  const candidate = rawHost?.trim().toLowerCase();
  if (!candidate || candidate.includes(",") || /\s/.test(candidate)) {
    return null;
  }

  try {
    const parsed = new URL(`http://${candidate}`);
    return parsed.host === candidate ? parsed.host : null;
  } catch {
    return null;
  }
};

export const isHostedReleaseRequestHost = (
  requestHost: string | null | undefined,
  env: NodeJS.ProcessEnv = process.env,
): boolean => {
  const assessment = assessHostedReleaseOrigin(env);
  if (assessment.status !== "ready") {
    return false;
  }

  return (
    normalizeIncomingRequestHost(requestHost) ===
    new URL(assessment.publicOrigin).host
  );
};

export const isHostedReleaseOriginRequired = (
  env: NodeJS.ProcessEnv = process.env,
): boolean => {
  const railwayEnvironment = env.RAILWAY_ENVIRONMENT_NAME?.trim();
  return railwayEnvironment
    ? railwayEnvironment === "production"
    : env.NODE_ENV === "production";
};

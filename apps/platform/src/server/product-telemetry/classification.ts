import type {
  ProductTelemetryActorClass,
  ProductTelemetryAgentFamily,
  ProductTelemetryDeploymentEnvironment,
  ProductTelemetryReferrerSource,
  ProductTelemetrySurface,
} from "@/lib/product-telemetry-contract";

const SEARCH_HOSTS = [
  "google.",
  "bing.com",
  "duckduckgo.com",
  "search.brave.com",
  "search.yahoo.com",
  "yandex.",
];
const SOCIAL_HOSTS = [
  "linkedin.com",
  "reddit.com",
  "twitter.com",
  "x.com",
  "facebook.com",
  "instagram.com",
  "bsky.app",
  "dev.to",
  "mastodon.",
];
const AI_HOSTS = [
  "chatgpt.com",
  "chat.openai.com",
  "claude.ai",
  "perplexity.ai",
  "gemini.google.com",
  "copilot.microsoft.com",
];

const hostMatches = (host: string, candidate: string): boolean =>
  candidate.endsWith(".")
    ? host.includes(candidate)
    : host === candidate || host.endsWith(`.${candidate}`);

const classifyKnownSource = (
  value: string,
): Exclude<
  ProductTelemetryReferrerSource,
  "direct" | "internal" | "other"
> | null => {
  const normalized = value.toLowerCase();
  if (normalized === "github" || hostMatches(normalized, "github.com")) {
    return "github";
  }
  if (normalized === "npm" || hostMatches(normalized, "npmjs.com")) {
    return "npm";
  }
  if (
    normalized === "ai" ||
    AI_HOSTS.some((candidate) => hostMatches(normalized, candidate)) ||
    /^(chatgpt|openai|claude|anthropic|perplexity|gemini|copilot)$/.test(
      normalized,
    )
  ) {
    return "ai";
  }
  if (
    normalized === "social" ||
    SOCIAL_HOSTS.some((candidate) => hostMatches(normalized, candidate)) ||
    /^(linkedin|reddit|twitter|x|facebook|instagram|bluesky|devto)$/.test(
      normalized,
    )
  ) {
    return "social";
  }
  if (
    normalized === "search" ||
    SEARCH_HOSTS.some((candidate) => hostMatches(normalized, candidate)) ||
    /^(google|bing|duckduckgo|brave|yahoo|yandex)$/.test(normalized)
  ) {
    return "search";
  }
  return null;
};

export const classifyProductTelemetryReferrer = ({
  referrerHost,
  campaignSource,
  platformHost,
}: {
  referrerHost?: string;
  campaignSource?: string;
  platformHost: string;
}): ProductTelemetryReferrerSource => {
  if (campaignSource) {
    return classifyKnownSource(campaignSource) ?? "other";
  }
  if (!referrerHost) {
    return "direct";
  }

  const normalizedHost = referrerHost.toLowerCase();
  if (hostMatches(normalizedHost, platformHost.toLowerCase())) {
    return "internal";
  }
  return classifyKnownSource(normalizedHost) ?? "other";
};

const AGENT_USER_AGENTS: Array<{
  family: ProductTelemetryAgentFamily;
  pattern: RegExp;
}> = [
  {
    family: "openai",
    pattern: /(gptbot|chatgpt-user|oai-searchbot|openai)/i,
  },
  {
    family: "anthropic",
    pattern: /(claudebot|claude-user|claude-searchbot|anthropic)/i,
  },
  { family: "perplexity", pattern: /(perplexitybot|perplexity-user)/i },
  { family: "google", pattern: /(google-extended|gemini)/i },
  { family: "microsoft", pattern: /(copilot|bingpreview)/i },
  { family: "meta", pattern: /(meta-externalagent|facebookexternalhit)/i },
  { family: "bytedance", pattern: /(bytespider|tiktokspider)/i },
];

export const classifyProductTelemetryActor = (
  userAgent: string | null | undefined,
): {
  actorClass: ProductTelemetryActorClass;
  agentFamily: ProductTelemetryAgentFamily | null;
} => {
  const normalized = userAgent?.trim();
  if (!normalized) {
    return { actorClass: "unknown", agentFamily: null };
  }

  const agentMatch = AGENT_USER_AGENTS.find(({ pattern }) =>
    pattern.test(normalized),
  );
  if (agentMatch) {
    return { actorClass: "agent", agentFamily: agentMatch.family };
  }

  if (
    /(bot\b|crawler|spider|slurp|headless|lighthouse|curl\/|wget\/|python-requests)/i.test(
      normalized,
    )
  ) {
    return { actorClass: "bot", agentFamily: null };
  }

  return { actorClass: "human", agentFamily: null };
};

const normalizePathname = (pathname: string): string => {
  const normalized = pathname
    .replace(/\/{2,}/g, "/")
    .replace(/\/$/, "")
    .toLowerCase();
  return normalized || "/";
};

export const classifyProductTelemetryPage = (
  pathname: string,
): { surface: ProductTelemetrySurface; pageKey: string } => {
  const normalized = normalizePathname(pathname);

  if (normalized === "/") {
    return { surface: "landing", pageKey: "/" };
  }
  if (normalized === "/docs" || normalized.startsWith("/docs/")) {
    return { surface: "docs", pageKey: normalized };
  }
  if (normalized === "/blog" || normalized.startsWith("/blog/")) {
    return { surface: "blog", pageKey: normalized };
  }
  if (normalized === "/arcade" || normalized.startsWith("/arcade/")) {
    return { surface: "arcade", pageKey: normalized };
  }
  if (normalized === "/login" || normalized.startsWith("/auth/")) {
    return { surface: "auth", pageKey: normalized };
  }
  if (normalized === "/dashboard" || normalized.startsWith("/dashboard/")) {
    return {
      surface: "dashboard",
      pageKey: normalized.replace(
        /^\/dashboard\/games\/[^/]+/,
        "/dashboard/games/:game",
      ),
    };
  }
  if (normalized === "/controller") {
    return { surface: "other", pageKey: "/controller" };
  }
  if (normalized === "/play" || normalized.startsWith("/play/")) {
    return { surface: "other", pageKey: "/play/:game" };
  }

  return { surface: "other", pageKey: "/other" };
};

export const resolveProductTelemetryDeployment = (
  env: NodeJS.ProcessEnv = process.env,
): {
  environment: ProductTelemetryDeploymentEnvironment;
  deploymentId: string;
} => {
  const railwayEnvironment = env.RAILWAY_ENVIRONMENT_NAME?.trim();
  const environment: ProductTelemetryDeploymentEnvironment =
    env.NODE_ENV === "test"
      ? "test"
      : env.NODE_ENV === "development"
        ? "development"
        : railwayEnvironment && railwayEnvironment !== "production"
          ? "preview"
          : env.NODE_ENV === "production"
            ? "production"
            : "development";

  const rawDeploymentId =
    env.RAILWAY_DEPLOYMENT_ID?.trim() ||
    railwayEnvironment ||
    env.VERCEL_DEPLOYMENT_ID?.trim() ||
    (environment === "development" ? "local" : environment);
  const deploymentId = rawDeploymentId
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, "-")
    .slice(0, 120);

  return { environment, deploymentId: deploymentId || environment };
};

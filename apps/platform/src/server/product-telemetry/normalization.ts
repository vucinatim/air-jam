import { resolvePlatformDeploymentConfig } from "@/lib/platform-deployment-config";
import {
  PRODUCT_TELEMETRY_SCHEMA_VERSION,
  type ProductTelemetryAgentResource,
  type ProductTelemetryBrowserEvent,
} from "@/lib/product-telemetry-contract";
import {
  classifyProductTelemetryActor,
  classifyProductTelemetryPage,
  classifyProductTelemetryReferrer,
  resolveProductTelemetryDeployment,
} from "./classification";
import type { NormalizedProductTelemetryEvent } from "./types";

export const PRODUCT_TELEMETRY_MAX_PAST_SKEW_MS = 24 * 60 * 60 * 1_000;
export const PRODUCT_TELEMETRY_MAX_FUTURE_SKEW_MS = 5 * 60 * 1_000;

export class ProductTelemetryTimeSkewError extends Error {
  constructor() {
    super("Telemetry event occurrence time is outside the accepted window.");
    this.name = "ProductTelemetryTimeSkewError";
  }
}

const readReferrerHost = (headers: Headers): string | undefined => {
  const referrer = headers.get("referer");
  if (!referrer) {
    return undefined;
  }
  try {
    return new URL(referrer).hostname.toLowerCase().slice(0, 253);
  } catch {
    return undefined;
  }
};

const normalizeEventSpecificDimensions = (
  event: ProductTelemetryBrowserEvent,
): Pick<
  NormalizedProductTelemetryEvent,
  "placement" | "externalTarget" | "agentResource"
> => ({
  placement: "placement" in event ? event.placement : null,
  externalTarget: "target" in event ? event.target : null,
  agentResource: null,
});

export const normalizeProductTelemetryBrowserEvent = ({
  event,
  headers,
  now = new Date(),
  env = process.env,
}: {
  event: ProductTelemetryBrowserEvent;
  headers: Headers;
  now?: Date;
  env?: NodeJS.ProcessEnv;
}): NormalizedProductTelemetryEvent => {
  const occurredAt = new Date(event.occurredAt);
  const skewMs = occurredAt.getTime() - now.getTime();
  if (
    skewMs > PRODUCT_TELEMETRY_MAX_FUTURE_SKEW_MS ||
    skewMs < -PRODUCT_TELEMETRY_MAX_PAST_SKEW_MS
  ) {
    throw new ProductTelemetryTimeSkewError();
  }

  const page = classifyProductTelemetryPage(event.pathname);
  const actor = classifyProductTelemetryActor(headers.get("user-agent"));
  const deployment = resolveProductTelemetryDeployment(env);
  const platformHost = new URL(
    resolvePlatformDeploymentConfig(env).platformPublicOrigin,
  ).hostname;

  return {
    id: event.id,
    schemaVersion: event.schemaVersion,
    kind: event.kind,
    occurredAt,
    receivedAt: now,
    anonymousSessionId: event.anonymousSessionId,
    ...page,
    ...actor,
    referrerSource: classifyProductTelemetryReferrer({
      referrerHost: event.referrerHost,
      campaignSource: event.campaign?.source,
      platformHost,
    }),
    referrerHost: event.referrerHost ?? null,
    campaignSource: event.campaign?.source ?? null,
    campaignMedium: event.campaign?.medium ?? null,
    campaignName: event.campaign?.campaign ?? null,
    ...normalizeEventSpecificDimensions(event),
    deploymentEnvironment: deployment.environment,
    deploymentId: deployment.deploymentId,
  };
};

const AGENT_RESOURCE_PATHS: Record<ProductTelemetryAgentResource, string> = {
  llms_txt: "/llms.txt",
  docs_manifest: "/docs-manifest",
  docs_search_index: "/docs-search-index",
  ai_pack_manifest: "/ai-pack/manifest.json",
};

export const normalizeAgentResourceTelemetryEvent = ({
  id,
  resource,
  headers,
  now = new Date(),
  env = process.env,
}: {
  id: string;
  resource: ProductTelemetryAgentResource;
  headers: Headers;
  now?: Date;
  env?: NodeJS.ProcessEnv;
}): NormalizedProductTelemetryEvent => {
  const actor = classifyProductTelemetryActor(headers.get("user-agent"));
  const deployment = resolveProductTelemetryDeployment(env);
  const platformHost = new URL(
    resolvePlatformDeploymentConfig(env).platformPublicOrigin,
  ).hostname;
  const referrerHost = readReferrerHost(headers);

  return {
    id,
    schemaVersion: PRODUCT_TELEMETRY_SCHEMA_VERSION,
    kind: "agent_resource_requested",
    occurredAt: now,
    receivedAt: now,
    anonymousSessionId: null,
    surface: "agent_resource",
    pageKey: AGENT_RESOURCE_PATHS[resource],
    ...actor,
    referrerSource: classifyProductTelemetryReferrer({
      referrerHost,
      platformHost,
    }),
    referrerHost: referrerHost ?? null,
    campaignSource: null,
    campaignMedium: null,
    campaignName: null,
    placement: null,
    externalTarget: null,
    agentResource: resource,
    deploymentEnvironment: deployment.environment,
    deploymentId: deployment.deploymentId,
  };
};

import type {
  productTelemetryDailyMetrics,
  productTelemetryDailySessionContributions,
} from "@/db/schema";
import { createHash } from "node:crypto";
import type { NormalizedProductTelemetryEvent } from "./types";

export type ProductTelemetryDailyMetricInsert =
  typeof productTelemetryDailyMetrics.$inferSelect;
export type ProductTelemetryDailySessionContributionInsert =
  typeof productTelemetryDailySessionContributions.$inferSelect;

const stableHash = (namespace: string, values: unknown[]): string =>
  `${namespace}_${createHash("sha256")
    .update(JSON.stringify(values))
    .digest("hex")}`;

const getBucketDate = (date: Date): string => date.toISOString().slice(0, 10);

const getMetricDimensions = (event: NormalizedProductTelemetryEvent) => ({
  bucketDate: getBucketDate(event.occurredAt),
  kind: event.kind,
  surface: event.surface,
  pageKey: event.pageKey,
  actorClass: event.actorClass,
  agentFamily: event.agentFamily ?? null,
  referrerSource: event.referrerSource,
  referrerHost: event.referrerHost ?? null,
  campaignSource: event.campaignSource ?? null,
  campaignMedium: event.campaignMedium ?? null,
  campaignName: event.campaignName ?? null,
  placement: event.placement ?? null,
  externalTarget: event.externalTarget ?? null,
  agentResource: event.agentResource ?? null,
  deploymentEnvironment: event.deploymentEnvironment,
  deploymentId: event.deploymentId,
});

export const createProductTelemetryProjection = (
  event: NormalizedProductTelemetryEvent,
): {
  metric: ProductTelemetryDailyMetricInsert;
  contribution: ProductTelemetryDailySessionContributionInsert | null;
} => {
  const dimensions = getMetricDimensions(event);
  const metricId = stableHash("ptm", [
    dimensions.bucketDate,
    dimensions.kind,
    dimensions.surface,
    dimensions.pageKey,
    dimensions.actorClass,
    dimensions.agentFamily,
    dimensions.referrerSource,
    dimensions.referrerHost,
    dimensions.campaignSource,
    dimensions.campaignMedium,
    dimensions.campaignName,
    dimensions.placement,
    dimensions.externalTarget,
    dimensions.agentResource,
    dimensions.deploymentEnvironment,
    dimensions.deploymentId,
  ]);

  return {
    metric: {
      id: metricId,
      ...dimensions,
      eventCount: 1,
      anonymousSessionCount: 0,
      firstOccurredAt: event.occurredAt,
      lastOccurredAt: event.occurredAt,
      createdAt: event.receivedAt,
      updatedAt: event.receivedAt,
    },
    contribution: event.anonymousSessionId
      ? {
          id: stableHash("pts", [metricId, event.anonymousSessionId]),
          metricId,
          bucketDate: dimensions.bucketDate,
          anonymousSessionId: event.anonymousSessionId,
          createdAt: event.receivedAt,
        }
      : null,
  };
};

export const rebuildProductTelemetryProjectionRows = (
  events: NormalizedProductTelemetryEvent[],
): {
  metrics: ProductTelemetryDailyMetricInsert[];
  contributions: ProductTelemetryDailySessionContributionInsert[];
} => {
  const metrics = new Map<string, ProductTelemetryDailyMetricInsert>();
  const contributions = new Map<
    string,
    ProductTelemetryDailySessionContributionInsert
  >();
  const seenEventIds = new Set<string>();

  for (const event of events) {
    if (seenEventIds.has(event.id)) {
      continue;
    }
    seenEventIds.add(event.id);

    const projection = createProductTelemetryProjection(event);
    const existing = metrics.get(projection.metric.id);
    if (!existing) {
      metrics.set(projection.metric.id, { ...projection.metric });
    } else {
      existing.eventCount = (existing.eventCount ?? 0) + 1;
      if (event.occurredAt < existing.firstOccurredAt) {
        existing.firstOccurredAt = event.occurredAt;
      }
      if (event.occurredAt > existing.lastOccurredAt) {
        existing.lastOccurredAt = event.occurredAt;
      }
      if (event.receivedAt < existing.createdAt) {
        existing.createdAt = event.receivedAt;
      }
      if (event.receivedAt > existing.updatedAt) {
        existing.updatedAt = event.receivedAt;
      }
    }

    if (projection.contribution) {
      const current = contributions.get(projection.contribution.id);
      if (
        !current ||
        (projection.contribution.createdAt &&
          current.createdAt &&
          projection.contribution.createdAt < current.createdAt)
      ) {
        contributions.set(projection.contribution.id, projection.contribution);
      }
    }
  }

  for (const contribution of contributions.values()) {
    const metric = metrics.get(contribution.metricId);
    if (!metric) {
      throw new Error(
        `Telemetry contribution references missing metric ${contribution.metricId}.`,
      );
    }
    metric.anonymousSessionCount = (metric.anonymousSessionCount ?? 0) + 1;
  }

  return {
    metrics: [...metrics.values()].sort((left, right) =>
      left.id.localeCompare(right.id),
    ),
    contributions: [...contributions.values()].sort((left, right) =>
      left.id.localeCompare(right.id),
    ),
  };
};

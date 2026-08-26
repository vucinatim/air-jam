import { db } from "@/db";
import * as schema from "@/db/schema";
import {
  productTelemetryDailyMetrics,
  productTelemetryDailySessionContributions,
  productTelemetryEvents,
} from "@/db/schema";
import { lt, sql } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import {
  createProductTelemetryProjection,
  rebuildProductTelemetryProjectionRows,
} from "./projection";
import type { NormalizedProductTelemetryEvent } from "./types";

export type ProductTelemetryDatabase = PostgresJsDatabase<typeof schema>;

export interface ProductTelemetryIngestResult {
  accepted: number;
  duplicates: number;
}

export interface ProductTelemetryProjectionWriter {
  insertRawEvent(event: NormalizedProductTelemetryEvent): Promise<boolean>;
  upsertMetricEvent(
    metric: ReturnType<typeof createProductTelemetryProjection>["metric"],
    event: NormalizedProductTelemetryEvent,
  ): Promise<void>;
  insertSessionContribution(
    contribution: NonNullable<
      ReturnType<typeof createProductTelemetryProjection>["contribution"]
    >,
  ): Promise<boolean>;
  incrementMetricSessionCount(metricId: string, updatedAt: Date): Promise<void>;
}

export const projectIncrementalProductTelemetryEvents = async (
  events: NormalizedProductTelemetryEvent[],
  writer: ProductTelemetryProjectionWriter,
): Promise<ProductTelemetryIngestResult> => {
  let accepted = 0;
  let duplicates = 0;

  for (const event of events) {
    if (!(await writer.insertRawEvent(event))) {
      duplicates += 1;
      continue;
    }

    accepted += 1;
    const projection = createProductTelemetryProjection(event);
    await writer.upsertMetricEvent(projection.metric, event);

    if (
      projection.contribution &&
      (await writer.insertSessionContribution(projection.contribution))
    ) {
      await writer.incrementMetricSessionCount(
        projection.metric.id,
        event.receivedAt,
      );
    }
  }

  return { accepted, duplicates };
};

export const ingestProductTelemetryEvents = async (
  events: NormalizedProductTelemetryEvent[],
  database: ProductTelemetryDatabase = db,
): Promise<ProductTelemetryIngestResult> => {
  if (events.length === 0) {
    return { accepted: 0, duplicates: 0 };
  }

  return database.transaction((tx) =>
    projectIncrementalProductTelemetryEvents(events, {
      async insertRawEvent(event) {
        const insertedEvents = await tx
          .insert(productTelemetryEvents)
          .values(event)
          .onConflictDoNothing({ target: productTelemetryEvents.id })
          .returning({ id: productTelemetryEvents.id });
        return insertedEvents.length > 0;
      },
      async upsertMetricEvent(metric, event) {
        await tx
          .insert(productTelemetryDailyMetrics)
          .values(metric)
          .onConflictDoUpdate({
            target: productTelemetryDailyMetrics.id,
            set: {
              eventCount: sql`${productTelemetryDailyMetrics.eventCount} + 1`,
              firstOccurredAt: sql`least(${productTelemetryDailyMetrics.firstOccurredAt}, ${event.occurredAt.toISOString()}::timestamptz)`,
              lastOccurredAt: sql`greatest(${productTelemetryDailyMetrics.lastOccurredAt}, ${event.occurredAt.toISOString()}::timestamptz)`,
              createdAt: sql`least(${productTelemetryDailyMetrics.createdAt}, ${event.receivedAt.toISOString()}::timestamptz)`,
              updatedAt: sql`greatest(${productTelemetryDailyMetrics.updatedAt}, ${event.receivedAt.toISOString()}::timestamptz)`,
            },
          });
      },
      async insertSessionContribution(contribution) {
        const insertedContributions = await tx
          .insert(productTelemetryDailySessionContributions)
          .values(contribution)
          .onConflictDoNothing({
            target: productTelemetryDailySessionContributions.id,
          })
          .returning({ id: productTelemetryDailySessionContributions.id });
        return insertedContributions.length > 0;
      },
      async incrementMetricSessionCount(metricId, updatedAt) {
        await tx
          .update(productTelemetryDailyMetrics)
          .set({
            anonymousSessionCount: sql`${productTelemetryDailyMetrics.anonymousSessionCount} + 1`,
            updatedAt,
          })
          .where(sql`${productTelemetryDailyMetrics.id} = ${metricId}`);
      },
    }),
  );
};

const chunksOf = <T>(values: T[], size: number): T[][] => {
  const chunks: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
};

export interface ProductTelemetryRebuildResult {
  rawEventCount: number;
  metricCount: number;
  sessionContributionCount: number;
}

export const previewProductTelemetryProjectionRebuild = async (
  database: ProductTelemetryDatabase = db,
): Promise<ProductTelemetryRebuildResult> => {
  const rawEvents = await database
    .select()
    .from(productTelemetryEvents)
    .orderBy(productTelemetryEvents.occurredAt, productTelemetryEvents.id);
  const projection = rebuildProductTelemetryProjectionRows(rawEvents);

  return {
    rawEventCount: rawEvents.length,
    metricCount: projection.metrics.length,
    sessionContributionCount: projection.contributions.length,
  };
};

export const rebuildProductTelemetryProjections = async (
  database: ProductTelemetryDatabase = db,
): Promise<ProductTelemetryRebuildResult> =>
  database.transaction(async (tx) => {
    const rawEvents = await tx
      .select()
      .from(productTelemetryEvents)
      .orderBy(productTelemetryEvents.occurredAt, productTelemetryEvents.id);
    const projection = rebuildProductTelemetryProjectionRows(rawEvents);

    await tx.delete(productTelemetryDailySessionContributions);
    await tx.delete(productTelemetryDailyMetrics);

    for (const metrics of chunksOf(projection.metrics, 500)) {
      await tx.insert(productTelemetryDailyMetrics).values(metrics);
    }
    for (const contributions of chunksOf(projection.contributions, 500)) {
      await tx
        .insert(productTelemetryDailySessionContributions)
        .values(contributions);
    }

    return {
      rawEventCount: rawEvents.length,
      metricCount: projection.metrics.length,
      sessionContributionCount: projection.contributions.length,
    };
  });

export const PRODUCT_TELEMETRY_RAW_RETENTION_DAYS = 90;
export const PRODUCT_TELEMETRY_SESSION_CONTRIBUTION_RETENTION_DAYS = 90;

export interface ProductTelemetryRetentionResult {
  rawEventsDeleted: number;
  sessionContributionsDeleted: number;
  rawCutoff: Date;
  sessionContributionCutoffDate: string;
}

const subtractUtcDays = (date: Date, days: number): Date =>
  new Date(date.getTime() - days * 24 * 60 * 60 * 1_000);

export interface ProductTelemetryRetentionCutoffs {
  rawCutoff: Date;
  sessionContributionCutoffDate: string;
}

export const resolveProductTelemetryRetentionCutoffs = ({
  now = new Date(),
  rawRetentionDays = PRODUCT_TELEMETRY_RAW_RETENTION_DAYS,
  sessionContributionRetentionDays = PRODUCT_TELEMETRY_SESSION_CONTRIBUTION_RETENTION_DAYS,
}: {
  now?: Date;
  rawRetentionDays?: number;
  sessionContributionRetentionDays?: number;
} = {}): ProductTelemetryRetentionCutoffs => {
  if (
    !Number.isInteger(rawRetentionDays) ||
    !Number.isInteger(sessionContributionRetentionDays) ||
    rawRetentionDays < 1 ||
    sessionContributionRetentionDays < 1
  ) {
    throw new Error("Telemetry retention periods must be positive whole days.");
  }

  return {
    rawCutoff: subtractUtcDays(now, rawRetentionDays),
    sessionContributionCutoffDate: subtractUtcDays(
      now,
      sessionContributionRetentionDays,
    )
      .toISOString()
      .slice(0, 10),
  };
};

export const applyProductTelemetryRetention = async ({
  now = new Date(),
  rawRetentionDays = PRODUCT_TELEMETRY_RAW_RETENTION_DAYS,
  sessionContributionRetentionDays = PRODUCT_TELEMETRY_SESSION_CONTRIBUTION_RETENTION_DAYS,
  database = db,
}: {
  now?: Date;
  rawRetentionDays?: number;
  sessionContributionRetentionDays?: number;
  database?: ProductTelemetryDatabase;
} = {}): Promise<ProductTelemetryRetentionResult> => {
  const { rawCutoff, sessionContributionCutoffDate } =
    resolveProductTelemetryRetentionCutoffs({
      now,
      rawRetentionDays,
      sessionContributionRetentionDays,
    });

  return database.transaction(async (tx) => {
    const deletedContributions = await tx
      .delete(productTelemetryDailySessionContributions)
      .where(
        lt(
          productTelemetryDailySessionContributions.bucketDate,
          sessionContributionCutoffDate,
        ),
      )
      .returning({ id: productTelemetryDailySessionContributions.id });
    const deletedEvents = await tx
      .delete(productTelemetryEvents)
      .where(lt(productTelemetryEvents.receivedAt, rawCutoff))
      .returning({ id: productTelemetryEvents.id });

    return {
      rawEventsDeleted: deletedEvents.length,
      sessionContributionsDeleted: deletedContributions.length,
      rawCutoff,
      sessionContributionCutoffDate,
    };
  });
};

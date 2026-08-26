import { db } from "@/db";
import {
  productTelemetryDailyMetrics,
  productTelemetryDailySessionContributions,
  productTelemetryEvents,
} from "@/db/schema";
import { PRODUCT_TELEMETRY_SCHEMA_VERSION } from "@/lib/product-telemetry-contract";
import { count, lt, max, min, sum } from "drizzle-orm";
import {
  PRODUCT_TELEMETRY_RAW_RETENTION_DAYS,
  PRODUCT_TELEMETRY_SESSION_CONTRIBUTION_RETENTION_DAYS,
  resolveProductTelemetryRetentionCutoffs,
  type ProductTelemetryDatabase,
} from "./persistence";

type NumericDatabaseValue = number | string | null | undefined;

export interface ProductTelemetryHealthRows {
  rawEvents: {
    count: NumericDatabaseValue;
    oldestReceivedAt: Date | null;
    latestReceivedAt: Date | null;
  };
  dailyMetrics: {
    count: NumericDatabaseValue;
    projectedEventCount: NumericDatabaseValue;
    earliestBucketDate: string | null;
    latestBucketDate: string | null;
  };
  sessionContributions: {
    count: NumericDatabaseValue;
    earliestBucketDate: string | null;
    latestBucketDate: string | null;
  };
  retentionEligible: {
    rawEvents: NumericDatabaseValue;
    sessionContributions: NumericDatabaseValue;
  };
}

export interface ProductTelemetryHealth {
  eventSchemaVersion: 1;
  status: "healthy";
  checkedAt: Date;
  storage: {
    rawEvents: {
      count: number;
      oldestReceivedAt: Date | null;
      latestReceivedAt: Date | null;
    };
    dailyMetrics: {
      count: number;
      projectedEventCount: number;
      earliestBucketDate: string | null;
      latestBucketDate: string | null;
    };
    sessionContributions: {
      count: number;
      earliestBucketDate: string | null;
      latestBucketDate: string | null;
    };
  };
  retention: {
    rawEventDays: number;
    sessionContributionDays: number;
    rawCutoff: Date;
    sessionContributionCutoffDate: string;
    eligibleRawEvents: number;
    eligibleSessionContributions: number;
  };
}

const numeric = (value: NumericDatabaseValue): number => Number(value ?? 0);

export const buildProductTelemetryHealth = ({
  rows,
  now = new Date(),
}: {
  rows: ProductTelemetryHealthRows;
  now?: Date;
}): ProductTelemetryHealth => {
  const { rawCutoff, sessionContributionCutoffDate } =
    resolveProductTelemetryRetentionCutoffs({ now });

  return {
    eventSchemaVersion: PRODUCT_TELEMETRY_SCHEMA_VERSION,
    status: "healthy",
    checkedAt: now,
    storage: {
      rawEvents: {
        count: numeric(rows.rawEvents.count),
        oldestReceivedAt: rows.rawEvents.oldestReceivedAt,
        latestReceivedAt: rows.rawEvents.latestReceivedAt,
      },
      dailyMetrics: {
        count: numeric(rows.dailyMetrics.count),
        projectedEventCount: numeric(rows.dailyMetrics.projectedEventCount),
        earliestBucketDate: rows.dailyMetrics.earliestBucketDate,
        latestBucketDate: rows.dailyMetrics.latestBucketDate,
      },
      sessionContributions: {
        count: numeric(rows.sessionContributions.count),
        earliestBucketDate: rows.sessionContributions.earliestBucketDate,
        latestBucketDate: rows.sessionContributions.latestBucketDate,
      },
    },
    retention: {
      rawEventDays: PRODUCT_TELEMETRY_RAW_RETENTION_DAYS,
      sessionContributionDays:
        PRODUCT_TELEMETRY_SESSION_CONTRIBUTION_RETENTION_DAYS,
      rawCutoff,
      sessionContributionCutoffDate,
      eligibleRawEvents: numeric(rows.retentionEligible.rawEvents),
      eligibleSessionContributions: numeric(
        rows.retentionEligible.sessionContributions,
      ),
    },
  };
};

export const getProductTelemetryHealth = async ({
  database = db,
  now = new Date(),
}: {
  database?: ProductTelemetryDatabase;
  now?: Date;
} = {}): Promise<ProductTelemetryHealth> => {
  const { rawCutoff, sessionContributionCutoffDate } =
    resolveProductTelemetryRetentionCutoffs({ now });
  const [
    rawEvents,
    dailyMetrics,
    sessionContributions,
    eligibleRawEvents,
    eligibleSessionContributions,
  ] = await Promise.all([
    database
      .select({
        count: count(),
        oldestReceivedAt: min(productTelemetryEvents.receivedAt),
        latestReceivedAt: max(productTelemetryEvents.receivedAt),
      })
      .from(productTelemetryEvents),
    database
      .select({
        count: count(),
        projectedEventCount: sum(productTelemetryDailyMetrics.eventCount),
        earliestBucketDate: min(productTelemetryDailyMetrics.bucketDate),
        latestBucketDate: max(productTelemetryDailyMetrics.bucketDate),
      })
      .from(productTelemetryDailyMetrics),
    database
      .select({
        count: count(),
        earliestBucketDate: min(
          productTelemetryDailySessionContributions.bucketDate,
        ),
        latestBucketDate: max(
          productTelemetryDailySessionContributions.bucketDate,
        ),
      })
      .from(productTelemetryDailySessionContributions),
    database
      .select({ count: count() })
      .from(productTelemetryEvents)
      .where(lt(productTelemetryEvents.receivedAt, rawCutoff)),
    database
      .select({ count: count() })
      .from(productTelemetryDailySessionContributions)
      .where(
        lt(
          productTelemetryDailySessionContributions.bucketDate,
          sessionContributionCutoffDate,
        ),
      ),
  ]);

  return buildProductTelemetryHealth({
    now,
    rows: {
      rawEvents: {
        count: rawEvents[0]?.count ?? 0,
        oldestReceivedAt: rawEvents[0]?.oldestReceivedAt ?? null,
        latestReceivedAt: rawEvents[0]?.latestReceivedAt ?? null,
      },
      dailyMetrics: {
        count: dailyMetrics[0]?.count ?? 0,
        projectedEventCount: dailyMetrics[0]?.projectedEventCount ?? 0,
        earliestBucketDate: dailyMetrics[0]?.earliestBucketDate ?? null,
        latestBucketDate: dailyMetrics[0]?.latestBucketDate ?? null,
      },
      sessionContributions: {
        count: sessionContributions[0]?.count ?? 0,
        earliestBucketDate: sessionContributions[0]?.earliestBucketDate ?? null,
        latestBucketDate: sessionContributions[0]?.latestBucketDate ?? null,
      },
      retentionEligible: {
        rawEvents: eligibleRawEvents[0]?.count ?? 0,
        sessionContributions: eligibleSessionContributions[0]?.count ?? 0,
      },
    },
  });
};

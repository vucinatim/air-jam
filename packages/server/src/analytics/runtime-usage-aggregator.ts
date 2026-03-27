import { and, eq, inArray } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import {
  runtimeUsageControllerSegments,
  runtimeUsageDailyGameMetrics,
  runtimeUsageEligibleSegments,
  runtimeUsageGameSegments,
  runtimeUsageGameSessionMetrics,
} from "../db.js";
import {
  buildRuntimeUsageDailyGameMetrics,
  buildRuntimeUsageGameSessionMetrics,
} from "./runtime-usage-aggregates-domain.js";

type RuntimeUsageDb = PostgresJsDatabase<Record<string, never>>;

export const refreshRuntimeUsageAggregatesForSession = async (
  db: RuntimeUsageDb,
  runtimeSessionId: string,
  referenceTime: Date,
): Promise<void> => {
  const previousSessionMetrics = await db
    .select()
    .from(runtimeUsageGameSessionMetrics)
    .where(eq(runtimeUsageGameSessionMetrics.runtimeSessionId, runtimeSessionId));

  const [gameSegments, controllerSegments, eligibleSegments] = await Promise.all([
    db
      .select()
      .from(runtimeUsageGameSegments)
      .where(eq(runtimeUsageGameSegments.runtimeSessionId, runtimeSessionId)),
    db
      .select()
      .from(runtimeUsageControllerSegments)
      .where(
        eq(runtimeUsageControllerSegments.runtimeSessionId, runtimeSessionId),
      ),
    db
      .select()
      .from(runtimeUsageEligibleSegments)
      .where(eq(runtimeUsageEligibleSegments.runtimeSessionId, runtimeSessionId)),
  ]);

  const sessionMetrics = buildRuntimeUsageGameSessionMetrics(
    gameSegments,
    controllerSegments,
    eligibleSegments,
    referenceTime,
  );

  await db
    .delete(runtimeUsageGameSessionMetrics)
    .where(eq(runtimeUsageGameSessionMetrics.runtimeSessionId, runtimeSessionId));

  if (sessionMetrics.length > 0) {
    await db.insert(runtimeUsageGameSessionMetrics).values(
      sessionMetrics.map((sessionMetric) => ({
        id: sessionMetric.id,
        runtimeSessionId: sessionMetric.runtimeSessionId,
        roomId: sessionMetric.roomId,
        appId: sessionMetric.appId ?? null,
        gameId: sessionMetric.gameId,
        startedAt: sessionMetric.startedAt,
        endedAt: sessionMetric.endedAt,
        controllerSeconds: sessionMetric.controllerSeconds,
        eligiblePlaytimeSeconds: sessionMetric.eligiblePlaytimeSeconds,
        peakConcurrentControllers: sessionMetric.peakConcurrentControllers,
        updatedAt: referenceTime,
      })),
    );
  }

  const affectedGameIds = Array.from(
    new Set(
      [...previousSessionMetrics, ...sessionMetrics].map((metric) => metric.gameId),
    ),
  );
  const affectedBucketDates = Array.from(
    new Set(
      [...previousSessionMetrics, ...sessionMetrics].map((metric) =>
        metric.startedAt.toISOString().slice(0, 10),
      ),
    ),
  );

  if (affectedGameIds.length === 0 || affectedBucketDates.length === 0) {
    return;
  }

  const relevantSessionMetrics = await db
    .select()
    .from(runtimeUsageGameSessionMetrics)
    .where(inArray(runtimeUsageGameSessionMetrics.gameId, affectedGameIds));

  // Drizzle does not express date bucket filtering well here without raw SQL, so
  // use the in-memory reducer over the full relevant set per game and replace the
  // affected daily rows deterministically.
  const recomputedDailyMetrics = buildRuntimeUsageDailyGameMetrics(
    relevantSessionMetrics.map((metric) => ({
      ...metric,
      appId: metric.appId ?? undefined,
    })),
    referenceTime,
  ).filter((metric) => affectedBucketDates.includes(metric.bucketDate));

  await db
    .delete(runtimeUsageDailyGameMetrics)
    .where(
      and(
        inArray(runtimeUsageDailyGameMetrics.gameId, affectedGameIds),
        inArray(runtimeUsageDailyGameMetrics.bucketDate, affectedBucketDates),
      ),
    );

  if (recomputedDailyMetrics.length > 0) {
    await db.insert(runtimeUsageDailyGameMetrics).values(
      recomputedDailyMetrics.map((metric) => ({
        id: metric.id,
        bucketDate: metric.bucketDate,
        appId: metric.appId ?? null,
        gameId: metric.gameId,
        sessionCount: metric.sessionCount,
        totalGameActiveSeconds: metric.totalGameActiveSeconds,
        totalControllerSeconds: metric.totalControllerSeconds,
        totalEligiblePlaytimeSeconds: metric.totalEligiblePlaytimeSeconds,
        peakConcurrentControllers: metric.peakConcurrentControllers,
        lastActivityAt: metric.lastActivityAt,
        updatedAt: referenceTime,
      })),
    );
  }
};

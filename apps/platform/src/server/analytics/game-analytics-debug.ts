import { db } from "@/db";
import {
  runtimeUsageControllerSegments,
  runtimeUsageEligibleSegments,
  runtimeUsageEvents,
  runtimeUsageGameSegments,
  runtimeUsageGameSessionMetrics,
  runtimeUsageSessions,
} from "@/db/schema";
import { and, count, desc, eq, isNull } from "drizzle-orm";

export interface GameAnalyticsDebugSnapshot {
  runtimeSessionId: string | null;
  roomId: string | null;
  sessionStartedAt: Date | null;
  rawEventCount: number;
  latestEventAt: Date | null;
  latestMetricUpdatedAt: Date | null;
  openSegmentCounts: {
    controller: number;
    game: number;
    eligible: number;
  };
  totalSegmentCounts: {
    controller: number;
    game: number;
    eligible: number;
  };
  latestSessionMetric: {
    id: string;
    runtimeSessionId: string;
    startedAt: Date;
    endedAt: Date | null;
    controllerSeconds: number;
    rawEligiblePlaytimeSeconds: number;
    eligiblePlaytimeSeconds: number;
    trustFlags: string[];
    peakConcurrentControllers: number;
  } | null;
  recentEvents: Array<{
    id: string;
    kind: string;
    occurredAt: Date;
    payloadSummary: string | null;
  }>;
}

const summarizePayload = (
  payload: Record<string, unknown> | null,
): string | null => {
  if (!payload) {
    return null;
  }

  const interestingKeys = ["controllerId", "reason", "activation", "gameId"];
  const parts = interestingKeys
    .map((key) => {
      const value = payload[key];
      return typeof value === "string" && value.length > 0
        ? `${key}=${value}`
        : null;
    })
    .filter((value): value is string => value !== null);

  return parts.length > 0 ? parts.join(" ") : null;
};

const countForSession = async (
  runtimeSessionId: string,
  table:
    | typeof runtimeUsageControllerSegments
    | typeof runtimeUsageGameSegments
    | typeof runtimeUsageEligibleSegments,
) => {
  const [result] = await db
    .select({ value: count() })
    .from(table)
    .where(eq(table.runtimeSessionId, runtimeSessionId));

  return result?.value ?? 0;
};

const openCountForSession = async (
  runtimeSessionId: string,
  table:
    | typeof runtimeUsageControllerSegments
    | typeof runtimeUsageGameSegments
    | typeof runtimeUsageEligibleSegments,
) => {
  const [result] = await db
    .select({ value: count() })
    .from(table)
    .where(
      and(eq(table.runtimeSessionId, runtimeSessionId), isNull(table.endedAt)),
    );

  return result?.value ?? 0;
};

export const getGameAnalyticsDebugSnapshot = async (
  gameId: string,
): Promise<GameAnalyticsDebugSnapshot> => {
  const [latestSessionMetric] = await db
    .select()
    .from(runtimeUsageGameSessionMetrics)
    .where(eq(runtimeUsageGameSessionMetrics.gameId, gameId))
    .orderBy(desc(runtimeUsageGameSessionMetrics.startedAt))
    .limit(1);

  if (!latestSessionMetric) {
    return {
      runtimeSessionId: null,
      roomId: null,
      sessionStartedAt: null,
      rawEventCount: 0,
      latestEventAt: null,
      latestMetricUpdatedAt: null,
      openSegmentCounts: { controller: 0, game: 0, eligible: 0 },
      totalSegmentCounts: { controller: 0, game: 0, eligible: 0 },
      latestSessionMetric: null,
      recentEvents: [],
    };
  }

  const runtimeSessionId = latestSessionMetric.runtimeSessionId;
  const [
    [session],
    [rawEventCount],
    recentEvents,
    controllerCount,
    gameCount,
    eligibleCount,
    openControllerCount,
    openGameCount,
    openEligibleCount,
  ] = await Promise.all([
    db
      .select()
      .from(runtimeUsageSessions)
      .where(eq(runtimeUsageSessions.id, runtimeSessionId))
      .limit(1),
    db
      .select({ value: count() })
      .from(runtimeUsageEvents)
      .where(eq(runtimeUsageEvents.runtimeSessionId, runtimeSessionId)),
    db
      .select()
      .from(runtimeUsageEvents)
      .where(eq(runtimeUsageEvents.runtimeSessionId, runtimeSessionId))
      .orderBy(desc(runtimeUsageEvents.occurredAt))
      .limit(12),
    countForSession(runtimeSessionId, runtimeUsageControllerSegments),
    countForSession(runtimeSessionId, runtimeUsageGameSegments),
    countForSession(runtimeSessionId, runtimeUsageEligibleSegments),
    openCountForSession(runtimeSessionId, runtimeUsageControllerSegments),
    openCountForSession(runtimeSessionId, runtimeUsageGameSegments),
    openCountForSession(runtimeSessionId, runtimeUsageEligibleSegments),
  ]);

  return {
    runtimeSessionId,
    roomId: session?.roomId ?? latestSessionMetric.roomId,
    sessionStartedAt: session?.startedAt ?? latestSessionMetric.startedAt,
    rawEventCount: rawEventCount?.value ?? 0,
    latestEventAt: recentEvents[0]?.occurredAt ?? null,
    latestMetricUpdatedAt: latestSessionMetric.updatedAt,
    openSegmentCounts: {
      controller: openControllerCount,
      game: openGameCount,
      eligible: openEligibleCount,
    },
    totalSegmentCounts: {
      controller: controllerCount,
      game: gameCount,
      eligible: eligibleCount,
    },
    latestSessionMetric: {
      id: latestSessionMetric.id,
      runtimeSessionId: latestSessionMetric.runtimeSessionId,
      startedAt: latestSessionMetric.startedAt,
      endedAt: latestSessionMetric.endedAt,
      controllerSeconds: latestSessionMetric.controllerSeconds,
      rawEligiblePlaytimeSeconds:
        latestSessionMetric.rawEligiblePlaytimeSeconds,
      eligiblePlaytimeSeconds: latestSessionMetric.eligiblePlaytimeSeconds,
      trustFlags: latestSessionMetric.trustFlags,
      peakConcurrentControllers: latestSessionMetric.peakConcurrentControllers,
    },
    recentEvents: recentEvents.map((event) => ({
      id: event.id,
      kind: event.kind,
      occurredAt: event.occurredAt,
      payloadSummary: summarizePayload(event.payload),
    })),
  };
};

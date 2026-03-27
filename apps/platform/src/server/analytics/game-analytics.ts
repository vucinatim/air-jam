import { db } from "@/db";
import {
  runtimeUsageDailyGameMetrics,
  runtimeUsageGameSessionMetrics,
} from "@/db/schema";
import { and, desc, eq, gte } from "drizzle-orm";

export interface GameAnalyticsDailyRow {
  bucketDate: string;
  sessionCount: number;
  totalGameActiveSeconds: number;
  totalControllerSeconds: number;
  totalRawEligiblePlaytimeSeconds: number;
  totalEligiblePlaytimeSeconds: number;
  guardedSessionCount: number;
  peakConcurrentControllers: number;
  lastActivityAt: Date | null;
}

export interface GameAnalyticsDailyPoint extends GameAnalyticsDailyRow {}

export interface GameAnalyticsOverviewTotals {
  sessionCount: number;
  totalGameActiveSeconds: number;
  totalControllerSeconds: number;
  totalRawEligiblePlaytimeSeconds: number;
  totalEligiblePlaytimeSeconds: number;
  guardedSessionCount: number;
  peakConcurrentControllers: number;
  lastActivityAt: Date | null;
}

export interface GameAnalyticsOverview {
  days: number;
  totals: GameAnalyticsOverviewTotals;
  daily: GameAnalyticsDailyPoint[];
}

const toUtcDateString = (date: Date): string => date.toISOString().slice(0, 10);

const addUtcDays = (value: Date, days: number): Date => {
  const next = new Date(value);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
};

export const buildGameAnalyticsOverview = (
  rows: GameAnalyticsDailyRow[],
  days: number,
  now = new Date(),
): GameAnalyticsOverview => {
  const todayUtc = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  const sinceUtc = addUtcDays(todayUtc, -(days - 1));
  const rowByDate = new Map(rows.map((row) => [row.bucketDate, row]));

  const daily = Array.from({ length: days }, (_, index) => {
    const bucketDate = toUtcDateString(addUtcDays(sinceUtc, index));
    const row = rowByDate.get(bucketDate);

    return {
      bucketDate,
      sessionCount: row?.sessionCount ?? 0,
      totalGameActiveSeconds: row?.totalGameActiveSeconds ?? 0,
      totalControllerSeconds: row?.totalControllerSeconds ?? 0,
      totalRawEligiblePlaytimeSeconds:
        row?.totalRawEligiblePlaytimeSeconds ?? 0,
      totalEligiblePlaytimeSeconds: row?.totalEligiblePlaytimeSeconds ?? 0,
      guardedSessionCount: row?.guardedSessionCount ?? 0,
      peakConcurrentControllers: row?.peakConcurrentControllers ?? 0,
      lastActivityAt: row?.lastActivityAt ?? null,
    };
  });

  const totals = daily.reduce<GameAnalyticsOverviewTotals>(
    (acc, day) => ({
      sessionCount: acc.sessionCount + day.sessionCount,
      totalGameActiveSeconds:
        acc.totalGameActiveSeconds + day.totalGameActiveSeconds,
      totalControllerSeconds:
        acc.totalControllerSeconds + day.totalControllerSeconds,
      totalRawEligiblePlaytimeSeconds:
        acc.totalRawEligiblePlaytimeSeconds +
        day.totalRawEligiblePlaytimeSeconds,
      totalEligiblePlaytimeSeconds:
        acc.totalEligiblePlaytimeSeconds + day.totalEligiblePlaytimeSeconds,
      guardedSessionCount: acc.guardedSessionCount + day.guardedSessionCount,
      peakConcurrentControllers: Math.max(
        acc.peakConcurrentControllers,
        day.peakConcurrentControllers,
      ),
      lastActivityAt:
        !acc.lastActivityAt ||
        (day.lastActivityAt &&
          day.lastActivityAt.getTime() > acc.lastActivityAt.getTime())
          ? day.lastActivityAt
          : acc.lastActivityAt,
    }),
    {
      sessionCount: 0,
      totalGameActiveSeconds: 0,
      totalControllerSeconds: 0,
      totalRawEligiblePlaytimeSeconds: 0,
      totalEligiblePlaytimeSeconds: 0,
      guardedSessionCount: 0,
      peakConcurrentControllers: 0,
      lastActivityAt: null,
    },
  );

  return {
    days,
    totals,
    daily,
  };
};

export const getGameAnalyticsOverview = async (
  gameId: string,
  days: number,
): Promise<GameAnalyticsOverview> => {
  const now = new Date();
  const todayUtc = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  const sinceUtc = addUtcDays(todayUtc, -(days - 1));

  const rows = await db
    .select({
      bucketDate: runtimeUsageDailyGameMetrics.bucketDate,
      sessionCount: runtimeUsageDailyGameMetrics.sessionCount,
      totalGameActiveSeconds: runtimeUsageDailyGameMetrics.totalGameActiveSeconds,
      totalControllerSeconds: runtimeUsageDailyGameMetrics.totalControllerSeconds,
      totalRawEligiblePlaytimeSeconds:
        runtimeUsageDailyGameMetrics.totalRawEligiblePlaytimeSeconds,
      totalEligiblePlaytimeSeconds:
        runtimeUsageDailyGameMetrics.totalEligiblePlaytimeSeconds,
      guardedSessionCount: runtimeUsageDailyGameMetrics.guardedSessionCount,
      peakConcurrentControllers:
        runtimeUsageDailyGameMetrics.peakConcurrentControllers,
      lastActivityAt: runtimeUsageDailyGameMetrics.lastActivityAt,
    })
    .from(runtimeUsageDailyGameMetrics)
    .where(
      and(
        eq(runtimeUsageDailyGameMetrics.gameId, gameId),
        gte(runtimeUsageDailyGameMetrics.bucketDate, toUtcDateString(sinceUtc)),
      ),
    )
    .orderBy(runtimeUsageDailyGameMetrics.bucketDate);

  return buildGameAnalyticsOverview(rows, days, now);
};

export const getRecentGameAnalyticsSessions = async (
  gameId: string,
  limit: number,
) => {
  return await db
    .select()
    .from(runtimeUsageGameSessionMetrics)
    .where(eq(runtimeUsageGameSessionMetrics.gameId, gameId))
    .orderBy(desc(runtimeUsageGameSessionMetrics.startedAt))
    .limit(limit);
};

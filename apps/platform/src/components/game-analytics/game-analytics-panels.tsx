/* ------------------------------------------------------------------ */
/*  Shared analytics types and formatting helpers                      */
/*                                                                     */
/*  Consumed by the game overview page (types only) and the            */
/*  dedicated analytics page (types + formatters).                     */
/* ------------------------------------------------------------------ */

export interface GameAnalyticsDailyPoint {
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

export interface GameAnalyticsTotals {
  sessionCount: number;
  totalGameActiveSeconds: number;
  totalControllerSeconds: number;
  totalRawEligiblePlaytimeSeconds: number;
  totalEligiblePlaytimeSeconds: number;
  guardedSessionCount: number;
  peakConcurrentControllers: number;
  lastActivityAt: Date | null;
}

export interface GameAnalyticsSession {
  id: string;
  runtimeSessionId: string;
  startedAt: Date;
  endedAt: Date | null;
  controllerSeconds: number;
  rawEligiblePlaytimeSeconds: number;
  eligiblePlaytimeSeconds: number;
  trustFlags: string[];
  peakConcurrentControllers: number;
}

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
  latestSessionMetric: GameAnalyticsSession | null;
  recentEvents: Array<{
    id: string;
    kind: string;
    occurredAt: Date;
    payloadSummary: string | null;
  }>;
}

/* ------------------------------------------------------------------ */
/*  Formatters                                                         */
/* ------------------------------------------------------------------ */

export const formatAnalyticsDuration = (seconds: number): string => {
  if (seconds <= 0) return "0s";
  if (seconds < 60) return `${seconds}s`;
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0 && minutes > 0) return `${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h`;
  return `${minutes}m`;
};

export const formatAnalyticsTimestamp = (value?: Date | null): string => {
  if (!value) return "No activity yet";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(value);
};

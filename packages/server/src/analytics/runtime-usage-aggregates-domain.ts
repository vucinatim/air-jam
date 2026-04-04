import { evaluateRuntimeUsageSessionTrust } from "./runtime-usage-trust-domain.js";

export interface RuntimeUsageInterval {
  startedAt: Date;
  endedAt: Date | null;
}

export interface RuntimeUsageGameSegment extends RuntimeUsageInterval {
  id: string;
  runtimeSessionId: string;
  roomId: string;
  appId?: string | null;
  gameId: string;
}

export interface RuntimeUsageControllerSegment extends RuntimeUsageInterval {
  id: string;
  runtimeSessionId: string;
  roomId: string;
  appId?: string | null;
  controllerId: string;
}

export interface RuntimeUsageEligibleSegment extends RuntimeUsageInterval {
  id: string;
  runtimeSessionId: string;
  roomId: string;
  appId?: string | null;
  gameId?: string | null;
}

export interface RuntimeUsageGameSessionMetric {
  id: string;
  runtimeSessionId: string;
  roomId: string;
  appId?: string | null;
  gameId: string;
  startedAt: Date;
  endedAt: Date | null;
  controllerSeconds: number;
  rawEligiblePlaytimeSeconds: number;
  eligiblePlaytimeSeconds: number;
  trustFlags: string[];
  peakConcurrentControllers: number;
}

export interface RuntimeUsageDailyGameMetric {
  id: string;
  bucketDate: string;
  appId?: string | null;
  gameId: string;
  sessionCount: number;
  totalGameActiveSeconds: number;
  totalControllerSeconds: number;
  totalRawEligiblePlaytimeSeconds: number;
  totalEligiblePlaytimeSeconds: number;
  guardedSessionCount: number;
  peakConcurrentControllers: number;
  lastActivityAt: Date | null;
}

const clampEnd = (endedAt: Date | null, referenceTime: Date): Date =>
  endedAt && endedAt <= referenceTime ? endedAt : referenceTime;

const durationSeconds = (
  startedAt: Date,
  endedAt: Date | null,
  referenceTime: Date,
): number => {
  const end = clampEnd(endedAt, referenceTime);
  return Math.max(0, Math.floor((end.getTime() - startedAt.getTime()) / 1000));
};

const overlapSeconds = (
  left: RuntimeUsageInterval,
  right: RuntimeUsageInterval,
  referenceTime: Date,
): number => {
  const start = Math.max(left.startedAt.getTime(), right.startedAt.getTime());
  const end = Math.min(
    clampEnd(left.endedAt, referenceTime).getTime(),
    clampEnd(right.endedAt, referenceTime).getTime(),
  );

  return Math.max(0, Math.floor((end - start) / 1000));
};

const peakConcurrentControllers = (
  gameSegment: RuntimeUsageGameSegment,
  controllerSegments: RuntimeUsageControllerSegment[],
  referenceTime: Date,
): number => {
  const points: Array<{ time: number; delta: number }> = [];

  for (const controllerSegment of controllerSegments) {
    const overlapStart = Math.max(
      gameSegment.startedAt.getTime(),
      controllerSegment.startedAt.getTime(),
    );
    const overlapEnd = Math.min(
      clampEnd(gameSegment.endedAt, referenceTime).getTime(),
      clampEnd(controllerSegment.endedAt, referenceTime).getTime(),
    );

    if (overlapEnd <= overlapStart) {
      continue;
    }

    points.push({ time: overlapStart, delta: 1 });
    points.push({ time: overlapEnd, delta: -1 });
  }

  points.sort((a, b) => {
    if (a.time !== b.time) {
      return a.time - b.time;
    }

    return a.delta - b.delta;
  });

  let active = 0;
  let peak = 0;
  for (const point of points) {
    active += point.delta;
    peak = Math.max(peak, active);
  }

  return peak;
};

const toUtcDateBucket = (value: Date): string => value.toISOString().slice(0, 10);

export const buildRuntimeUsageGameSessionMetrics = (
  gameSegments: RuntimeUsageGameSegment[],
  controllerSegments: RuntimeUsageControllerSegment[],
  eligibleSegments: RuntimeUsageEligibleSegment[],
  referenceTime: Date,
): RuntimeUsageGameSessionMetric[] =>
  gameSegments.map((gameSegment) => {
    const gameActiveSeconds = durationSeconds(
      gameSegment.startedAt,
      gameSegment.endedAt,
      referenceTime,
    );
    const controllerSeconds = controllerSegments.reduce(
      (sum, controllerSegment) =>
        sum + overlapSeconds(gameSegment, controllerSegment, referenceTime),
      0,
    );
    const rawEligiblePlaytimeSeconds = eligibleSegments.reduce(
      (sum, eligibleSegment) =>
        sum + overlapSeconds(gameSegment, eligibleSegment, referenceTime),
      0,
    );
    const trust = evaluateRuntimeUsageSessionTrust(
      gameSegment,
      controllerSegments,
      gameActiveSeconds,
      rawEligiblePlaytimeSeconds,
      referenceTime,
    );

    return {
      id: gameSegment.id,
      runtimeSessionId: gameSegment.runtimeSessionId,
      roomId: gameSegment.roomId,
      appId: gameSegment.appId,
      gameId: gameSegment.gameId,
      startedAt: gameSegment.startedAt,
      endedAt: gameSegment.endedAt,
      controllerSeconds,
      rawEligiblePlaytimeSeconds,
      eligiblePlaytimeSeconds: trust.trustedEligiblePlaytimeSeconds,
      trustFlags: trust.trustFlags,
      peakConcurrentControllers: peakConcurrentControllers(
        gameSegment,
        controllerSegments,
        referenceTime,
      ),
    };
  });

export const buildRuntimeUsageDailyGameMetrics = (
  sessionMetrics: RuntimeUsageGameSessionMetric[],
  referenceTime: Date,
): RuntimeUsageDailyGameMetric[] => {
  const aggregateMap = new Map<string, RuntimeUsageDailyGameMetric>();

  for (const sessionMetric of sessionMetrics) {
    const bucketDate = toUtcDateBucket(sessionMetric.startedAt);
    const id = `${sessionMetric.gameId}:${sessionMetric.appId ?? "no-app"}:${bucketDate}`;
    const current = aggregateMap.get(id);
    const totalGameActiveSeconds = durationSeconds(
      sessionMetric.startedAt,
      sessionMetric.endedAt,
      referenceTime,
    );
    const lastActivityAt = clampEnd(sessionMetric.endedAt, referenceTime);

    if (!current) {
      aggregateMap.set(id, {
        id,
        bucketDate,
        appId: sessionMetric.appId,
        gameId: sessionMetric.gameId,
        sessionCount: 1,
        totalGameActiveSeconds,
        totalControllerSeconds: sessionMetric.controllerSeconds,
        totalRawEligiblePlaytimeSeconds: sessionMetric.rawEligiblePlaytimeSeconds,
        totalEligiblePlaytimeSeconds: sessionMetric.eligiblePlaytimeSeconds,
        guardedSessionCount: sessionMetric.trustFlags.length > 0 ? 1 : 0,
        peakConcurrentControllers: sessionMetric.peakConcurrentControllers,
        lastActivityAt,
      });
      continue;
    }

    current.sessionCount += 1;
    current.totalGameActiveSeconds += totalGameActiveSeconds;
    current.totalControllerSeconds += sessionMetric.controllerSeconds;
    current.totalRawEligiblePlaytimeSeconds +=
      sessionMetric.rawEligiblePlaytimeSeconds;
    current.totalEligiblePlaytimeSeconds +=
      sessionMetric.eligiblePlaytimeSeconds;
    current.guardedSessionCount += sessionMetric.trustFlags.length > 0 ? 1 : 0;
    current.peakConcurrentControllers = Math.max(
      current.peakConcurrentControllers,
      sessionMetric.peakConcurrentControllers,
    );
    current.lastActivityAt =
      current.lastActivityAt && current.lastActivityAt > lastActivityAt
        ? current.lastActivityAt
        : lastActivityAt;
  }

  return Array.from(aggregateMap.values());
};

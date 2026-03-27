import type {
  RuntimeUsageControllerSegment,
  RuntimeUsageGameSegment,
} from "./runtime-usage-aggregates-domain.js";

export interface RuntimeUsageTrustEvaluation {
  trustFlags: string[];
  trustedEligiblePlaytimeSeconds: number;
}

export const MIN_TRUSTED_GAME_ACTIVE_SECONDS = 15;
export const MIN_TRUSTED_ELIGIBLE_PLAYTIME_SECONDS = 15;
export const SHORT_SESSION_RECONNECT_CHURN_MAX_ELIGIBLE_SECONDS = 120;
export const SHORT_SESSION_RECONNECT_OVERFLOW_THRESHOLD = 3;

const clampEnd = (endedAt: Date | null, referenceTime: Date): Date =>
  endedAt && endedAt <= referenceTime ? endedAt : referenceTime;

const overlapsGameSegment = (
  gameSegment: RuntimeUsageGameSegment,
  controllerSegment: RuntimeUsageControllerSegment,
  referenceTime: Date,
): boolean => {
  const start = Math.max(
    gameSegment.startedAt.getTime(),
    controllerSegment.startedAt.getTime(),
  );
  const end = Math.min(
    clampEnd(gameSegment.endedAt, referenceTime).getTime(),
    clampEnd(controllerSegment.endedAt, referenceTime).getTime(),
  );

  return end > start;
};

export const evaluateRuntimeUsageSessionTrust = (
  gameSegment: RuntimeUsageGameSegment,
  controllerSegments: RuntimeUsageControllerSegment[],
  gameActiveSeconds: number,
  rawEligiblePlaytimeSeconds: number,
  referenceTime: Date,
): RuntimeUsageTrustEvaluation => {
  const trustFlags: string[] = [];

  if (gameActiveSeconds < MIN_TRUSTED_GAME_ACTIVE_SECONDS) {
    trustFlags.push("below_minimum_game_active_seconds");
  }

  if (rawEligiblePlaytimeSeconds < MIN_TRUSTED_ELIGIBLE_PLAYTIME_SECONDS) {
    trustFlags.push("below_minimum_eligible_seconds");
  }

  const overlappingControllerSegments = controllerSegments.filter(
    (controllerSegment) =>
      overlapsGameSegment(gameSegment, controllerSegment, referenceTime),
  );
  const uniqueControllerCount = new Set(
    overlappingControllerSegments.map((controllerSegment) => controllerSegment.controllerId),
  ).size;
  const reconnectOverflow = Math.max(
    0,
    overlappingControllerSegments.length - uniqueControllerCount,
  );

  if (
    reconnectOverflow >= SHORT_SESSION_RECONNECT_OVERFLOW_THRESHOLD &&
    rawEligiblePlaytimeSeconds <= SHORT_SESSION_RECONNECT_CHURN_MAX_ELIGIBLE_SECONDS
  ) {
    trustFlags.push("reconnect_churn_detected");
  }

  return {
    trustFlags,
    trustedEligiblePlaytimeSeconds:
      trustFlags.length > 0 ? 0 : rawEligiblePlaytimeSeconds,
  };
};

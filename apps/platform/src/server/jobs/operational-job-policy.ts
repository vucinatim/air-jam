import {
  operationalJobKindValues,
  type OperationalJobKind,
  type OperationalLane,
} from "@air-jam/database-contract";

export type OperationalJobPolicy = Readonly<{
  kind: OperationalJobKind;
  lane: OperationalLane;
  globalConcurrency: number;
  perCreatorConcurrency: number;
  queueDepth: number;
  maxAttempts: number;
  leaseSeconds: number;
  deadlineSeconds: number;
  retryBackoffSeconds: number;
}>;

export class OperationalJobPolicyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OperationalJobPolicyError";
  }
}

export const OPERATIONAL_JOB_CREATOR_GLOBAL_CONCURRENCY = 2 as const;

const OPERATIONAL_JOB_LANES = Object.freeze({
  release_artifact_processing: "release_processing",
  release_browser_validation: "browser_validation",
  release_image_moderation: "moderation",
} satisfies Readonly<Record<OperationalJobKind, OperationalLane>>);

const operationalJobKindSet: ReadonlySet<string> = new Set(
  operationalJobKindValues,
);

export const isOperationalJobKind = (
  value: unknown,
): value is OperationalJobKind =>
  typeof value === "string" && operationalJobKindSet.has(value);

export const parseOperationalJobKind = (value: unknown): OperationalJobKind => {
  if (!isOperationalJobKind(value)) {
    throw new OperationalJobPolicyError(
      `Unknown operational job kind: ${String(value)}.`,
    );
  }
  return value;
};

const assertPositiveSafeInteger = (value: number, label: string): void => {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new OperationalJobPolicyError(
      `${label} must be a positive safe integer.`,
    );
  }
};

export const assertValidOperationalJobPolicy = (
  policy: OperationalJobPolicy,
): OperationalJobPolicy => {
  const expectedLane = OPERATIONAL_JOB_LANES[policy.kind];
  if (!expectedLane || policy.lane !== expectedLane) {
    throw new OperationalJobPolicyError(
      `Job kind ${policy.kind} must use lane ${expectedLane ?? "unknown"}.`,
    );
  }

  assertPositiveSafeInteger(
    policy.globalConcurrency,
    `${policy.kind} global concurrency`,
  );
  assertPositiveSafeInteger(
    policy.perCreatorConcurrency,
    `${policy.kind} per-creator concurrency`,
  );
  assertPositiveSafeInteger(policy.queueDepth, `${policy.kind} queue depth`);
  assertPositiveSafeInteger(policy.maxAttempts, `${policy.kind} max attempts`);
  assertPositiveSafeInteger(policy.leaseSeconds, `${policy.kind} lease`);
  assertPositiveSafeInteger(policy.deadlineSeconds, `${policy.kind} deadline`);
  assertPositiveSafeInteger(
    policy.retryBackoffSeconds,
    `${policy.kind} retry backoff`,
  );

  if (policy.perCreatorConcurrency > policy.globalConcurrency) {
    throw new OperationalJobPolicyError(
      `${policy.kind} per-creator concurrency cannot exceed global concurrency.`,
    );
  }
  if (policy.leaseSeconds >= policy.deadlineSeconds) {
    throw new OperationalJobPolicyError(
      `${policy.kind} lease must be shorter than its deadline.`,
    );
  }
  if (policy.retryBackoffSeconds >= policy.deadlineSeconds) {
    throw new OperationalJobPolicyError(
      `${policy.kind} retry backoff must be shorter than its deadline.`,
    );
  }

  return policy;
};

const operationalJobPolicy = (
  policy: OperationalJobPolicy,
): OperationalJobPolicy =>
  Object.freeze(assertValidOperationalJobPolicy(policy));

export const OPERATIONAL_JOB_POLICIES = Object.freeze({
  release_artifact_processing: operationalJobPolicy({
    kind: "release_artifact_processing",
    lane: "release_processing",
    globalConcurrency: 4,
    perCreatorConcurrency: 2,
    queueDepth: 50,
    maxAttempts: 3,
    leaseSeconds: 300,
    deadlineSeconds: 3_600,
    retryBackoffSeconds: 60,
  }),
  release_browser_validation: operationalJobPolicy({
    kind: "release_browser_validation",
    lane: "browser_validation",
    globalConcurrency: 2,
    perCreatorConcurrency: 1,
    queueDepth: 100,
    maxAttempts: 3,
    leaseSeconds: 120,
    deadlineSeconds: 1_800,
    retryBackoffSeconds: 30,
  }),
  release_image_moderation: operationalJobPolicy({
    kind: "release_image_moderation",
    lane: "moderation",
    globalConcurrency: 2,
    perCreatorConcurrency: 1,
    queueDepth: 100,
    maxAttempts: 3,
    leaseSeconds: 90,
    deadlineSeconds: 1_800,
    retryBackoffSeconds: 60,
  }),
} satisfies Readonly<Record<OperationalJobKind, OperationalJobPolicy>>);

export const getOperationalJobPolicy = (
  kind: OperationalJobKind,
): OperationalJobPolicy =>
  OPERATIONAL_JOB_POLICIES[parseOperationalJobKind(kind)];

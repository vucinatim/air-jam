import {
  operationalBudgetEvidenceContractVersion,
  type OperationalBudgetCycleSnapshot,
  type OperationalBudgetEvidenceSnapshot,
  type OperationalBudgetProfile,
  type OperationalBudgetState,
} from "@air-jam/database-contract";
import { isDeepStrictEqual } from "node:util";

export const PRODUCTION_BUDGET_CONTRACT_VERSION = 1 as const;
export const PRODUCTION_BUDGET_EVIDENCE_MAX_AGE_MS = 6 * 60 * 60 * 1_000;
export const PRODUCTION_BUDGET_MAX_FUTURE_SKEW_MS = 5 * 60 * 1_000;

// Activating the one-cycle launch allowance is a reviewed source change. It
// cannot be raised by an operator command, environment variable, or agent.
export const AIR_JAM_1_0_LAUNCH_BUDGET_PERIOD_START: string | null = null;

type BudgetThresholds = {
  profile: OperationalBudgetProfile;
  normalTargetMicrousd: number;
  warningMicrousd: number;
  protectionMicrousd: number;
  nearCeilingMicrousd: number;
  ceilingMicrousd: number;
};

export const OPERATIONAL_BUDGET_POLICIES: Readonly<
  Record<OperationalBudgetProfile, Readonly<BudgetThresholds>>
> = Object.freeze({
  ordinary: Object.freeze({
    profile: "ordinary",
    normalTargetMicrousd: 25_000_000,
    warningMicrousd: 50_000_000,
    protectionMicrousd: 75_000_000,
    nearCeilingMicrousd: 90_000_000,
    ceilingMicrousd: 100_000_000,
  }),
  launch_1_0: Object.freeze({
    profile: "launch_1_0",
    normalTargetMicrousd: 50_000_000,
    warningMicrousd: 75_000_000,
    protectionMicrousd: 100_000_000,
    nearCeilingMicrousd: 135_000_000,
    ceilingMicrousd: 150_000_000,
  }),
});

type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue };

export type NormalizedOperationalBudgetProviderEvidence = {
  contractVersion: number;
  provider: string;
  scope: {
    kind: string;
    id: string;
    name: string;
    metadata: Record<string, JsonValue>;
  };
  billingPeriod: { start: Date; end: Date };
  observedAt: Date;
  currency: "USD";
  actualAmountMicrousd: number;
  projectedAmountMicrousd: number | null;
  measurements: Record<string, JsonValue>;
  costBreakdownMicrousd: Record<string, JsonValue>;
  rateCard: Record<string, JsonValue>;
  sourceVersion: string;
};

export type RecordOperationalBudgetEvidenceInput = {
  evidence: unknown;
  actor: string;
  reason: string;
  idempotencyKey: string;
};

export type NormalizedOperationalBudgetEvidenceInput = {
  evidence: NormalizedOperationalBudgetProviderEvidence;
  actor: string;
  reason: string;
  idempotencyKey: string;
};

export type ReplayOperationalBudgetEvidenceInput = {
  provider: string;
  scopeKind: string;
  scopeId: string;
  actor: string;
  reason: string;
  idempotencyKey: string;
};

export type OperationalBudgetEvidenceStatus = "fresh" | "stale" | "missing";

export type OperationalBudgetStatus = {
  contractVersion: typeof PRODUCTION_BUDGET_CONTRACT_VERSION;
  asOf: string;
  evidenceStatus: OperationalBudgetEvidenceStatus;
  cycle: OperationalBudgetCycleSnapshot | null;
  state: OperationalBudgetState | null;
  projectedState: OperationalBudgetState | null;
  lastKnownState: OperationalBudgetState | null;
  lastKnownProjectedState: OperationalBudgetState | null;
  actualAmountMicrousd: number | null;
  projectedAmountMicrousd: number | null;
  headroomMicrousd: number | null;
  oldestSourceObservedAt: string | null;
  newestSourceObservedAt: string | null;
  evidence: OperationalBudgetEvidenceSnapshot[];
};

export type OperationalBudgetEvidencePreview = {
  wouldCreateCycle: boolean;
  wouldRecordEvidence: boolean;
  replayed: boolean;
  evidence: OperationalBudgetEvidenceSnapshot;
  status: OperationalBudgetStatus;
};

export class OperationalBudgetConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OperationalBudgetConflictError";
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const assertAllowedKeys = (
  value: Record<string, unknown>,
  allowedKeys: readonly string[],
  label: string,
): void => {
  const unexpected = Object.keys(value).filter(
    (key) => !allowedKeys.includes(key),
  );
  if (unexpected.length > 0) {
    throw new OperationalBudgetConflictError(
      `${label} contains unsupported fields: ${unexpected.sort().join(", ")}.`,
    );
  }
};

export const normalizeOperationalBudgetRequiredText = (
  value: unknown,
  label: string,
): string => {
  const normalized = typeof value === "string" ? value.trim() : "";
  if (!normalized) {
    throw new OperationalBudgetConflictError(`${label} is required.`);
  }
  return normalized;
};

const parseDate = (value: unknown, label: string): Date => {
  const date = new Date(typeof value === "string" ? value : "");
  if (Number.isNaN(date.getTime())) {
    throw new OperationalBudgetConflictError(`${label} must be an ISO date.`);
  }
  return date;
};

const nonNegativeInteger = (
  value: unknown,
  label: string,
  { nullable = false }: { nullable?: boolean } = {},
): number | null => {
  if (nullable && (value === null || value === undefined)) return null;
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    throw new OperationalBudgetConflictError(
      `${label} must be a non-negative safe integer.`,
    );
  }
  return value as number;
};

const normalizeJsonValue = (value: unknown, label: string): JsonValue => {
  if (
    value === null ||
    typeof value === "boolean" ||
    typeof value === "string"
  ) {
    return value;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new OperationalBudgetConflictError(
        `${label} contains a non-finite number.`,
      );
    }
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((entry, index) =>
      normalizeJsonValue(entry, `${label}[${index}]`),
    );
  }
  if (isRecord(value)) {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, normalizeJsonValue(value[key], `${label}.${key}`)]),
    );
  }
  throw new OperationalBudgetConflictError(
    `${label} must contain only JSON values.`,
  );
};

const normalizeJsonObject = (
  value: unknown,
  label: string,
): Record<string, JsonValue> => {
  const normalized = normalizeJsonValue(value, label);
  if (!isRecord(normalized)) {
    throw new OperationalBudgetConflictError(`${label} must be an object.`);
  }
  return normalized as Record<string, JsonValue>;
};

const normalizeProviderEvidence = (
  rawEvidence: unknown,
): NormalizedOperationalBudgetProviderEvidence => {
  if (!isRecord(rawEvidence)) {
    throw new OperationalBudgetConflictError(
      "Provider budget evidence must be an object.",
    );
  }
  assertAllowedKeys(
    rawEvidence,
    [
      "contractVersion",
      "provider",
      "scope",
      "billingPeriod",
      "observedAt",
      "currency",
      "actualAmountMicrousd",
      "projectedAmountMicrousd",
      "measurements",
      "costBreakdownMicrousd",
      "rateCard",
      "sourceVersion",
    ],
    "Provider budget evidence",
  );
  if (
    rawEvidence.contractVersion !== operationalBudgetEvidenceContractVersion
  ) {
    throw new OperationalBudgetConflictError(
      `Provider evidence contractVersion must be ${operationalBudgetEvidenceContractVersion}.`,
    );
  }
  if (!isRecord(rawEvidence.scope)) {
    throw new OperationalBudgetConflictError(
      "Provider evidence scope must be an object.",
    );
  }
  if (!isRecord(rawEvidence.billingPeriod)) {
    throw new OperationalBudgetConflictError(
      "Provider evidence billingPeriod must be an object.",
    );
  }
  assertAllowedKeys(
    rawEvidence.billingPeriod,
    ["start", "end"],
    "Provider evidence billingPeriod",
  );
  if (rawEvidence.currency !== "USD") {
    throw new OperationalBudgetConflictError(
      "Provider budget evidence currency must be USD.",
    );
  }

  const periodStart = parseDate(
    rawEvidence.billingPeriod.start,
    "Billing period start",
  );
  const periodEnd = parseDate(
    rawEvidence.billingPeriod.end,
    "Billing period end",
  );
  const observedAt = parseDate(rawEvidence.observedAt, "Evidence observedAt");
  if (periodEnd <= periodStart) {
    throw new OperationalBudgetConflictError(
      "Billing period end must be after its start.",
    );
  }
  if (observedAt < periodStart || observedAt >= periodEnd) {
    throw new OperationalBudgetConflictError(
      "Evidence observedAt must fall within its billing period.",
    );
  }

  const { kind, id, name, ...scopeMetadata } = rawEvidence.scope;
  return {
    contractVersion: rawEvidence.contractVersion,
    provider: normalizeOperationalBudgetRequiredText(
      rawEvidence.provider,
      "Provider",
    ),
    scope: {
      kind: normalizeOperationalBudgetRequiredText(kind, "Scope kind"),
      id: normalizeOperationalBudgetRequiredText(id, "Scope id"),
      name: normalizeOperationalBudgetRequiredText(name, "Scope name"),
      metadata: normalizeJsonObject(scopeMetadata, "Scope metadata"),
    },
    billingPeriod: { start: periodStart, end: periodEnd },
    observedAt,
    currency: "USD",
    actualAmountMicrousd: nonNegativeInteger(
      rawEvidence.actualAmountMicrousd,
      "Actual amount",
    )!,
    projectedAmountMicrousd: nonNegativeInteger(
      rawEvidence.projectedAmountMicrousd,
      "Projected amount",
      { nullable: true },
    ),
    measurements: normalizeJsonObject(rawEvidence.measurements, "Measurements"),
    costBreakdownMicrousd: normalizeJsonObject(
      rawEvidence.costBreakdownMicrousd,
      "Cost breakdown",
    ),
    rateCard: normalizeJsonObject(rawEvidence.rateCard, "Rate card"),
    sourceVersion: normalizeOperationalBudgetRequiredText(
      rawEvidence.sourceVersion,
      "Source version",
    ),
  };
};

export const normalizeOperationalBudgetEvidenceInput = (
  input: RecordOperationalBudgetEvidenceInput,
  now: Date,
): NormalizedOperationalBudgetEvidenceInput => {
  const normalized = {
    evidence: normalizeProviderEvidence(input.evidence),
    actor: normalizeOperationalBudgetRequiredText(input.actor, "Actor"),
    reason: normalizeOperationalBudgetRequiredText(input.reason, "Reason"),
    idempotencyKey: normalizeOperationalBudgetRequiredText(
      input.idempotencyKey,
      "Idempotency key",
    ),
  };
  if (Number.isNaN(now.getTime())) {
    throw new OperationalBudgetConflictError("Collection time must be valid.");
  }
  if (
    normalized.evidence.observedAt.getTime() - now.getTime() >
    PRODUCTION_BUDGET_MAX_FUTURE_SKEW_MS
  ) {
    throw new OperationalBudgetConflictError(
      "Provider evidence observedAt is too far in the future.",
    );
  }
  return normalized;
};

export const resolveOperationalBudgetProfile = (
  periodStart: Date,
): OperationalBudgetProfile =>
  AIR_JAM_1_0_LAUNCH_BUDGET_PERIOD_START === periodStart.toISOString()
    ? "launch_1_0"
    : "ordinary";

export const resolveOperationalBudgetState = ({
  amountMicrousd,
  cycle,
}: {
  amountMicrousd: number;
  cycle: OperationalBudgetCycleSnapshot;
}): OperationalBudgetState => {
  if (amountMicrousd >= cycle.ceilingMicrousd) return "ceiling";
  if (amountMicrousd >= cycle.nearCeilingMicrousd) return "near_ceiling";
  if (amountMicrousd >= cycle.protectionMicrousd) return "protection";
  if (amountMicrousd >= cycle.warningMicrousd) return "warning";
  return "normal";
};

export const buildOperationalBudgetCycleSnapshot = ({
  periodStart,
  periodEnd,
  createdAt,
}: {
  periodStart: Date;
  periodEnd: Date;
  createdAt: Date;
}): OperationalBudgetCycleSnapshot => {
  const profile = resolveOperationalBudgetProfile(periodStart);
  const policy = OPERATIONAL_BUDGET_POLICIES[profile];
  return {
    id: `air-jam-budget:${periodStart.toISOString()}:${periodEnd.toISOString()}`,
    periodStart: periodStart.toISOString(),
    periodEnd: periodEnd.toISOString(),
    ...policy,
    createdAt: createdAt.toISOString(),
  };
};

export const assertOperationalBudgetCyclePolicy = (
  actual: OperationalBudgetCycleSnapshot,
  expected: OperationalBudgetCycleSnapshot,
): void => {
  for (const key of [
    "periodStart",
    "periodEnd",
    "profile",
    "normalTargetMicrousd",
    "warningMicrousd",
    "protectionMicrousd",
    "nearCeilingMicrousd",
    "ceilingMicrousd",
  ] as const) {
    if (actual[key] !== expected[key]) {
      throw new OperationalBudgetConflictError(
        "The stored budget cycle does not match the reviewed source policy.",
      );
    }
  }
};

export const buildOperationalBudgetEvidenceSnapshot = ({
  normalized,
  cycle,
  evidenceId,
  createdAt,
}: {
  normalized: NormalizedOperationalBudgetEvidenceInput;
  cycle: OperationalBudgetCycleSnapshot;
  evidenceId: string;
  createdAt: Date;
}): OperationalBudgetEvidenceSnapshot => ({
  id: evidenceId,
  idempotencyKey: normalized.idempotencyKey,
  cycleId: cycle.id,
  contractVersion: normalized.evidence.contractVersion,
  provider: normalized.evidence.provider,
  scopeKind: normalized.evidence.scope.kind,
  scopeId: normalized.evidence.scope.id,
  scopeName: normalized.evidence.scope.name,
  scopeMetadata: normalized.evidence.scope.metadata,
  currency: normalized.evidence.currency,
  observedAt: normalized.evidence.observedAt.toISOString(),
  actualAmountMicrousd: normalized.evidence.actualAmountMicrousd,
  projectedAmountMicrousd: normalized.evidence.projectedAmountMicrousd,
  measurements: normalized.evidence.measurements,
  costBreakdownMicrousd: normalized.evidence.costBreakdownMicrousd,
  rateCard: normalized.evidence.rateCard,
  sourceVersion: normalized.evidence.sourceVersion,
  collectedBy: normalized.actor,
  reason: normalized.reason,
  createdAt: createdAt.toISOString(),
});

export const assertMatchingOperationalBudgetEvidence = (
  actual: OperationalBudgetEvidenceSnapshot,
  expected: OperationalBudgetEvidenceSnapshot,
): void => {
  const {
    id: _actualId,
    createdAt: _actualCreatedAt,
    ...actualComparable
  } = actual;
  const {
    id: _expectedId,
    createdAt: _expectedCreatedAt,
    ...expectedComparable
  } = expected;
  if (!isDeepStrictEqual(actualComparable, expectedComparable)) {
    throw new OperationalBudgetConflictError(
      "The idempotency key was already used for different budget evidence.",
    );
  }
};

const evidenceSourceKey = (evidence: OperationalBudgetEvidenceSnapshot) =>
  `${evidence.provider}\u0000${evidence.scopeKind}\u0000${evidence.scopeId}`;

const selectLatestSourceEvidence = (
  rows: OperationalBudgetEvidenceSnapshot[],
): OperationalBudgetEvidenceSnapshot[] => {
  const latest = new Map<string, OperationalBudgetEvidenceSnapshot>();
  for (const row of rows) {
    const key = evidenceSourceKey(row);
    const current = latest.get(key);
    if (
      !current ||
      row.observedAt > current.observedAt ||
      (row.observedAt === current.observedAt &&
        row.createdAt > current.createdAt)
    ) {
      latest.set(key, row);
    }
  }
  return [...latest.values()].sort((a, b) =>
    evidenceSourceKey(a).localeCompare(evidenceSourceKey(b)),
  );
};

export const buildOperationalBudgetStatus = ({
  cycle,
  evidence,
  asOf,
  maxEvidenceAgeMs = PRODUCTION_BUDGET_EVIDENCE_MAX_AGE_MS,
}: {
  cycle: OperationalBudgetCycleSnapshot | null;
  evidence: OperationalBudgetEvidenceSnapshot[];
  asOf: Date;
  maxEvidenceAgeMs?: number;
}): OperationalBudgetStatus => {
  if (Number.isNaN(asOf.getTime())) {
    throw new OperationalBudgetConflictError(
      "Budget status time must be valid.",
    );
  }
  if (!Number.isFinite(maxEvidenceAgeMs) || maxEvidenceAgeMs < 0) {
    throw new OperationalBudgetConflictError(
      "Budget evidence maximum age must be a non-negative finite number.",
    );
  }
  if (!cycle || evidence.length === 0) {
    return {
      contractVersion: PRODUCTION_BUDGET_CONTRACT_VERSION,
      asOf: asOf.toISOString(),
      evidenceStatus: "missing",
      cycle,
      state: null,
      projectedState: null,
      lastKnownState: null,
      lastKnownProjectedState: null,
      actualAmountMicrousd: null,
      projectedAmountMicrousd: null,
      headroomMicrousd: cycle?.ceilingMicrousd ?? null,
      oldestSourceObservedAt: null,
      newestSourceObservedAt: null,
      evidence: [],
    };
  }

  const latestEvidence = selectLatestSourceEvidence(evidence);
  const observedTimes = latestEvidence.map((row) =>
    new Date(row.observedAt).getTime(),
  );
  if (observedTimes.some(Number.isNaN)) {
    throw new OperationalBudgetConflictError(
      "Stored budget evidence contains an invalid observedAt value.",
    );
  }
  const oldestObservedAt = Math.min(...observedTimes);
  const newestObservedAt = Math.max(...observedTimes);
  const stale = asOf.getTime() - oldestObservedAt > maxEvidenceAgeMs;
  const actualAmountMicrousd = latestEvidence.reduce(
    (total, row) => total + row.actualAmountMicrousd,
    0,
  );
  const projectedAmountMicrousd = latestEvidence.every(
    (row) => row.projectedAmountMicrousd !== null,
  )
    ? latestEvidence.reduce(
        (total, row) => total + (row.projectedAmountMicrousd ?? 0),
        0,
      )
    : null;
  const lastKnownState = resolveOperationalBudgetState({
    amountMicrousd: actualAmountMicrousd,
    cycle,
  });
  const lastKnownProjectedState =
    projectedAmountMicrousd === null
      ? null
      : resolveOperationalBudgetState({
          amountMicrousd: projectedAmountMicrousd,
          cycle,
        });

  return {
    contractVersion: PRODUCTION_BUDGET_CONTRACT_VERSION,
    asOf: asOf.toISOString(),
    evidenceStatus: stale ? "stale" : "fresh",
    cycle,
    state: stale ? null : lastKnownState,
    projectedState: stale ? null : lastKnownProjectedState,
    lastKnownState,
    lastKnownProjectedState,
    actualAmountMicrousd,
    projectedAmountMicrousd,
    headroomMicrousd: cycle.ceilingMicrousd - actualAmountMicrousd,
    oldestSourceObservedAt: new Date(oldestObservedAt).toISOString(),
    newestSourceObservedAt: new Date(newestObservedAt).toISOString(),
    evidence: latestEvidence,
  };
};

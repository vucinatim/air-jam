import { db } from "@/db";
import {
  operationalJobAttempts,
  operationalJobCommands,
  operationalJobEvents,
  operationalJobs,
} from "@/db/schema";
import {
  OperationalJobAttemptStatus,
  OperationalJobCommandKind,
  operationalJobContractVersion,
  OperationalJobEventKind,
  OperationalJobKind,
  OperationalJobResourceKind,
  OperationalJobStatus,
} from "@air-jam/database-contract";
import { createOperationsDocumentDigest } from "@air-jam/operations-contract";
import { sql } from "drizzle-orm";
import { resolveDatabaseAuthorityNow } from "../operations/database-authority";

export type JobDatabase = typeof db;
export type JobTransaction = Parameters<
  Parameters<JobDatabase["transaction"]>[0]
>[0];
export type OperationalJob = typeof operationalJobs.$inferSelect;
export type OperationalJobCommand = typeof operationalJobCommands.$inferSelect;
export type OperationalJobEvent = typeof operationalJobEvents.$inferSelect;
export type OperationalJobAttempt = typeof operationalJobAttempts.$inferSelect;

export type OperationalJobOperatorSnapshot = {
  id: string;
  contractVersion: number;
  kind: OperationalJobKind;
  lane: string;
  status: OperationalJobStatus;
  creatorId: string;
  gameId: string;
  releaseId: string | null;
  generationId: string | null;
  resourceKind: OperationalJobResourceKind;
  resourceId: string;
  correlationId: string;
  replayOfJobId: string | null;
  priority: number;
  availableAt: string;
  deadlineAt: string;
  attemptCount: number;
  maxAttempts: number;
  revision: number;
  leaseOwner: string | null;
  leaseExpiresAt: string | null;
  lastHeartbeatAt: string | null;
  cancelRequestedAt: string | null;
  cancelRequestedBy: string | null;
  cancelReason: string | null;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  updatedAt: string;
  privateData: {
    hasPayload: boolean;
    hasProgress: boolean;
    hasResult: boolean;
    hasLastError: boolean;
  };
  lastErrorCode: string | null;
};

export type OperationalJobAttemptOperatorSnapshot = {
  id: string;
  jobId: string;
  releaseId: string | null;
  generationId: string | null;
  attempt: number;
  status: OperationalJobAttemptStatus;
  leaseOwner: string;
  startedAt: string;
  lastHeartbeatAt: string;
  finishedAt: string | null;
  outputCleanedAt: string | null;
  createdAt: string;
  updatedAt: string;
  privateData: {
    hasProgress: boolean;
    hasResult: boolean;
    hasLastError: boolean;
    hasOutputRoot: boolean;
    hasOutputManifest: boolean;
  };
  lastErrorCode: string | null;
};

export type OperationalJobEventOperatorSnapshot = {
  id: string;
  jobId: string;
  kind: OperationalJobEventKind;
  expectedRevision: number;
  nextRevision: number;
  fromStatus: OperationalJobStatus | null;
  toStatus: OperationalJobStatus;
  attempt: number;
  actor: string;
  reason: string;
  correlationId: string;
  causationEventId: string | null;
  detailKeys: string[];
  createdAt: string;
};

export class OperationalJobConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OperationalJobConflictError";
  }
}

export class OperationalJobCapacityError extends Error {
  readonly retryAfterSeconds: number;

  constructor(message: string, retryAfterSeconds = 30) {
    super(message);
    this.name = "OperationalJobCapacityError";
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export class OperationalJobLeaseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OperationalJobLeaseError";
  }
}

export const normalizeRequiredJobText = (
  value: string,
  label: string,
): string => {
  const normalized = value.trim();
  if (!normalized) {
    throw new OperationalJobConflictError(`${label} is required.`);
  }
  return normalized;
};

export type OperationalJobJsonValue =
  | null
  | boolean
  | number
  | string
  | OperationalJobJsonValue[]
  | { [key: string]: OperationalJobJsonValue };

export type OperationalJobJsonObject = {
  [key: string]: OperationalJobJsonValue;
};

const normalizeOperationalJobJsonValue = (
  value: unknown,
  label: string,
  ancestors: Set<object>,
): OperationalJobJsonValue => {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean"
  ) {
    return value;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new OperationalJobConflictError(`${label} must be finite JSON.`);
    }
    return Object.is(value, -0) ? 0 : value;
  }
  if (typeof value !== "object") {
    throw new OperationalJobConflictError(`${label} must contain only JSON.`);
  }
  if (ancestors.has(value)) {
    throw new OperationalJobConflictError(`${label} must not be cyclic.`);
  }

  ancestors.add(value);
  try {
    if (Array.isArray(value)) {
      return value.map((item, index) =>
        normalizeOperationalJobJsonValue(item, `${label}[${index}]`, ancestors),
      );
    }

    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new OperationalJobConflictError(
        `${label} must contain only plain JSON objects.`,
      );
    }
    if (Object.getOwnPropertySymbols(value).length > 0) {
      throw new OperationalJobConflictError(
        `${label} must not contain symbol properties.`,
      );
    }

    const normalized: OperationalJobJsonObject = {};
    for (const key of Object.getOwnPropertyNames(value)) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor?.enumerable || !("value" in descriptor)) {
        throw new OperationalJobConflictError(
          `${label}.${key} must be an enumerable JSON value.`,
        );
      }
      normalized[key] = normalizeOperationalJobJsonValue(
        descriptor.value,
        `${label}.${key}`,
        ancestors,
      );
    }
    return normalized;
  } finally {
    ancestors.delete(value);
  }
};

export const normalizeOperationalJobJsonObject = (
  value: Record<string, unknown>,
  label: string,
): OperationalJobJsonObject => {
  const normalized = normalizeOperationalJobJsonValue(value, label, new Set());
  if (Array.isArray(normalized) || normalized === null) {
    throw new OperationalJobConflictError(`${label} must be a JSON object.`);
  }
  return normalized as OperationalJobJsonObject;
};

export const hashOperationalJobRequest = (
  value: OperationalJobJsonObject,
): string => createOperationsDocumentDigest(value);

export const serializeOperationalJobForOperator = (
  job: OperationalJob,
): OperationalJobOperatorSnapshot => ({
  id: job.id,
  contractVersion: job.contractVersion,
  kind: job.kind,
  lane: job.lane,
  status: job.status,
  creatorId: job.creatorId,
  gameId: job.gameId,
  releaseId: job.releaseId,
  generationId: job.generationId,
  resourceKind: job.resourceKind,
  resourceId: job.resourceId,
  correlationId: job.correlationId,
  replayOfJobId: job.replayOfJobId,
  priority: job.priority,
  availableAt: job.availableAt.toISOString(),
  deadlineAt: job.deadlineAt.toISOString(),
  attemptCount: job.attemptCount,
  maxAttempts: job.maxAttempts,
  revision: job.revision,
  leaseOwner: job.leaseOwner,
  leaseExpiresAt: job.leaseExpiresAt?.toISOString() ?? null,
  lastHeartbeatAt: job.lastHeartbeatAt?.toISOString() ?? null,
  cancelRequestedAt: job.cancelRequestedAt?.toISOString() ?? null,
  cancelRequestedBy: job.cancelRequestedBy,
  cancelReason: job.cancelReason,
  createdAt: job.createdAt.toISOString(),
  startedAt: job.startedAt?.toISOString() ?? null,
  finishedAt: job.finishedAt?.toISOString() ?? null,
  updatedAt: job.updatedAt.toISOString(),
  privateData: {
    hasPayload: Object.keys(job.payload).length > 0,
    hasProgress: Object.keys(job.progress).length > 0,
    hasResult: job.result !== null,
    hasLastError: job.lastError !== null,
  },
  lastErrorCode:
    job.lastError &&
    typeof job.lastError.code === "string" &&
    /^[a-z][a-z0-9_]{0,63}$/u.test(job.lastError.code)
      ? job.lastError.code
      : null,
});

export const serializeOperationalJobAttemptForOperator = (
  attempt: OperationalJobAttempt,
): OperationalJobAttemptOperatorSnapshot => ({
  id: attempt.id,
  jobId: attempt.jobId,
  releaseId: attempt.releaseId,
  generationId: attempt.generationId,
  attempt: attempt.attempt,
  status: attempt.status,
  leaseOwner: attempt.leaseOwner,
  startedAt: attempt.startedAt.toISOString(),
  lastHeartbeatAt: attempt.lastHeartbeatAt.toISOString(),
  finishedAt: attempt.finishedAt?.toISOString() ?? null,
  outputCleanedAt: attempt.outputCleanedAt?.toISOString() ?? null,
  createdAt: attempt.createdAt.toISOString(),
  updatedAt: attempt.updatedAt.toISOString(),
  privateData: {
    hasProgress: Object.keys(attempt.progress).length > 0,
    hasResult: attempt.result !== null,
    hasLastError: attempt.lastError !== null,
    hasOutputRoot: attempt.outputRootKey !== null,
    hasOutputManifest: attempt.outputManifest !== null,
  },
  lastErrorCode:
    attempt.lastError &&
    typeof attempt.lastError.code === "string" &&
    /^[a-z][a-z0-9_]{0,63}$/u.test(attempt.lastError.code)
      ? attempt.lastError.code
      : null,
});

export const serializeOperationalJobEventForOperator = (
  event: OperationalJobEvent,
): OperationalJobEventOperatorSnapshot => ({
  id: event.id,
  jobId: event.jobId,
  kind: event.kind,
  expectedRevision: event.expectedRevision,
  nextRevision: event.nextRevision,
  fromStatus: event.fromStatus,
  toStatus: event.toStatus,
  attempt: event.attempt,
  actor: event.actor,
  reason: event.reason,
  correlationId: event.correlationId,
  causationEventId: event.causationEventId,
  detailKeys: Object.keys(event.details).sort(),
  createdAt: event.createdAt.toISOString(),
});

export const acquireOperationalJobCommandLock = async (
  tx: JobTransaction,
  idempotencyKey: string,
) => {
  const lockScope = `airjam:operational-job-command:${idempotencyKey}`;
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${lockScope}))`);
};

export const beginOperationalJobCommand = async ({
  tx,
  kind,
  idempotencyKey,
  requestHash,
  actor,
  reason,
  request,
  testNow,
}: {
  tx: JobTransaction;
  kind: OperationalJobCommandKind;
  idempotencyKey: string;
  requestHash: string;
  actor: string;
  reason: string;
  request: OperationalJobJsonObject;
  testNow?: Date;
}): Promise<
  | { replayed: true; command: OperationalJobCommand; authorityNow: Date }
  | { replayed: false; command: OperationalJobCommand; authorityNow: Date }
> => {
  await acquireOperationalJobCommandLock(tx, idempotencyKey);
  const authorityNow = await resolveDatabaseAuthorityNow(tx, testNow);
  const existing = await tx.query.operationalJobCommands.findFirst({
    where: (table, { eq }) => eq(table.idempotencyKey, idempotencyKey),
  });
  if (existing) {
    if (
      existing.kind !== kind ||
      existing.requestHash !== requestHash ||
      existing.result === null ||
      existing.completedAt === null
    ) {
      throw new OperationalJobConflictError(
        "Idempotency key was already used for a different or incomplete job command.",
      );
    }
    return { replayed: true, command: existing, authorityNow };
  }
  const [command] = await tx
    .insert(operationalJobCommands)
    .values({
      id: crypto.randomUUID(),
      contractVersion: operationalJobContractVersion,
      idempotencyKey,
      kind,
      requestHash,
      actor,
      reason,
      request,
      createdAt: authorityNow,
    })
    .returning();
  if (!command) throw new Error("Operational job command could not be stored.");
  return { replayed: false, command, authorityNow };
};

export const completeOperationalJobCommand = async ({
  tx,
  commandId,
  result,
  now,
}: {
  tx: JobTransaction;
  commandId: string;
  result: Record<string, unknown>;
  now: Date;
}) => {
  const [completed] = await tx
    .update(operationalJobCommands)
    .set({ result, completedAt: now })
    .where(
      sql`${operationalJobCommands.id} = ${commandId} and ${operationalJobCommands.result} is null`,
    )
    .returning();
  if (!completed) {
    throw new OperationalJobConflictError(
      "Operational job command completion lost its fence.",
    );
  }
  return completed;
};

export const readCommandJobSnapshot = (
  command: OperationalJobCommand,
): OperationalJobOperatorSnapshot => {
  const job = command.result?.job;
  if (!job || typeof job !== "object" || Array.isArray(job)) {
    throw new Error("Stored operational job command result is invalid.");
  }
  return job as OperationalJobOperatorSnapshot;
};

export const readCommandJobSnapshots = (
  command: OperationalJobCommand,
): OperationalJobOperatorSnapshot[] => {
  const jobs = command.result?.jobs;
  if (!Array.isArray(jobs)) {
    throw new Error("Stored operational job repair result is invalid.");
  }
  return jobs as OperationalJobOperatorSnapshot[];
};

const eventIdempotencyKey = ({
  jobId,
  nextRevision,
  kind,
}: {
  jobId: string;
  nextRevision: number;
  kind: OperationalJobEventKind;
}) => `${jobId}:${nextRevision}:${kind}`;

export const insertOperationalJobEvent = async ({
  tx,
  job,
  kind,
  expectedRevision,
  nextRevision,
  fromStatus,
  toStatus,
  actor,
  reason,
  details = {},
  causationEventId = null,
}: {
  tx: JobTransaction;
  job: Pick<OperationalJob, "id" | "attemptCount" | "correlationId">;
  kind: OperationalJobEventKind;
  expectedRevision: number;
  nextRevision: number;
  fromStatus: OperationalJobStatus | null;
  toStatus: OperationalJobStatus;
  actor: string;
  reason: string;
  details?: Record<string, unknown>;
  causationEventId?: string | null;
}) => {
  const [inserted] = await tx
    .insert(operationalJobEvents)
    .values({
      id: crypto.randomUUID(),
      jobId: job.id,
      idempotencyKey: eventIdempotencyKey({
        jobId: job.id,
        nextRevision,
        kind,
      }),
      kind,
      expectedRevision,
      nextRevision,
      fromStatus,
      toStatus,
      attempt: job.attemptCount,
      actor,
      reason,
      details,
      correlationId: job.correlationId,
      causationEventId,
    })
    .returning();
  if (!inserted) {
    throw new OperationalJobConflictError(
      "Operational job event could not be stored.",
    );
  }
  return inserted;
};

export const acquireOperationalJobLock = async (
  tx: JobTransaction,
  scope: "enqueue" | "claim" | "repair",
  kind: OperationalJobKind,
) => {
  const lockScope =
    scope === "claim"
      ? "airjam:operational-jobs:claim"
      : `airjam:operational-jobs:${scope}:${kind}`;
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${lockScope}))`);
};

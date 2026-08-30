import { db } from "@/db";
import { operationalJobAttempts, operationalJobs } from "@/db/schema";
import { acquireOperationalLaneLock } from "@/server/operations/operational-lane-lock";
import {
  operationalJobContractVersion,
  type OperationalJobKind,
  type OperationalJobStatus,
} from "@air-jam/database-contract";
import { and, asc, count, desc, eq, gt, inArray, lte, or } from "drizzle-orm";
import {
  OperationalJobConflictError,
  OperationalJobLeaseError,
  acquireOperationalJobLock,
  beginOperationalJobCommand,
  completeOperationalJobCommand,
  hashOperationalJobRequest,
  insertOperationalJobEvent,
  normalizeOperationalJobJsonObject,
  normalizeRequiredJobText,
  readCommandJobSnapshots,
  resolveOperationalJobNow,
  serializeOperationalJobForOperator,
  type JobDatabase,
  type JobTransaction,
  type OperationalJob,
} from "./operational-job-internals";
import { planExpiredOperationalJobRepair } from "./operational-job-planning";
import {
  OPERATIONAL_JOB_CREATOR_GLOBAL_CONCURRENCY,
  getOperationalJobPolicy,
  type OperationalJobPolicy,
} from "./operational-job-policy";
import { applyReleaseJobTerminalState } from "./release-job-terminal-state";

const activeLeaseStatuses: OperationalJobStatus[] = [
  "running",
  "cancel_requested",
];

const countActiveLeases = async ({
  tx,
  kind,
  now,
  creatorId,
}: {
  tx: JobTransaction;
  kind?: OperationalJobKind;
  now: Date;
  creatorId?: string;
}) => {
  const conditions = [
    inArray(operationalJobs.status, activeLeaseStatuses),
    gt(operationalJobs.leaseExpiresAt, now),
    gt(operationalJobs.deadlineAt, now),
  ];
  if (kind) conditions.push(eq(operationalJobs.kind, kind));
  if (creatorId) conditions.push(eq(operationalJobs.creatorId, creatorId));
  const rows = await tx
    .select({ total: count() })
    .from(operationalJobs)
    .where(and(...conditions));
  return Number(rows[0]?.total ?? 0);
};

const capLeaseAtDeadline = ({
  now,
  leaseSeconds,
  deadlineAt,
}: {
  now: Date;
  leaseSeconds: number;
  deadlineAt: Date;
}): Date =>
  new Date(
    Math.min(now.getTime() + leaseSeconds * 1_000, deadlineAt.getTime()),
  );

export const claimOperationalJob = async ({
  database = db,
  kind,
  workerId: rawWorkerId,
  now: testNow,
}: {
  database?: JobDatabase;
  kind: OperationalJobKind;
  workerId: string;
  /** Deterministic PostgreSQL contract-test seam. Production callers omit it. */
  now?: Date;
}): Promise<(OperationalJob & { attemptId: string }) | null> => {
  const workerId = normalizeRequiredJobText(rawWorkerId, "Worker ID");
  const policy = getOperationalJobPolicy(kind);
  return database.transaction(async (tx) => {
    await acquireOperationalJobLock(tx, "claim", kind);
    await acquireOperationalLaneLock(tx, policy.lane);
    const authorityNow = await resolveOperationalJobNow(tx, testNow);
    const laneControl = await tx.query.operationalLaneControls.findFirst({
      where: (table, { eq }) => eq(table.lane, policy.lane),
    });
    if (laneControl?.mode === "paused") return null;

    if (
      (await countActiveLeases({ tx, kind, now: authorityNow })) >=
      policy.globalConcurrency
    ) {
      return null;
    }
    const candidates = await tx
      .select()
      .from(operationalJobs)
      .where(
        and(
          eq(operationalJobs.kind, kind),
          eq(operationalJobs.status, "queued"),
          lte(operationalJobs.availableAt, authorityNow),
          gt(operationalJobs.deadlineAt, authorityNow),
        ),
      )
      .orderBy(desc(operationalJobs.priority), asc(operationalJobs.createdAt))
      .limit(policy.queueDepth)
      .for("update", { skipLocked: true });

    let selected: OperationalJob | null = null;
    for (const candidate of candidates) {
      const creatorActive = await countActiveLeases({
        tx,
        kind,
        now: authorityNow,
        creatorId: candidate.creatorId,
      });
      const creatorGlobalActive = await countActiveLeases({
        tx,
        now: authorityNow,
        creatorId: candidate.creatorId,
      });
      if (
        creatorActive < policy.perCreatorConcurrency &&
        creatorGlobalActive < OPERATIONAL_JOB_CREATOR_GLOBAL_CONCURRENCY
      ) {
        selected = candidate;
        break;
      }
    }
    if (!selected) return null;

    const leaseToken = crypto.randomUUID();
    const attemptId = crypto.randomUUID();
    const leaseExpiresAt = capLeaseAtDeadline({
      now: authorityNow,
      leaseSeconds: policy.leaseSeconds,
      deadlineAt: selected.deadlineAt,
    });
    const nextRevision = selected.revision + 1;
    const [claimed] = await tx
      .update(operationalJobs)
      .set({
        status: "running",
        attemptCount: selected.attemptCount + 1,
        revision: nextRevision,
        leaseOwner: workerId,
        leaseToken,
        leaseExpiresAt,
        lastHeartbeatAt: authorityNow,
        startedAt: selected.startedAt ?? authorityNow,
        updatedAt: authorityNow,
      })
      .where(
        and(
          eq(operationalJobs.id, selected.id),
          eq(operationalJobs.status, "queued"),
          eq(operationalJobs.revision, selected.revision),
          gt(operationalJobs.deadlineAt, authorityNow),
        ),
      )
      .returning();
    if (!claimed) return null;
    const [attempt] = await tx
      .insert(operationalJobAttempts)
      .values({
        id: attemptId,
        jobId: claimed.id,
        releaseId: claimed.releaseId,
        generationId: claimed.generationId,
        attempt: claimed.attemptCount,
        status: "running",
        leaseOwner: workerId,
        leaseToken,
        startedAt: authorityNow,
        lastHeartbeatAt: authorityNow,
        createdAt: authorityNow,
        updatedAt: authorityNow,
      })
      .returning();
    if (!attempt) {
      throw new Error("Operational job attempt could not be persisted.");
    }
    await insertOperationalJobEvent({
      tx,
      job: claimed,
      kind: "claimed",
      expectedRevision: selected.revision,
      nextRevision,
      fromStatus: "queued",
      toStatus: "running",
      actor: workerId,
      reason: "Worker claimed the next dependency-ready job.",
      details: {
        attemptId,
        leaseExpiresAt: leaseExpiresAt.toISOString(),
      },
    });
    return { ...claimed, attemptId };
  });
};

const assertFreshLease = (
  job: OperationalJob | undefined,
  leaseToken: string,
  now: Date,
  workerId?: string,
): OperationalJob => {
  if (
    !job ||
    !activeLeaseStatuses.includes(job.status) ||
    job.leaseToken !== leaseToken ||
    !job.leaseExpiresAt ||
    job.leaseExpiresAt <= now ||
    job.deadlineAt <= now ||
    (workerId !== undefined && job.leaseOwner !== workerId)
  ) {
    throw new OperationalJobLeaseError(
      "Job lease is missing, stale, expired, past its deadline, or owned by another worker identity.",
    );
  }
  return job;
};

export const assertOperationalJobAttemptAuthority = async ({
  tx,
  jobId,
  leaseToken,
  workerId: rawWorkerId,
  expectedKind,
  expectedGenerationId,
  now: testNow,
}: {
  tx: JobTransaction;
  jobId: string;
  leaseToken: string;
  workerId: string;
  expectedKind?: OperationalJobKind;
  expectedGenerationId?: string;
  /** Deterministic PostgreSQL contract-test seam. Production callers omit it. */
  now?: Date;
}) => {
  const workerId = normalizeRequiredJobText(rawWorkerId, "Worker ID");
  const [current] = await tx
    .select()
    .from(operationalJobs)
    .where(eq(operationalJobs.id, jobId))
    .for("update");
  const authorityNow = await resolveOperationalJobNow(tx, testNow);
  const job = assertFreshLease(current, leaseToken, authorityNow, workerId);
  if (job.status !== "running") {
    throw new OperationalJobLeaseError(
      "Cancel-requested work cannot commit domain mutations.",
    );
  }
  if (expectedKind && job.kind !== expectedKind) {
    throw new OperationalJobLeaseError(
      `Job kind ${job.kind} does not match executor kind ${expectedKind}.`,
    );
  }
  if (expectedGenerationId && job.generationId !== expectedGenerationId) {
    throw new OperationalJobLeaseError(
      "Job generation does not match executor generation.",
    );
  }

  const [attempt] = await tx
    .select()
    .from(operationalJobAttempts)
    .where(
      and(
        eq(operationalJobAttempts.jobId, job.id),
        eq(operationalJobAttempts.attempt, job.attemptCount),
        eq(operationalJobAttempts.leaseToken, leaseToken),
      ),
    )
    .for("update");
  if (
    !attempt ||
    attempt.status !== "running" ||
    attempt.leaseOwner !== workerId ||
    attempt.generationId !== job.generationId
  ) {
    throw new OperationalJobLeaseError(
      "Job attempt is missing, stale, or owned by another worker identity.",
    );
  }

  return { authorityNow, job, attempt } as const;
};

export const heartbeatOperationalJob = async ({
  database = db,
  jobId,
  leaseToken,
  workerId: rawWorkerId,
  now: testNow,
}: {
  database?: JobDatabase;
  jobId: string;
  leaseToken: string;
  workerId: string;
  /** Deterministic PostgreSQL contract-test seam. Production callers omit it. */
  now?: Date;
}) => {
  const workerId = normalizeRequiredJobText(rawWorkerId, "Worker ID");
  return database.transaction(async (tx) => {
    const [current] = await tx
      .select()
      .from(operationalJobs)
      .where(eq(operationalJobs.id, jobId))
      .for("update");
    const authorityNow = await resolveOperationalJobNow(tx, testNow);
    const job = assertFreshLease(current, leaseToken, authorityNow, workerId);
    const policy = getOperationalJobPolicy(job.kind);
    const leaseExpiresAt = capLeaseAtDeadline({
      now: authorityNow,
      leaseSeconds: policy.leaseSeconds,
      deadlineAt: job.deadlineAt,
    });
    const [updated] = await tx
      .update(operationalJobs)
      .set({
        leaseExpiresAt,
        lastHeartbeatAt: authorityNow,
        updatedAt: authorityNow,
      })
      .where(
        and(
          eq(operationalJobs.id, job.id),
          eq(operationalJobs.leaseToken, leaseToken),
          gt(operationalJobs.leaseExpiresAt, authorityNow),
          gt(operationalJobs.deadlineAt, authorityNow),
          inArray(operationalJobs.status, activeLeaseStatuses),
        ),
      )
      .returning();
    if (!updated) {
      throw new OperationalJobLeaseError("Job lease heartbeat lost its fence.");
    }
    const [attempt] = await tx
      .update(operationalJobAttempts)
      .set({
        lastHeartbeatAt: authorityNow,
        updatedAt: authorityNow,
      })
      .where(
        and(
          eq(operationalJobAttempts.jobId, job.id),
          eq(operationalJobAttempts.attempt, job.attemptCount),
          eq(operationalJobAttempts.leaseToken, leaseToken),
          eq(operationalJobAttempts.leaseOwner, workerId),
          eq(operationalJobAttempts.status, "running"),
        ),
      )
      .returning();
    if (!attempt) {
      throw new OperationalJobLeaseError(
        "Job attempt heartbeat lost its fence.",
      );
    }
    return updated;
  });
};

export const recordOperationalJobStage = async ({
  database = db,
  jobId,
  leaseToken,
  progress,
  outputRootKey: rawOutputRootKey,
  outputManifest,
  workerId: rawWorkerId,
  reason: rawReason,
  now: testNow,
}: {
  database?: JobDatabase;
  jobId: string;
  leaseToken: string;
  progress: Record<string, unknown>;
  outputRootKey?: string;
  outputManifest?: Record<string, unknown>;
  workerId: string;
  reason: string;
  /** Deterministic PostgreSQL contract-test seam. Production callers omit it. */
  now?: Date;
}) => {
  const workerId = normalizeRequiredJobText(rawWorkerId, "Worker ID");
  const reason = normalizeRequiredJobText(rawReason, "Reason");
  const normalizedProgress = normalizeOperationalJobJsonObject(
    progress,
    "Progress",
  );
  const normalizedOutputRootKey = rawOutputRootKey
    ? normalizeRequiredJobText(rawOutputRootKey, "Output root key")
    : null;
  if (
    normalizedOutputRootKey &&
    (normalizedOutputRootKey.startsWith("/") ||
      normalizedOutputRootKey.includes(".."))
  ) {
    throw new OperationalJobConflictError(
      "Output root key must be relative and cannot traverse.",
    );
  }
  const normalizedOutputManifest = outputManifest
    ? normalizeOperationalJobJsonObject(outputManifest, "Output manifest")
    : null;
  return database.transaction(async (tx) => {
    const [current] = await tx
      .select()
      .from(operationalJobs)
      .where(eq(operationalJobs.id, jobId))
      .for("update");
    const authorityNow = await resolveOperationalJobNow(tx, testNow);
    const job = assertFreshLease(current, leaseToken, authorityNow, workerId);
    if (job.status !== "running") {
      throw new OperationalJobLeaseError(
        "Cancel-requested work cannot record additional stages.",
      );
    }
    const nextRevision = job.revision + 1;
    const [updated] = await tx
      .update(operationalJobs)
      .set({
        progress: normalizedProgress,
        revision: nextRevision,
        updatedAt: authorityNow,
      })
      .where(
        and(
          eq(operationalJobs.id, job.id),
          eq(operationalJobs.leaseToken, leaseToken),
          eq(operationalJobs.revision, job.revision),
          gt(operationalJobs.leaseExpiresAt, authorityNow),
          gt(operationalJobs.deadlineAt, authorityNow),
        ),
      )
      .returning();
    if (!updated) {
      throw new OperationalJobLeaseError("Job stage update lost its fence.");
    }
    const [currentAttempt] = await tx
      .select()
      .from(operationalJobAttempts)
      .where(
        and(
          eq(operationalJobAttempts.jobId, job.id),
          eq(operationalJobAttempts.attempt, job.attemptCount),
          eq(operationalJobAttempts.leaseToken, leaseToken),
          eq(operationalJobAttempts.leaseOwner, workerId),
          eq(operationalJobAttempts.status, "running"),
        ),
      )
      .for("update");
    if (!currentAttempt) {
      throw new OperationalJobLeaseError("Job attempt stage lost its fence.");
    }
    if (
      normalizedOutputRootKey &&
      currentAttempt.outputRootKey &&
      currentAttempt.outputRootKey !== normalizedOutputRootKey
    ) {
      throw new OperationalJobConflictError(
        "A job attempt cannot change its output root.",
      );
    }

    const [attempt] = await tx
      .update(operationalJobAttempts)
      .set({
        progress: normalizedProgress,
        outputRootKey: normalizedOutputRootKey ?? currentAttempt.outputRootKey,
        outputManifest:
          normalizedOutputManifest ?? currentAttempt.outputManifest,
        lastHeartbeatAt: authorityNow,
        updatedAt: authorityNow,
      })
      .where(
        and(
          eq(operationalJobAttempts.jobId, job.id),
          eq(operationalJobAttempts.attempt, job.attemptCount),
          eq(operationalJobAttempts.leaseToken, leaseToken),
          eq(operationalJobAttempts.leaseOwner, workerId),
          eq(operationalJobAttempts.status, "running"),
        ),
      )
      .returning();
    if (!attempt)
      throw new OperationalJobLeaseError("Job attempt stage lost its fence.");
    await insertOperationalJobEvent({
      tx,
      job: updated,
      kind: "stage_recorded",
      expectedRevision: job.revision,
      nextRevision,
      fromStatus: job.status,
      toStatus: job.status,
      actor: workerId,
      reason,
      details: { progress: normalizedProgress },
    });
    return updated;
  });
};

type CompleteOperationalJobInput = {
  jobId: string;
  leaseToken: string;
  result: Record<string, unknown>;
  workerId: string;
  reason: string;
  /** Deterministic PostgreSQL contract-test seam. Production callers omit it. */
  now?: Date;
};

export const completeOperationalJobInTransaction = async ({
  tx,
  jobId,
  leaseToken,
  result,
  workerId: rawWorkerId,
  reason: rawReason,
  now: testNow,
}: CompleteOperationalJobInput & { tx: JobTransaction }) => {
  const workerId = normalizeRequiredJobText(rawWorkerId, "Worker ID");
  const reason = normalizeRequiredJobText(rawReason, "Reason");
  const normalizedResult = normalizeOperationalJobJsonObject(result, "Result");
  const [current] = await tx
    .select()
    .from(operationalJobs)
    .where(eq(operationalJobs.id, jobId))
    .for("update");
  const authorityNow = await resolveOperationalJobNow(tx, testNow);
  const job = assertFreshLease(current, leaseToken, authorityNow, workerId);
  if (job.status === "cancel_requested") {
    throw new OperationalJobLeaseError(
      "Canceled work cannot be completed as successful.",
    );
  }
  const nextRevision = job.revision + 1;
  const [updated] = await tx
    .update(operationalJobs)
    .set({
      status: "succeeded",
      result: normalizedResult,
      lastError: null,
      revision: nextRevision,
      leaseOwner: null,
      leaseToken: null,
      leaseExpiresAt: null,
      lastHeartbeatAt: authorityNow,
      finishedAt: authorityNow,
      updatedAt: authorityNow,
    })
    .where(
      and(
        eq(operationalJobs.id, job.id),
        eq(operationalJobs.status, "running"),
        eq(operationalJobs.leaseToken, leaseToken),
        eq(operationalJobs.revision, job.revision),
        gt(operationalJobs.leaseExpiresAt, authorityNow),
        gt(operationalJobs.deadlineAt, authorityNow),
      ),
    )
    .returning();
  if (!updated) {
    throw new OperationalJobLeaseError("Job completion lost its fence.");
  }
  const [attempt] = await tx
    .update(operationalJobAttempts)
    .set({
      status: "succeeded",
      result: normalizedResult,
      lastError: null,
      lastHeartbeatAt: authorityNow,
      finishedAt: authorityNow,
      updatedAt: authorityNow,
    })
    .where(
      and(
        eq(operationalJobAttempts.jobId, job.id),
        eq(operationalJobAttempts.attempt, job.attemptCount),
        eq(operationalJobAttempts.leaseToken, leaseToken),
        eq(operationalJobAttempts.leaseOwner, workerId),
        eq(operationalJobAttempts.status, "running"),
      ),
    )
    .returning();
  if (!attempt) {
    throw new OperationalJobLeaseError(
      "Job attempt completion lost its fence.",
    );
  }
  await insertOperationalJobEvent({
    tx,
    job: updated,
    kind: "succeeded",
    expectedRevision: job.revision,
    nextRevision,
    fromStatus: "running",
    toStatus: "succeeded",
    actor: workerId,
    reason,
    details: { result: normalizedResult },
  });
  return updated;
};

export const completeOperationalJob = async ({
  database = db,
  ...input
}: CompleteOperationalJobInput & { database?: JobDatabase }) =>
  database.transaction((tx) =>
    completeOperationalJobInTransaction({ tx, ...input }),
  );

const retryDelaySeconds = (
  policy: OperationalJobPolicy,
  attemptCount: number,
) => policy.retryBackoffSeconds * 2 ** Math.max(attemptCount - 1, 0);

export const failOperationalJobAttempt = async ({
  database = db,
  jobId,
  leaseToken,
  error,
  retryable,
  workerId: rawWorkerId,
  reason: rawReason,
  now: testNow,
}: {
  database?: JobDatabase;
  jobId: string;
  leaseToken: string;
  error: Record<string, unknown>;
  retryable: boolean;
  workerId: string;
  reason: string;
  /** Deterministic PostgreSQL contract-test seam. Production callers omit it. */
  now?: Date;
}) => {
  const workerId = normalizeRequiredJobText(rawWorkerId, "Worker ID");
  const reason = normalizeRequiredJobText(rawReason, "Reason");
  const normalizedError = normalizeOperationalJobJsonObject(error, "Error");
  return database.transaction(async (tx) => {
    const [current] = await tx
      .select()
      .from(operationalJobs)
      .where(eq(operationalJobs.id, jobId))
      .for("update");
    const authorityNow = await resolveOperationalJobNow(tx, testNow);
    const job = assertFreshLease(current, leaseToken, authorityNow, workerId);
    const policy = getOperationalJobPolicy(job.kind);
    const retryAt = new Date(
      authorityNow.getTime() +
        retryDelaySeconds(policy, job.attemptCount) * 1_000,
    );
    const canceled = job.status === "cancel_requested";
    const willRetry =
      !canceled &&
      retryable &&
      job.attemptCount < job.maxAttempts &&
      retryAt < job.deadlineAt;
    const nextStatus: OperationalJobStatus = canceled
      ? "canceled"
      : willRetry
        ? "queued"
        : "failed";
    const nextRevision = job.revision + 1;
    const [updated] = await tx
      .update(operationalJobs)
      .set({
        status: nextStatus,
        lastError: normalizedError,
        availableAt: willRetry ? retryAt : job.availableAt,
        revision: nextRevision,
        leaseOwner: null,
        leaseToken: null,
        leaseExpiresAt: null,
        lastHeartbeatAt: authorityNow,
        finishedAt: willRetry ? null : authorityNow,
        updatedAt: authorityNow,
      })
      .where(
        and(
          eq(operationalJobs.id, job.id),
          eq(operationalJobs.leaseToken, leaseToken),
          eq(operationalJobs.revision, job.revision),
          gt(operationalJobs.leaseExpiresAt, authorityNow),
          gt(operationalJobs.deadlineAt, authorityNow),
        ),
      )
      .returning();
    if (!updated) {
      throw new OperationalJobLeaseError("Job failure update lost its fence.");
    }
    const [attempt] = await tx
      .update(operationalJobAttempts)
      .set({
        status: canceled ? "canceled" : "failed",
        lastError: normalizedError,
        lastHeartbeatAt: authorityNow,
        finishedAt: authorityNow,
        updatedAt: authorityNow,
      })
      .where(
        and(
          eq(operationalJobAttempts.jobId, job.id),
          eq(operationalJobAttempts.attempt, job.attemptCount),
          eq(operationalJobAttempts.leaseToken, leaseToken),
          eq(operationalJobAttempts.leaseOwner, workerId),
          eq(operationalJobAttempts.status, "running"),
        ),
      )
      .returning();
    if (!attempt) {
      throw new OperationalJobLeaseError("Job attempt failure lost its fence.");
    }
    if (!willRetry) {
      await applyReleaseJobTerminalState({
        tx,
        job: updated,
        now: authorityNow,
      });
    }
    await insertOperationalJobEvent({
      tx,
      job: updated,
      kind: canceled ? "canceled" : willRetry ? "retry_scheduled" : "failed",
      expectedRevision: job.revision,
      nextRevision,
      fromStatus: job.status,
      toStatus: nextStatus,
      actor: workerId,
      reason,
      details: {
        error: normalizedError,
        retryable,
        ...(willRetry ? { retryAt: retryAt.toISOString() } : {}),
      },
    });
    return updated;
  });
};

export const repairExpiredOperationalJobs = async ({
  database = db,
  kind,
  actor: rawActor,
  reason: rawReason,
  idempotencyKey: rawIdempotencyKey,
  now: testNow,
  limit = 100,
}: {
  database?: JobDatabase;
  kind: OperationalJobKind;
  actor: string;
  reason: string;
  idempotencyKey: string;
  /** Deterministic PostgreSQL contract-test seam. Production callers omit it. */
  now?: Date;
  limit?: number;
}) => {
  const actor = normalizeRequiredJobText(rawActor, "Actor");
  const reason = normalizeRequiredJobText(rawReason, "Reason");
  const idempotencyKey = normalizeRequiredJobText(
    rawIdempotencyKey,
    "Idempotency key",
  );
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 500) {
    throw new OperationalJobConflictError(
      "Repair limit must be between 1 and 500.",
    );
  }
  const request = {
    contractVersion: operationalJobContractVersion,
    operation: "repair_expired",
    kind,
    actor,
    reason,
    limit,
  };
  const requestHash = hashOperationalJobRequest(request);
  return database.transaction(async (tx) => {
    await acquireOperationalJobLock(tx, "repair", kind);
    const commandState = await beginOperationalJobCommand({
      tx,
      kind: "repair_expired",
      idempotencyKey,
      requestHash,
      actor,
      reason,
      request,
      testNow,
    });
    const { authorityNow } = commandState;
    if (commandState.replayed) {
      return {
        jobs: readCommandJobSnapshots(commandState.command),
        replayed: true,
      } as const;
    }
    const candidates = await tx
      .select()
      .from(operationalJobs)
      .where(
        and(
          eq(operationalJobs.kind, kind),
          or(
            and(
              eq(operationalJobs.status, "queued"),
              lte(operationalJobs.deadlineAt, authorityNow),
            ),
            and(
              inArray(operationalJobs.status, activeLeaseStatuses),
              or(
                lte(operationalJobs.leaseExpiresAt, authorityNow),
                lte(operationalJobs.deadlineAt, authorityNow),
              ),
            ),
          ),
        ),
      )
      .orderBy(asc(operationalJobs.deadlineAt), asc(operationalJobs.createdAt))
      .limit(limit)
      .for("update", { skipLocked: true });

    const repaired: OperationalJob[] = [];
    for (const job of candidates) {
      const plan = planExpiredOperationalJobRepair(job, authorityNow);
      if (!plan) continue;
      const canceled = plan.nextStatus === "canceled";
      const willRetry = plan.nextStatus === "queued";
      const nextRevision = job.revision + 1;
      const [updated] = await tx
        .update(operationalJobs)
        .set({
          status: plan.nextStatus,
          lastError: canceled ? job.lastError : plan.error,
          availableAt: plan.retryAt ?? job.availableAt,
          revision: nextRevision,
          leaseOwner: null,
          leaseToken: null,
          leaseExpiresAt: null,
          lastHeartbeatAt: authorityNow,
          finishedAt: willRetry ? null : authorityNow,
          updatedAt: authorityNow,
        })
        .where(
          and(
            eq(operationalJobs.id, job.id),
            eq(operationalJobs.revision, job.revision),
            eq(operationalJobs.status, job.status),
          ),
        )
        .returning();
      if (!updated) continue;
      if (activeLeaseStatuses.includes(job.status)) {
        const [attempt] = await tx
          .update(operationalJobAttempts)
          .set({
            status: canceled ? "canceled" : "lease_expired",
            lastError: canceled ? job.lastError : plan.error,
            lastHeartbeatAt: authorityNow,
            finishedAt: authorityNow,
            updatedAt: authorityNow,
          })
          .where(
            and(
              eq(operationalJobAttempts.jobId, job.id),
              eq(operationalJobAttempts.attempt, job.attemptCount),
              eq(operationalJobAttempts.status, "running"),
            ),
          )
          .returning();
        if (!attempt) {
          throw new OperationalJobLeaseError(
            `Expired job ${job.id} was missing its active attempt fence.`,
          );
        }
      }
      if (!willRetry) {
        await applyReleaseJobTerminalState({
          tx,
          job: updated,
          now: authorityNow,
        });
      }
      await insertOperationalJobEvent({
        tx,
        job: updated,
        kind: canceled ? "canceled" : willRetry ? "lease_recovered" : "failed",
        expectedRevision: job.revision,
        nextRevision,
        fromStatus: job.status,
        toStatus: plan.nextStatus,
        actor,
        reason,
        details: {
          error: plan.error,
          repairAction: plan.repairAction,
          ...(plan.retryAt ? { retryAt: plan.retryAt.toISOString() } : {}),
        },
      });
      repaired.push(updated);
    }
    const snapshots = repaired.map(serializeOperationalJobForOperator);
    await completeOperationalJobCommand({
      tx,
      commandId: commandState.command.id,
      result: { jobs: snapshots },
      now: authorityNow,
    });
    return { jobs: snapshots, replayed: false } as const;
  });
};

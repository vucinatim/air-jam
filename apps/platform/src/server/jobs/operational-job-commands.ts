import { db } from "@/db";
import { gameReleases, games, operationalJobs } from "@/db/schema";
import {
  operationalJobContractVersion,
  type OperationalJobCommandKind,
  type OperationalJobKind,
  type OperationalJobStatus,
} from "@air-jam/database-contract";
import { and, count, eq } from "drizzle-orm";
import {
  OperationalJobCapacityError,
  OperationalJobConflictError,
  acquireOperationalJobLock,
  beginOperationalJobCommand,
  completeOperationalJobCommand,
  hashOperationalJobRequest,
  insertOperationalJobEvent,
  normalizeOperationalJobJsonObject,
  normalizeRequiredJobText,
  readCommandJobSnapshot,
  resolveOperationalJobNow,
  serializeOperationalJobForOperator,
  type JobDatabase,
  type JobTransaction,
  type OperationalJob,
} from "./operational-job-internals";
import { planOperationalJobCancellation } from "./operational-job-planning";
import { getOperationalJobPolicy } from "./operational-job-policy";

const assertJobScope = async ({
  tx,
  creatorId,
  gameId,
  releaseId,
}: {
  tx: JobTransaction;
  creatorId: string;
  gameId: string;
  releaseId: string;
}) => {
  const rows = await tx
    .select({ releaseId: gameReleases.id })
    .from(gameReleases)
    .innerJoin(games, eq(gameReleases.gameId, games.id))
    .where(
      and(
        eq(gameReleases.id, releaseId),
        eq(gameReleases.gameId, gameId),
        eq(games.userId, creatorId),
      ),
    )
    .limit(1);
  if (!rows[0]) {
    throw new OperationalJobConflictError(
      "Release was not found in the requested creator and game scope.",
    );
  }
};

const countQueuedJobs = async (
  tx: JobTransaction,
  kind: OperationalJobKind,
): Promise<number> => {
  const rows = await tx
    .select({ total: count() })
    .from(operationalJobs)
    .where(
      and(eq(operationalJobs.kind, kind), eq(operationalJobs.status, "queued")),
    );
  return Number(rows[0]?.total ?? 0);
};

type CreateOperationalJobInput = {
  commandId: string;
  commandKind: OperationalJobCommandKind;
  kind: OperationalJobKind;
  creatorId: string;
  gameId: string;
  releaseId: string;
  payload: Record<string, unknown>;
  priority: number;
  correlationId: string;
  replayOfJobId: string | null;
  requestHash: string;
  actor: string;
  reason: string;
  testNow?: Date;
};

const createOperationalJob = async ({
  tx,
  commandId,
  commandKind,
  kind,
  creatorId,
  gameId,
  releaseId,
  payload,
  priority,
  correlationId,
  replayOfJobId,
  requestHash,
  actor,
  reason,
  testNow,
}: CreateOperationalJobInput & {
  tx: JobTransaction;
}): Promise<OperationalJob> => {
  const policy = getOperationalJobPolicy(kind);
  await acquireOperationalJobLock(tx, "enqueue", kind);
  const now = await resolveOperationalJobNow(tx, testNow);
  await assertJobScope({ tx, creatorId, gameId, releaseId });
  const active = await tx.query.operationalJobs.findFirst({
    where: (table, { and, eq, inArray }) =>
      and(
        eq(table.kind, kind),
        eq(table.releaseId, releaseId),
        inArray(table.status, ["queued", "running", "cancel_requested"]),
      ),
  });
  if (active) {
    throw new OperationalJobConflictError(
      `Release already has active ${kind} job ${active.id}.`,
    );
  }
  if ((await countQueuedJobs(tx, kind)) >= policy.queueDepth) {
    throw new OperationalJobCapacityError(
      `${kind} queue reached its capacity of ${policy.queueDepth}.`,
    );
  }

  const deadlineAt = new Date(now.getTime() + policy.deadlineSeconds * 1_000);
  const [job] = await tx
    .insert(operationalJobs)
    .values({
      id: crypto.randomUUID(),
      contractVersion: operationalJobContractVersion,
      kind,
      lane: policy.lane,
      status: "queued",
      creatorId,
      gameId,
      releaseId,
      createdByCommandId: commandId,
      requestHash,
      correlationId,
      replayOfJobId,
      payload,
      priority,
      availableAt: now,
      deadlineAt,
      maxAttempts: policy.maxAttempts,
      revision: 1,
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  if (!job) throw new Error("Operational job could not be enqueued.");
  await insertOperationalJobEvent({
    tx,
    job,
    kind: commandKind === "replay" ? "replayed" : "enqueued",
    expectedRevision: 0,
    nextRevision: 1,
    fromStatus: null,
    toStatus: "queued",
    actor,
    reason,
    details: replayOfJobId ? { replayOfJobId } : {},
  });
  return job;
};

export type EnqueueOperationalJobInput = {
  kind: OperationalJobKind;
  creatorId: string;
  gameId: string;
  releaseId: string;
  idempotencyKey: string;
  payload?: Record<string, unknown>;
  priority?: number;
  correlationId?: string;
  actor: string;
  reason: string;
  /** Deterministic PostgreSQL contract-test seam. Production callers omit it. */
  now?: Date;
};

export const enqueueOperationalJob = async ({
  database = db,
  kind,
  creatorId: rawCreatorId,
  gameId: rawGameId,
  releaseId: rawReleaseId,
  idempotencyKey: rawIdempotencyKey,
  payload: rawPayload = {},
  priority = 0,
  correlationId: rawCorrelationId,
  actor: rawActor,
  reason: rawReason,
  now: testNow,
}: EnqueueOperationalJobInput & { database?: JobDatabase }) => {
  const creatorId = normalizeRequiredJobText(rawCreatorId, "Creator ID");
  const gameId = normalizeRequiredJobText(rawGameId, "Game ID");
  const releaseId = normalizeRequiredJobText(rawReleaseId, "Release ID");
  const idempotencyKey = normalizeRequiredJobText(
    rawIdempotencyKey,
    "Idempotency key",
  );
  const actor = normalizeRequiredJobText(rawActor, "Actor");
  const reason = normalizeRequiredJobText(rawReason, "Reason");
  const payload = normalizeOperationalJobJsonObject(rawPayload, "Payload");
  const explicitCorrelationId = rawCorrelationId?.trim() || null;
  if (!Number.isSafeInteger(priority)) {
    throw new OperationalJobConflictError("Priority must be a safe integer.");
  }
  const request = {
    contractVersion: operationalJobContractVersion,
    operation: "enqueue",
    kind,
    creatorId,
    gameId,
    releaseId,
    payload,
    priority,
    correlationId: explicitCorrelationId,
    actor,
    reason,
  };
  const requestHash = hashOperationalJobRequest(request);

  return database.transaction(async (tx) => {
    const commandState = await beginOperationalJobCommand({
      tx,
      kind: "enqueue",
      idempotencyKey,
      requestHash,
      actor,
      reason,
      request,
      testNow,
    });
    if (commandState.replayed) {
      return {
        job: readCommandJobSnapshot(commandState.command),
        replayed: true,
      } as const;
    }

    const job = await createOperationalJob({
      tx,
      commandId: commandState.command.id,
      commandKind: "enqueue",
      kind,
      creatorId,
      gameId,
      releaseId,
      payload,
      priority,
      correlationId: explicitCorrelationId ?? crypto.randomUUID(),
      replayOfJobId: null,
      requestHash,
      actor,
      reason,
      testNow,
    });
    const snapshot = serializeOperationalJobForOperator(job);
    await completeOperationalJobCommand({
      tx,
      commandId: commandState.command.id,
      result: { job: snapshot },
      now: job.createdAt,
    });
    return { job: snapshot, replayed: false } as const;
  });
};

type OperationalJobCancellationCommandInput = {
  jobId: string;
  expectedRevision: number;
  idempotencyKey: string;
  actor: string;
  reason: string;
};

const normalizeOperationalJobCancellationCommand = ({
  jobId: rawJobId,
  expectedRevision: rawExpectedRevision,
  idempotencyKey: rawIdempotencyKey,
  actor: rawActor,
  reason: rawReason,
}: OperationalJobCancellationCommandInput) => {
  const jobId = normalizeRequiredJobText(rawJobId, "Job ID");
  const actor = normalizeRequiredJobText(rawActor, "Actor");
  const reason = normalizeRequiredJobText(rawReason, "Reason");
  const idempotencyKey = normalizeRequiredJobText(
    rawIdempotencyKey,
    "Idempotency key",
  );
  if (!Number.isSafeInteger(rawExpectedRevision) || rawExpectedRevision < 1) {
    throw new OperationalJobConflictError(
      "Expected revision must be a positive safe integer.",
    );
  }
  const request = {
    contractVersion: operationalJobContractVersion,
    operation: "cancel",
    jobId,
    expectedRevision: rawExpectedRevision,
    actor,
    reason,
  };
  return {
    jobId,
    expectedRevision: rawExpectedRevision,
    idempotencyKey,
    actor,
    reason,
    request,
    requestHash: hashOperationalJobRequest(request),
  };
};

export const previewOperationalJobCancellation = async ({
  database = db,
  ...input
}: OperationalJobCancellationCommandInput & { database?: JobDatabase }) => {
  const normalized = normalizeOperationalJobCancellationCommand(input);
  const requested = {
    expectedRevision: normalized.expectedRevision,
    actor: normalized.actor,
    reason: normalized.reason,
    idempotencyKey: normalized.idempotencyKey,
  };
  const [existingCommand, currentJob] = await Promise.all([
    database.query.operationalJobCommands.findFirst({
      where: (table, { eq }) =>
        eq(table.idempotencyKey, normalized.idempotencyKey),
    }),
    database.query.operationalJobs.findFirst({
      where: (table, { eq }) => eq(table.id, normalized.jobId),
    }),
  ]);

  if (existingCommand) {
    const exactReplay =
      existingCommand.kind === "cancel" &&
      existingCommand.requestHash === normalized.requestHash &&
      existingCommand.result !== null &&
      existingCommand.completedAt !== null;
    if (!exactReplay) {
      return {
        current: currentJob
          ? serializeOperationalJobForOperator(currentJob)
          : null,
        requested,
        revisionMatches: currentJob?.revision === normalized.expectedRevision,
        eligible: false,
        wouldReplay: false,
        nextStatus: null,
        rejectionReason:
          "Idempotency key was already used for a different or incomplete job command.",
      } as const;
    }
    const replayedResult = readCommandJobSnapshot(existingCommand);
    return {
      current: currentJob
        ? serializeOperationalJobForOperator(currentJob)
        : null,
      requested,
      revisionMatches: currentJob?.revision === normalized.expectedRevision,
      eligible: true,
      wouldReplay: true,
      nextStatus: replayedResult.status,
      rejectionReason: null,
    } as const;
  }

  if (!currentJob) {
    throw new OperationalJobConflictError("Operational job was not found.");
  }
  const plan = planOperationalJobCancellation(currentJob);
  const revisionMatches = currentJob.revision === normalized.expectedRevision;
  return {
    current: serializeOperationalJobForOperator(currentJob),
    requested,
    revisionMatches,
    eligible: plan.eligible && revisionMatches,
    wouldReplay: false,
    nextStatus: plan.nextStatus,
    rejectionReason: !revisionMatches
      ? `Expected revision ${normalized.expectedRevision} does not match current revision ${currentJob.revision}.`
      : plan.rejectionReason,
  } as const;
};

export const requestOperationalJobCancellation = async ({
  database = db,
  jobId: rawJobId,
  expectedRevision: rawExpectedRevision,
  idempotencyKey: rawIdempotencyKey,
  actor: rawActor,
  reason: rawReason,
  now: testNow,
}: {
  database?: JobDatabase;
  jobId: string;
  expectedRevision: number;
  idempotencyKey: string;
  actor: string;
  reason: string;
  /** Deterministic PostgreSQL contract-test seam. Production callers omit it. */
  now?: Date;
}) => {
  const {
    jobId,
    expectedRevision,
    idempotencyKey,
    actor,
    reason,
    request,
    requestHash,
  } = normalizeOperationalJobCancellationCommand({
    jobId: rawJobId,
    expectedRevision: rawExpectedRevision,
    idempotencyKey: rawIdempotencyKey,
    actor: rawActor,
    reason: rawReason,
  });

  return database.transaction(async (tx) => {
    const commandState = await beginOperationalJobCommand({
      tx,
      kind: "cancel",
      idempotencyKey,
      requestHash,
      actor,
      reason,
      request,
      testNow,
    });
    if (commandState.replayed) {
      return {
        job: readCommandJobSnapshot(commandState.command),
        replayed: true,
      } as const;
    }

    const [job] = await tx
      .select()
      .from(operationalJobs)
      .where(eq(operationalJobs.id, jobId))
      .for("update");
    if (!job) {
      throw new OperationalJobConflictError("Operational job was not found.");
    }
    const mutationNow = await resolveOperationalJobNow(tx, testNow);
    if (job.revision !== expectedRevision) {
      throw new OperationalJobConflictError(
        `Expected job revision ${expectedRevision}, found ${job.revision}.`,
      );
    }
    const plan = planOperationalJobCancellation(job);
    if (!plan.eligible || !plan.nextStatus) {
      throw new OperationalJobConflictError(
        plan.rejectionReason ?? "Job cannot accept a cancellation request.",
      );
    }
    const nextStatus: OperationalJobStatus = plan.nextStatus;
    const nextRevision = job.revision + 1;
    const [updated] = await tx
      .update(operationalJobs)
      .set({
        status: nextStatus,
        revision: nextRevision,
        cancelRequestedAt: mutationNow,
        cancelRequestedBy: actor,
        cancelReason: reason,
        finishedAt: nextStatus === "canceled" ? mutationNow : null,
        updatedAt: mutationNow,
      })
      .where(
        and(
          eq(operationalJobs.id, job.id),
          eq(operationalJobs.revision, job.revision),
        ),
      )
      .returning();
    if (!updated) {
      throw new OperationalJobConflictError(
        "Job cancellation lost its revision fence.",
      );
    }
    await insertOperationalJobEvent({
      tx,
      job: updated,
      kind: nextStatus === "canceled" ? "canceled" : "cancel_requested",
      expectedRevision: job.revision,
      nextRevision,
      fromStatus: job.status,
      toStatus: nextStatus,
      actor,
      reason,
      details: { expectedRevision },
    });
    const snapshot = serializeOperationalJobForOperator(updated);
    await completeOperationalJobCommand({
      tx,
      commandId: commandState.command.id,
      result: { job: snapshot },
      now: mutationNow,
    });
    return { job: snapshot, replayed: false } as const;
  });
};

export const replayOperationalJob = async ({
  database = db,
  jobId: rawJobId,
  idempotencyKey: rawIdempotencyKey,
  actor: rawActor,
  reason: rawReason,
  now: testNow,
}: {
  database?: JobDatabase;
  jobId: string;
  idempotencyKey: string;
  actor: string;
  reason: string;
  /** Deterministic PostgreSQL contract-test seam. Production callers omit it. */
  now?: Date;
}) => {
  const jobId = normalizeRequiredJobText(rawJobId, "Job ID");
  const idempotencyKey = normalizeRequiredJobText(
    rawIdempotencyKey,
    "Idempotency key",
  );
  const actor = normalizeRequiredJobText(rawActor, "Actor");
  const reason = normalizeRequiredJobText(rawReason, "Reason");
  const request = {
    contractVersion: operationalJobContractVersion,
    operation: "replay",
    jobId,
    actor,
    reason,
  };
  const requestHash = hashOperationalJobRequest(request);

  return database.transaction(async (tx) => {
    const commandState = await beginOperationalJobCommand({
      tx,
      kind: "replay",
      idempotencyKey,
      requestHash,
      actor,
      reason,
      request,
      testNow,
    });
    if (commandState.replayed) {
      return {
        job: readCommandJobSnapshot(commandState.command),
        replayed: true,
      } as const;
    }

    const [original] = await tx
      .select()
      .from(operationalJobs)
      .where(eq(operationalJobs.id, jobId))
      .for("share");
    if (!original) {
      throw new OperationalJobConflictError("Operational job was not found.");
    }
    if (!["succeeded", "failed", "canceled"].includes(original.status)) {
      throw new OperationalJobConflictError(
        "Only terminal jobs can be replayed.",
      );
    }
    const replay = await createOperationalJob({
      tx,
      commandId: commandState.command.id,
      commandKind: "replay",
      kind: original.kind,
      creatorId: original.creatorId,
      gameId: original.gameId,
      releaseId: original.releaseId,
      payload: original.payload,
      priority: original.priority,
      correlationId: original.correlationId,
      replayOfJobId: original.id,
      requestHash,
      actor,
      reason,
      testNow,
    });
    const snapshot = serializeOperationalJobForOperator(replay);
    await completeOperationalJobCommand({
      tx,
      commandId: commandState.command.id,
      result: { job: snapshot },
      now: replay.createdAt,
    });
    return { job: snapshot, replayed: false } as const;
  });
};

import { db } from "@/db";
import {
  gameMediaAssets,
  gameReleaseGenerations,
  gameReleases,
  games,
  operationalJobs,
} from "@/db/schema";
import {
  operationalJobContractVersion,
  type OperationalJobCommandKind,
  type OperationalJobKind,
  type OperationalJobResourceKind,
  type OperationalJobStatus,
} from "@air-jam/database-contract";
import { and, count, eq, inArray } from "drizzle-orm";
import { lifecycleCleanupJobPayloadSchema } from "./lifecycle-cleanup-job-contract";
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
import {
  isReleaseOperationalJobKind,
  parseReleaseJobPayload,
} from "./release-job-contract";
import {
  applyReleaseJobTerminalState,
  prepareReleaseJobReplayState,
} from "./release-job-terminal-state";

const assertJobScope = async ({
  tx,
  creatorId,
  gameId,
  releaseId,
  generationId,
  resourceKind,
  resourceId,
}: {
  tx: JobTransaction;
  creatorId: string;
  gameId: string;
  releaseId: string | null;
  generationId: string | null;
  resourceKind: OperationalJobResourceKind;
  resourceId: string;
}) => {
  const rows =
    resourceKind === "release_generation"
      ? releaseId && generationId
        ? await tx
            .select({ resourceId: gameReleaseGenerations.id })
            .from(gameReleases)
            .innerJoin(games, eq(gameReleases.gameId, games.id))
            .innerJoin(
              gameReleaseGenerations,
              and(
                eq(gameReleaseGenerations.id, generationId),
                eq(gameReleaseGenerations.releaseId, gameReleases.id),
              ),
            )
            .where(
              and(
                eq(gameReleases.id, releaseId),
                eq(gameReleases.gameId, gameId),
                eq(games.userId, creatorId),
                eq(gameReleaseGenerations.id, resourceId),
              ),
            )
            .limit(1)
        : []
      : await tx
          .select({ resourceId: gameMediaAssets.id })
          .from(gameMediaAssets)
          .innerJoin(games, eq(gameMediaAssets.gameId, games.id))
          .where(
            and(
              eq(gameMediaAssets.id, resourceId),
              eq(gameMediaAssets.gameId, gameId),
              eq(games.userId, creatorId),
            ),
          )
          .limit(1);
  if (!rows[0]) {
    throw new OperationalJobConflictError(
      "Operational resource was not found in the requested creator and game scope.",
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
  releaseId: string | null;
  generationId: string | null;
  resourceKind: OperationalJobResourceKind;
  resourceId: string;
  payload: Record<string, unknown>;
  priority: number;
  correlationId: string;
  replayOfJobId: string | null;
  requestHash: string;
  actor: string;
  reason: string;
  testNow?: Date;
};

export const createOperationalJobInTransaction = async ({
  tx,
  commandId,
  commandKind,
  kind,
  creatorId,
  gameId,
  releaseId,
  generationId,
  resourceKind,
  resourceId,
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
  await assertJobScope({
    tx,
    creatorId,
    gameId,
    releaseId,
    generationId,
    resourceKind,
    resourceId,
  });
  const active = await tx.query.operationalJobs.findFirst({
    where: (table, { and, eq, inArray }) =>
      and(
        eq(table.kind, kind),
        eq(table.resourceKind, resourceKind),
        eq(table.resourceId, resourceId),
        inArray(table.status, ["queued", "running", "cancel_requested"]),
      ),
  });
  if (active) {
    throw new OperationalJobConflictError(
      `Resource already has active ${kind} job ${active.id}.`,
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
      generationId,
      resourceKind,
      resourceId,
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
  releaseId?: string | null;
  generationId?: string | null;
  resourceKind?: OperationalJobResourceKind;
  resourceId?: string;
  idempotencyKey: string;
  payload?: Record<string, unknown>;
  priority?: number;
  correlationId?: string;
  actor: string;
  reason: string;
  /** Deterministic PostgreSQL contract-test seam. Production callers omit it. */
  now?: Date;
};

const normalizeEnqueueOperationalJobInput = ({
  kind,
  creatorId: rawCreatorId,
  gameId: rawGameId,
  releaseId: rawReleaseId,
  generationId: rawGenerationId,
  resourceKind: rawResourceKind,
  resourceId: rawResourceId,
  idempotencyKey: rawIdempotencyKey,
  payload: rawPayload = {},
  priority = 0,
  correlationId: rawCorrelationId,
  actor: rawActor,
  reason: rawReason,
  now: testNow,
}: EnqueueOperationalJobInput) => {
  const creatorId = normalizeRequiredJobText(rawCreatorId, "Creator ID");
  const gameId = normalizeRequiredJobText(rawGameId, "Game ID");
  const idempotencyKey = normalizeRequiredJobText(
    rawIdempotencyKey,
    "Idempotency key",
  );
  const actor = normalizeRequiredJobText(rawActor, "Actor");
  const reason = normalizeRequiredJobText(rawReason, "Reason");
  let parsedPayload: Record<string, unknown>;
  let releaseId: string | null;
  let generationId: string | null;
  let resourceKind: OperationalJobResourceKind;
  let resourceId: string;
  try {
    if (isReleaseOperationalJobKind(kind)) {
      releaseId = normalizeRequiredJobText(rawReleaseId ?? "", "Release ID");
      generationId = normalizeRequiredJobText(
        rawGenerationId ?? "",
        "Generation ID",
      );
      resourceKind = "release_generation";
      resourceId = generationId;
      if (
        (rawResourceKind && rawResourceKind !== resourceKind) ||
        (rawResourceId && rawResourceId !== resourceId)
      ) {
        throw new OperationalJobConflictError(
          "Release jobs must target their scoped release generation.",
        );
      }
      parsedPayload = parseReleaseJobPayload(kind, rawPayload);
    } else {
      const cleanupPayload = lifecycleCleanupJobPayloadSchema.parse(rawPayload);
      resourceKind = rawResourceKind ?? cleanupPayload.resourceKind;
      resourceId = normalizeRequiredJobText(
        rawResourceId ?? cleanupPayload.resourceId,
        "Resource ID",
      );
      if (
        resourceKind !== cleanupPayload.resourceKind ||
        resourceId !== cleanupPayload.resourceId
      ) {
        throw new OperationalJobConflictError(
          "Cleanup payload resource must match the job resource scope.",
        );
      }
      if (resourceKind === "release_generation") {
        releaseId = normalizeRequiredJobText(rawReleaseId ?? "", "Release ID");
        generationId = normalizeRequiredJobText(
          rawGenerationId ?? "",
          "Generation ID",
        );
        if (generationId !== resourceId) {
          throw new OperationalJobConflictError(
            "Cleanup generation must match the job resource ID.",
          );
        }
      } else {
        if (rawReleaseId || rawGenerationId) {
          throw new OperationalJobConflictError(
            "Media cleanup jobs cannot carry release-generation scope.",
          );
        }
        releaseId = null;
        generationId = null;
      }
      parsedPayload = cleanupPayload;
    }
  } catch {
    throw new OperationalJobConflictError(
      `Payload did not match the ${kind} job contract.`,
    );
  }
  const payload = normalizeOperationalJobJsonObject(parsedPayload, "Payload");
  if (
    isReleaseOperationalJobKind(kind) &&
    payload.generationId !== generationId
  ) {
    throw new OperationalJobConflictError(
      "Job payload generation must match the job generation scope.",
    );
  }
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
    generationId,
    resourceKind,
    resourceId,
    payload,
    priority,
    correlationId: explicitCorrelationId,
    actor,
    reason,
  };
  const requestHash = hashOperationalJobRequest(request);

  return {
    kind,
    creatorId,
    gameId,
    releaseId,
    generationId,
    resourceKind,
    resourceId,
    idempotencyKey,
    payload,
    priority,
    explicitCorrelationId,
    actor,
    reason,
    testNow,
    request,
    requestHash,
  } as const;
};

export const enqueueOperationalJobInTransaction = async ({
  tx,
  ...input
}: EnqueueOperationalJobInput & { tx: JobTransaction }) => {
  const normalized = normalizeEnqueueOperationalJobInput(input);

  const commandState = await beginOperationalJobCommand({
    tx,
    kind: "enqueue",
    idempotencyKey: normalized.idempotencyKey,
    requestHash: normalized.requestHash,
    actor: normalized.actor,
    reason: normalized.reason,
    request: normalized.request,
    testNow: normalized.testNow,
  });
  if (commandState.replayed) {
    return {
      job: readCommandJobSnapshot(commandState.command),
      replayed: true,
    } as const;
  }

  const job = await createOperationalJobInTransaction({
    tx,
    commandId: commandState.command.id,
    commandKind: "enqueue",
    kind: normalized.kind,
    creatorId: normalized.creatorId,
    gameId: normalized.gameId,
    releaseId: normalized.releaseId,
    generationId: normalized.generationId,
    resourceKind: normalized.resourceKind,
    resourceId: normalized.resourceId,
    payload: normalized.payload,
    priority: normalized.priority,
    correlationId: normalized.explicitCorrelationId ?? crypto.randomUUID(),
    replayOfJobId: null,
    requestHash: normalized.requestHash,
    actor: normalized.actor,
    reason: normalized.reason,
    testNow: normalized.testNow,
  });
  const snapshot = serializeOperationalJobForOperator(job);
  await completeOperationalJobCommand({
    tx,
    commandId: commandState.command.id,
    result: { job: snapshot },
    now: job.createdAt,
  });
  return { job: snapshot, replayed: false } as const;
};

export const enqueueOperationalJob = async ({
  database = db,
  ...input
}: EnqueueOperationalJobInput & { database?: JobDatabase }) =>
  database.transaction((tx) =>
    enqueueOperationalJobInTransaction({ tx, ...input }),
  );

export const supersedeOperationalJobsForGenerationInTransaction = async ({
  tx,
  generationId: rawGenerationId,
  actor: rawActor,
  reason: rawReason,
}: {
  tx: JobTransaction;
  generationId: string;
  actor: string;
  reason: string;
}) => {
  const generationId = normalizeRequiredJobText(
    rawGenerationId,
    "Generation ID",
  );
  const actor = normalizeRequiredJobText(rawActor, "Actor");
  const reason = normalizeRequiredJobText(rawReason, "Reason");
  const jobs = await tx
    .select()
    .from(operationalJobs)
    .where(
      and(
        eq(operationalJobs.generationId, generationId),
        inArray(operationalJobs.status, [
          "queued",
          "running",
          "cancel_requested",
        ]),
      ),
    )
    .for("update");
  const superseded = [];

  for (const job of jobs) {
    if (job.status === "cancel_requested") {
      superseded.push(serializeOperationalJobForOperator(job));
      continue;
    }
    const now = await resolveOperationalJobNow(tx);
    const nextStatus: OperationalJobStatus =
      job.status === "queued" ? "canceled" : "cancel_requested";
    const nextRevision = job.revision + 1;
    const [updated] = await tx
      .update(operationalJobs)
      .set({
        status: nextStatus,
        revision: nextRevision,
        cancelRequestedAt: now,
        cancelRequestedBy: actor,
        cancelReason: reason,
        finishedAt: nextStatus === "canceled" ? now : null,
        updatedAt: now,
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
        "Generation supersession lost its job revision fence.",
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
      details: { supersededGenerationId: generationId },
    });
    superseded.push(serializeOperationalJobForOperator(updated));
  }

  return superseded;
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
    if (
      nextStatus === "canceled" &&
      isReleaseOperationalJobKind(updated.kind)
    ) {
      await applyReleaseJobTerminalState({
        tx,
        job: updated,
        now: mutationNow,
      });
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
    if (!["failed", "canceled"].includes(original.status)) {
      throw new OperationalJobConflictError(
        "Only failed or canceled jobs can be replayed.",
      );
    }
    if (isReleaseOperationalJobKind(original.kind)) {
      await prepareReleaseJobReplayState({
        tx,
        job: original,
        now: commandState.authorityNow,
      });
    }
    const replay = await createOperationalJobInTransaction({
      tx,
      commandId: commandState.command.id,
      commandKind: "replay",
      kind: original.kind,
      creatorId: original.creatorId,
      gameId: original.gameId,
      releaseId: original.releaseId,
      generationId: original.generationId,
      resourceKind: original.resourceKind,
      resourceId: original.resourceId,
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

import { db } from "@/db";
import {
  operationalAlertIssueProjections,
  operationalAlerts,
} from "@/db/schema";
import {
  DEFAULT_OPERATIONAL_ALERT_ISSUE_MAX_ATTEMPTS,
  createOperationsDocumentDigest,
  createStructuredOperationalFailure,
  githubRepositorySchema,
  normalizeUnknownOperationalFailure,
  operationalAlertIssueProjectionSchemaV1,
  operationalAlertSchemaV1,
  operationalFailureSchemaV1,
  type OperationalAlertIssueProjectionV1,
  type OperationalFailureV1,
} from "@air-jam/operations-contract";
import { and, asc, count, desc, eq, lt, lte, sql } from "drizzle-orm";
import { resolveDatabaseAuthorityNow } from "./database-authority";
import { enqueueOperationalEventInTransaction } from "./operational-event-delivery-service";
import {
  GitHubAlertIssueAdapterError,
  type GitHubAlertIssueProjectionResult,
  type GitHubAlertIssueProjector,
} from "./github-alert-issue-adapter";

export type OperationalAlertIssueProjectionDatabase = typeof db;
type ProjectionRow = typeof operationalAlertIssueProjections.$inferSelect;

const ISSUE_PROJECTION_LEASE_SECONDS = 180;
const ISSUE_PROJECTION_RETRY_MAX_SECONDS = 300;

export class OperationalAlertIssueProjectionConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OperationalAlertIssueProjectionConflictError";
  }
}

export class OperationalAlertIssueProjectionLeaseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OperationalAlertIssueProjectionLeaseError";
  }
}

const normalizeRequiredText = (value: string, label: string): string => {
  const normalized = value.trim();
  if (!normalized) {
    throw new OperationalAlertIssueProjectionConflictError(
      `${label} is required.`,
    );
  }
  return normalized;
};

const normalizeRepository = (repository: string): string => {
  const parsed = githubRepositorySchema.safeParse(repository);
  if (!parsed.success) {
    throw new OperationalAlertIssueProjectionConflictError(
      "Repository must use owner/name format.",
    );
  }
  return parsed.data;
};

const projectionDocumentFromRow = (
  row: Omit<ProjectionRow, "leaseToken" | "targetAlert">,
): OperationalAlertIssueProjectionV1 =>
  operationalAlertIssueProjectionSchemaV1.parse({
    contractVersion: row.contractVersion,
    projectionId: row.id,
    provider: "github",
    repository: row.repository,
    alertKey: row.alertKey,
    targetAlertRevision: row.targetAlertRevision,
    projectedAlertRevision: row.projectedAlertRevision,
    status: row.status,
    attemptCount: row.attemptCount,
    maxAttempts: row.maxAttempts,
    availableAt: row.availableAt.toISOString(),
    leaseOwner: row.leaseOwner,
    leaseExpiresAt: row.leaseExpiresAt?.toISOString() ?? null,
    issue:
      row.issueNumber && row.issueUrl && row.issueState
        ? {
            number: row.issueNumber,
            url: row.issueUrl,
            state: row.issueState,
          }
        : null,
    managedBodyHash: row.managedBodyHash,
    projectedAt: row.projectedAt?.toISOString() ?? null,
    lastError: row.lastError
      ? operationalFailureSchemaV1.parse(row.lastError)
      : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  });

const serializeProjection = (
  row: ProjectionRow,
): OperationalAlertIssueProjectionV1 => projectionDocumentFromRow(row);

export const synchronizeNextOperationalAlertIssueProjection = async ({
  database = db,
  repository: rawRepository,
  maxAttempts = DEFAULT_OPERATIONAL_ALERT_ISSUE_MAX_ATTEMPTS,
  now: testNow,
}: {
  database?: OperationalAlertIssueProjectionDatabase;
  repository: string;
  maxAttempts?: number;
  now?: Date;
}): Promise<OperationalAlertIssueProjectionV1 | null> => {
  const repository = normalizeRepository(rawRepository);
  if (!Number.isInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > 20) {
    throw new OperationalAlertIssueProjectionConflictError(
      "maxAttempts must be between 1 and 20.",
    );
  }
  return database.transaction(async (tx) => {
    const [candidate] = await tx
      .select({ alert: operationalAlerts })
      .from(operationalAlerts)
      .leftJoin(
        operationalAlertIssueProjections,
        and(
          eq(
            operationalAlertIssueProjections.alertKey,
            operationalAlerts.alertKey,
          ),
          eq(operationalAlertIssueProjections.repository, repository),
        ),
      )
      .where(
        sql`${operationalAlertIssueProjections.id} is null or ${operationalAlertIssueProjections.targetAlertRevision} < ${operationalAlerts.revision}`,
      )
      .orderBy(asc(operationalAlerts.updatedAt))
      .limit(1);
    if (!candidate) return null;

    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtext(${`airjam:alert-issue:${repository}:${candidate.alert.alertKey}`}))`,
    );
    const alertRow = await tx.query.operationalAlerts.findFirst({
      where: (table, { eq }) => eq(table.alertKey, candidate.alert.alertKey),
    });
    if (!alertRow) return null;
    const alert = operationalAlertSchemaV1.parse(alertRow.document);
    const existing = await tx.query.operationalAlertIssueProjections.findFirst({
      where: (table, { and, eq }) =>
        and(eq(table.alertKey, alert.alertKey), eq(table.repository, repository)),
    });
    if (
      existing &&
      (existing.targetAlertRevision >= alert.revision ||
        existing.status === "delivering")
    ) {
      return serializeProjection(existing);
    }
    const authorityNow = await resolveDatabaseAuthorityNow(tx, testNow);
    if (!existing) {
      const row: ProjectionRow = {
        id: crypto.randomUUID(),
        contractVersion: 1,
        alertKey: alert.alertKey,
        repository,
        targetAlertRevision: alert.revision,
        targetAlert: alert,
        projectedAlertRevision: 0,
        status: "pending",
        attemptCount: 0,
        maxAttempts,
        availableAt: authorityNow,
        leaseOwner: null,
        leaseToken: null,
        leaseExpiresAt: null,
        issueNumber: null,
        issueUrl: null,
        issueState: null,
        managedBodyHash: null,
        projectedAt: null,
        lastError: null,
        createdAt: authorityNow,
        updatedAt: authorityNow,
      };
      const [inserted] = await tx
        .insert(operationalAlertIssueProjections)
        .values(row)
        .onConflictDoNothing()
        .returning();
      if (inserted) return serializeProjection(inserted);
      return null;
    }
    const next: ProjectionRow = {
      ...existing,
      targetAlertRevision: alert.revision,
      targetAlert: alert,
      status: "pending",
      attemptCount: 0,
      maxAttempts,
      availableAt: authorityNow,
      leaseOwner: null,
      leaseToken: null,
      leaseExpiresAt: null,
      lastError: null,
      updatedAt: authorityNow,
    };
    const [updated] = await tx
      .update(operationalAlertIssueProjections)
      .set(next)
      .where(
        and(
          eq(operationalAlertIssueProjections.id, existing.id),
          eq(
            operationalAlertIssueProjections.targetAlertRevision,
            existing.targetAlertRevision,
          ),
          eq(operationalAlertIssueProjections.status, existing.status),
        ),
      )
      .returning();
    return updated ? serializeProjection(updated) : null;
  });
};

export const claimOperationalAlertIssueProjection = async ({
  database = db,
  repository: rawRepository,
  workerId: rawWorkerId,
  now: testNow,
}: {
  database?: OperationalAlertIssueProjectionDatabase;
  repository: string;
  workerId: string;
  now?: Date;
}): Promise<ProjectionRow | null> => {
  const repository = normalizeRepository(rawRepository);
  const workerId = normalizeRequiredText(rawWorkerId, "Worker ID");
  return database.transaction(async (tx) => {
    const authorityNow = await resolveDatabaseAuthorityNow(tx, testNow);
    const [candidate] = await tx
      .select()
      .from(operationalAlertIssueProjections)
      .where(
        and(
          eq(operationalAlertIssueProjections.repository, repository),
          eq(operationalAlertIssueProjections.status, "pending"),
          lte(operationalAlertIssueProjections.availableAt, authorityNow),
          sql`${operationalAlertIssueProjections.attemptCount} < ${operationalAlertIssueProjections.maxAttempts}`,
        ),
      )
      .orderBy(
        asc(operationalAlertIssueProjections.availableAt),
        asc(operationalAlertIssueProjections.createdAt),
      )
      .limit(1)
      .for("update", { skipLocked: true });
    if (!candidate) return null;
    const leaseToken = crypto.randomUUID();
    const next: ProjectionRow = {
      ...candidate,
      status: "delivering",
      attemptCount: candidate.attemptCount + 1,
      leaseOwner: workerId,
      leaseToken,
      leaseExpiresAt: new Date(
        authorityNow.getTime() + ISSUE_PROJECTION_LEASE_SECONDS * 1_000,
      ),
      lastError: null,
      updatedAt: authorityNow,
    };
    const [claimed] = await tx
      .update(operationalAlertIssueProjections)
      .set(next)
      .where(
        and(
          eq(operationalAlertIssueProjections.id, candidate.id),
          eq(operationalAlertIssueProjections.status, "pending"),
          eq(
            operationalAlertIssueProjections.attemptCount,
            candidate.attemptCount,
          ),
        ),
      )
      .returning();
    return claimed ?? null;
  });
};

const assertFreshLease = ({
  row,
  workerId,
  leaseToken,
  now,
}: {
  row: ProjectionRow | undefined;
  workerId: string;
  leaseToken: string;
  now: Date;
}): ProjectionRow => {
  if (
    !row ||
    row.status !== "delivering" ||
    row.leaseOwner !== workerId ||
    row.leaseToken !== leaseToken ||
    !row.leaseExpiresAt ||
    row.leaseExpiresAt <= now
  ) {
    throw new OperationalAlertIssueProjectionLeaseError(
      "The alert issue projection lease is stale, expired, or owned by another worker.",
    );
  }
  return row;
};

export const completeOperationalAlertIssueProjection = async ({
  database = db,
  projectionId,
  workerId,
  leaseToken,
  result,
  now: testNow,
}: {
  database?: OperationalAlertIssueProjectionDatabase;
  projectionId: string;
  workerId: string;
  leaseToken: string;
  result: GitHubAlertIssueProjectionResult;
  now?: Date;
}): Promise<OperationalAlertIssueProjectionV1> =>
  database.transaction(async (tx) => {
    const [current] = await tx
      .select()
      .from(operationalAlertIssueProjections)
      .where(eq(operationalAlertIssueProjections.id, projectionId))
      .for("update");
    const authorityNow = await resolveDatabaseAuthorityNow(tx, testNow);
    const row = assertFreshLease({
      row: current,
      workerId,
      leaseToken,
      now: authorityNow,
    });
    const next: ProjectionRow = {
      ...row,
      projectedAlertRevision: row.targetAlertRevision,
      status: "delivered",
      leaseOwner: null,
      leaseToken: null,
      leaseExpiresAt: null,
      issueNumber: result.issue.number,
      issueUrl: result.issue.url,
      issueState: result.issue.state,
      managedBodyHash: result.managedBodyHash,
      projectedAt: authorityNow,
      lastError: null,
      updatedAt: authorityNow,
    };
    const [updated] = await tx
      .update(operationalAlertIssueProjections)
      .set(next)
      .where(
        and(
          eq(operationalAlertIssueProjections.id, row.id),
          eq(operationalAlertIssueProjections.status, "delivering"),
          eq(operationalAlertIssueProjections.leaseToken, leaseToken),
          eq(
            operationalAlertIssueProjections.targetAlertRevision,
            row.targetAlertRevision,
          ),
        ),
      )
      .returning();
    if (!updated) {
      throw new OperationalAlertIssueProjectionLeaseError(
        "Alert issue projection completion lost its lease fence.",
      );
    }
    return serializeProjection(updated);
  });

export const failOperationalAlertIssueProjection = async ({
  database = db,
  projectionId,
  workerId,
  leaseToken,
  failure: rawFailure,
  now: testNow,
}: {
  database?: OperationalAlertIssueProjectionDatabase;
  projectionId: string;
  workerId: string;
  leaseToken: string;
  failure: OperationalFailureV1;
  now?: Date;
}): Promise<OperationalAlertIssueProjectionV1> => {
  const failure = operationalFailureSchemaV1.parse(rawFailure);
  return database.transaction(async (tx) => {
    const [current] = await tx
      .select()
      .from(operationalAlertIssueProjections)
      .where(eq(operationalAlertIssueProjections.id, projectionId))
      .for("update");
    const authorityNow = await resolveDatabaseAuthorityNow(tx, testNow);
    const row = assertFreshLease({
      row: current,
      workerId,
      leaseToken,
      now: authorityNow,
    });
    const deadLetter =
      row.attemptCount >= row.maxAttempts || !failure.retryable;
    const retrySeconds = Math.min(
      ISSUE_PROJECTION_RETRY_MAX_SECONDS,
      2 ** Math.max(0, row.attemptCount - 1),
    );
    const next: ProjectionRow = {
      ...row,
      status: deadLetter ? "dead_letter" : "pending",
      availableAt: deadLetter
        ? row.availableAt
        : new Date(authorityNow.getTime() + retrySeconds * 1_000),
      leaseOwner: null,
      leaseToken: null,
      leaseExpiresAt: null,
      lastError: failure,
      updatedAt: authorityNow,
    };
    const [updated] = await tx
      .update(operationalAlertIssueProjections)
      .set(next)
      .where(
        and(
          eq(operationalAlertIssueProjections.id, row.id),
          eq(operationalAlertIssueProjections.status, "delivering"),
          eq(operationalAlertIssueProjections.leaseToken, leaseToken),
        ),
      )
      .returning();
    if (!updated) {
      throw new OperationalAlertIssueProjectionLeaseError(
        "Alert issue projection failure update lost its lease fence.",
      );
    }
    return serializeProjection(updated);
  });
};

export const repairExpiredOperationalAlertIssueProjections = async ({
  database = db,
  repository: rawRepository,
  limit = 100,
  now: testNow,
}: {
  database?: OperationalAlertIssueProjectionDatabase;
  repository?: string;
  limit?: number;
  now?: Date;
} = {}): Promise<OperationalAlertIssueProjectionV1[]> => {
  const repository = rawRepository
    ? normalizeRepository(rawRepository)
    : undefined;
  if (!Number.isInteger(limit) || limit < 1 || limit > 500) {
    throw new OperationalAlertIssueProjectionConflictError(
      "Repair limit must be between 1 and 500.",
    );
  }
  return database.transaction(async (tx) => {
    const authorityNow = await resolveDatabaseAuthorityNow(tx, testNow);
    const rows = await tx
      .select()
      .from(operationalAlertIssueProjections)
      .where(
        and(
          repository
            ? eq(operationalAlertIssueProjections.repository, repository)
            : undefined,
          eq(operationalAlertIssueProjections.status, "delivering"),
          lt(operationalAlertIssueProjections.leaseExpiresAt, authorityNow),
        ),
      )
      .orderBy(asc(operationalAlertIssueProjections.leaseExpiresAt))
      .limit(limit)
      .for("update", { skipLocked: true });
    const repaired: OperationalAlertIssueProjectionV1[] = [];
    for (const row of rows) {
      const deadLetter = row.attemptCount >= row.maxAttempts;
      const failure = createStructuredOperationalFailure({
        code: "github_issue_projection.lease_expired",
        failureClass: "timeout",
        summary:
          "The GitHub issue projection lease expired before completion.",
        retryable: !deadLetter,
      });
      const next: ProjectionRow = {
        ...row,
        status: deadLetter ? "dead_letter" : "pending",
        availableAt: authorityNow,
        leaseOwner: null,
        leaseToken: null,
        leaseExpiresAt: null,
        lastError: failure,
        updatedAt: authorityNow,
      };
      const [updated] = await tx
        .update(operationalAlertIssueProjections)
        .set(next)
        .where(
          and(
            eq(operationalAlertIssueProjections.id, row.id),
            eq(operationalAlertIssueProjections.status, "delivering"),
            eq(operationalAlertIssueProjections.leaseToken, row.leaseToken!),
          ),
        )
        .returning();
      if (updated) repaired.push(serializeProjection(updated));
    }
    return repaired;
  });
};

export const runOperationalAlertIssueProjectionCycle = async ({
  database = db,
  repository,
  workerId,
  projector,
}: {
  database?: OperationalAlertIssueProjectionDatabase;
  repository: string;
  workerId: string;
  projector: GitHubAlertIssueProjector;
}) => {
  await synchronizeNextOperationalAlertIssueProjection({
    database,
    repository,
  });
  const claimed = await claimOperationalAlertIssueProjection({
    database,
    repository,
    workerId,
  });
  if (!claimed) return { status: "idle" as const };
  try {
    const result = await projector({
      alert: operationalAlertSchemaV1.parse(claimed.targetAlert),
      knownIssueNumber: claimed.issueNumber,
    });
    return {
      status: result.action,
      projection: await completeOperationalAlertIssueProjection({
        database,
        projectionId: claimed.id,
        workerId,
        leaseToken: claimed.leaseToken!,
        result,
      }),
    };
  } catch (error) {
    if (error instanceof OperationalAlertIssueProjectionLeaseError) {
      return { status: "lease_lost" as const, projectionId: claimed.id };
    }
    const failure =
      error instanceof GitHubAlertIssueAdapterError
        ? createStructuredOperationalFailure({
            code: error.code,
            failureClass:
              error.code === "github.issue_identity_conflict" ||
              error.code === "github.managed_block_invalid"
                ? "conflict"
                : error.code === "github.app_identity_invalid" ||
                    error.code === "github.http_401" ||
                    error.code === "github.http_403"
                  ? "authorization"
                  : "dependency",
            summary: "The GitHub alert issue projection could not be applied.",
            retryable: error.retryable,
          })
        : normalizeUnknownOperationalFailure({
            error,
            code: "github_issue_projection.failed",
            summary:
              "The GitHub alert issue projection failed unexpectedly.",
            retryable: true,
          });
    const projection = await failOperationalAlertIssueProjection({
      database,
      projectionId: claimed.id,
      workerId,
      leaseToken: claimed.leaseToken!,
      failure,
    });
    return {
      status:
        projection.status === "dead_letter"
          ? ("dead_lettered" as const)
          : ("retried" as const),
      projection,
    };
  }
};

export const getOperationalAlertIssueProjectionStatus = async ({
  database = db,
  repository: rawRepository,
}: {
  database?: OperationalAlertIssueProjectionDatabase;
  repository?: string;
} = {}) => {
  const repository = rawRepository
    ? normalizeRepository(rawRepository)
    : undefined;
  const condition = repository
    ? eq(operationalAlertIssueProjections.repository, repository)
    : undefined;
  const [counts, oldestPending] = await Promise.all([
    database
      .select({
        status: operationalAlertIssueProjections.status,
        total: count(),
      })
      .from(operationalAlertIssueProjections)
      .where(condition)
      .groupBy(operationalAlertIssueProjections.status),
    database.query.operationalAlertIssueProjections.findFirst({
      where: (table, { and, eq }) =>
        and(
          repository ? eq(table.repository, repository) : undefined,
          eq(table.status, "pending"),
        ),
      orderBy: (table, { asc }) => [
        asc(table.availableAt),
        asc(table.createdAt),
      ],
    }),
  ]);
  return {
    repository: repository ?? null,
    counts: {
      pending: 0,
      delivering: 0,
      delivered: 0,
      dead_letter: 0,
      ...Object.fromEntries(counts.map((row) => [row.status, row.total])),
    },
    oldestPending: oldestPending ? serializeProjection(oldestPending) : null,
  };
};

export const listOperationalAlertIssueProjections = async ({
  database = db,
  repository: rawRepository,
  status,
  limit = 100,
}: {
  database?: OperationalAlertIssueProjectionDatabase;
  repository?: string;
  status?: "pending" | "delivering" | "delivered" | "dead_letter";
  limit?: number;
} = {}): Promise<OperationalAlertIssueProjectionV1[]> => {
  const repository = rawRepository
    ? normalizeRepository(rawRepository)
    : undefined;
  if (!Number.isInteger(limit) || limit < 1 || limit > 500) {
    throw new OperationalAlertIssueProjectionConflictError(
      "List limit must be between 1 and 500.",
    );
  }
  const rows = await database
    .select()
    .from(operationalAlertIssueProjections)
    .where(
      and(
        repository
          ? eq(operationalAlertIssueProjections.repository, repository)
          : undefined,
        status
          ? eq(operationalAlertIssueProjections.status, status)
          : undefined,
      ),
    )
    .orderBy(desc(operationalAlertIssueProjections.updatedAt))
    .limit(limit);
  return rows.map(serializeProjection);
};

export const inspectOperationalAlertIssueProjection = async ({
  database = db,
  repository: rawRepository,
  alertKey: rawAlertKey,
}: {
  database?: OperationalAlertIssueProjectionDatabase;
  repository: string;
  alertKey: string;
}): Promise<OperationalAlertIssueProjectionV1 | null> => {
  const repository = normalizeRepository(rawRepository);
  const alertKey = normalizeRequiredText(rawAlertKey, "Alert key");
  const row = await database.query.operationalAlertIssueProjections.findFirst({
    where: (table, { and, eq }) =>
      and(eq(table.repository, repository), eq(table.alertKey, alertKey)),
  });
  return row ? serializeProjection(row) : null;
};

export const requeueOperationalAlertIssueProjection = async ({
  database = db,
  repository: rawRepository,
  alertKey: rawAlertKey,
  actor: rawActor,
  reason: rawReason,
  idempotencyKey: rawIdempotencyKey,
  maxAttempts = DEFAULT_OPERATIONAL_ALERT_ISSUE_MAX_ATTEMPTS,
  now: testNow,
}: {
  database?: OperationalAlertIssueProjectionDatabase;
  repository: string;
  alertKey: string;
  actor: string;
  reason: string;
  idempotencyKey: string;
  maxAttempts?: number;
  now?: Date;
}) => {
  const repository = normalizeRepository(rawRepository);
  const alertKey = normalizeRequiredText(rawAlertKey, "Alert key");
  const actor = normalizeRequiredText(rawActor, "Actor");
  const reason = normalizeRequiredText(rawReason, "Reason");
  const idempotencyKey = normalizeRequiredText(
    rawIdempotencyKey,
    "Idempotency key",
  );
  if (reason.length > 500) {
    throw new OperationalAlertIssueProjectionConflictError(
      "Reason must contain at most 500 characters.",
    );
  }
  if (!Number.isInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > 20) {
    throw new OperationalAlertIssueProjectionConflictError(
      "maxAttempts must be between 1 and 20.",
    );
  }
  const eventId = `alert-issue-requeue:${createOperationsDocumentDigest(idempotencyKey)}`;
  return database.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtext(${`airjam:alert-issue-requeue:${idempotencyKey}`}))`,
    );
    const existingEvent = await tx.query.operationalEventOutbox.findFirst({
      where: (table, { eq }) => eq(table.id, eventId),
    });
    if (existingEvent) {
      const payload = existingEvent.envelope.payload;
      if (
        payload.repository !== repository ||
        payload.alertKey !== alertKey ||
        payload.maxAttempts !== maxAttempts ||
        payload.reason !== reason ||
        existingEvent.envelope.actor?.id !== actor
      ) {
        throw new OperationalAlertIssueProjectionConflictError(
          "The idempotency key was already used for a different issue projection requeue.",
        );
      }
      const current = await tx.query.operationalAlertIssueProjections.findFirst({
        where: (table, { and, eq }) =>
          and(eq(table.repository, repository), eq(table.alertKey, alertKey)),
      });
      return {
        replayed: true,
        auditEventId: eventId,
        projection: current ? serializeProjection(current) : null,
      };
    }
    const [current] = await tx
      .select()
      .from(operationalAlertIssueProjections)
      .where(
        and(
          eq(operationalAlertIssueProjections.repository, repository),
          eq(operationalAlertIssueProjections.alertKey, alertKey),
        ),
      )
      .for("update");
    if (!current) {
      throw new OperationalAlertIssueProjectionConflictError(
        "Alert issue projection was not found.",
      );
    }
    if (current.status !== "dead_letter") {
      throw new OperationalAlertIssueProjectionConflictError(
        "Only a dead-lettered alert issue projection can be requeued.",
      );
    }
    const authorityNow = await resolveDatabaseAuthorityNow(tx, testNow);
    const next: ProjectionRow = {
      ...current,
      status: "pending",
      attemptCount: 0,
      maxAttempts,
      availableAt: authorityNow,
      leaseOwner: null,
      leaseToken: null,
      leaseExpiresAt: null,
      lastError: null,
      updatedAt: authorityNow,
    };
    const [updated] = await tx
      .update(operationalAlertIssueProjections)
      .set(next)
      .where(
        and(
          eq(operationalAlertIssueProjections.id, current.id),
          eq(operationalAlertIssueProjections.status, "dead_letter"),
          eq(
            operationalAlertIssueProjections.attemptCount,
            current.attemptCount,
          ),
        ),
      )
      .returning();
    if (!updated) {
      throw new OperationalAlertIssueProjectionConflictError(
        "Dead-letter issue projection requeue lost its state fence.",
      );
    }
    await enqueueOperationalEventInTransaction({
      tx,
      now: authorityNow,
      event: {
        contractVersion: 1,
        plane: "lifecycle_runtime",
        eventId,
        kind: "github_issue_projection.requeued",
        severity: "warning",
        outcome: "succeeded",
        authority: "airjam_authoritative",
        source: {
          service: "operational_worker",
          component: "github-alert-issue-projection",
          environment: updated.targetAlert.environment,
        },
        subject: { type: "provider_operation", id: updated.id },
        actor: { type: "agent", id: actor },
        correlation: {
          contractVersion: 1,
          correlationId: `alert-issue-requeue:${updated.id}`,
          causationEventId: updated.targetAlert.latestEventId,
        },
        occurredAt: authorityNow.toISOString(),
        observedAt: authorityNow.toISOString(),
        payload: {
          repository,
          alertKey,
          maxAttempts,
          reason,
        },
        evidence: [
          {
            kind: "command",
            reference: `alert-issue-requeue:${idempotencyKey}`,
            collectedAt: authorityNow.toISOString(),
          },
        ],
      },
    });
    return {
      replayed: false,
      auditEventId: eventId,
      projection: serializeProjection(updated),
    };
  });
};

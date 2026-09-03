import { db } from "@/db";
import {
  operationalEventDeliveryCommands,
  operationalEventOutbox,
  operationalEvents,
} from "@/db/schema";
import {
  DEFAULT_OPERATIONAL_EVENT_DELIVERY_MAX_ATTEMPTS,
  areOperationalEventEnvelopesIdempotentlyEquivalent,
  createOperationsDocumentDigest,
  createStructuredOperationalFailure,
  normalizeUnknownOperationalFailure,
  operationalEventEnvelopeSchemaV1,
  operationalFailureSchemaV1,
  type OperationalEventEnvelopeV1,
  type OperationalFailureV1,
} from "@air-jam/operations-contract";
import { and, asc, count, eq, lt, lte, sql } from "drizzle-orm";
import { resolveDatabaseAuthorityNow } from "./database-authority";

export type OperationalEventDatabase = typeof db;
export type OperationalEventTransaction = Parameters<
  Parameters<OperationalEventDatabase["transaction"]>[0]
>[0];
type OutboxRow = typeof operationalEventOutbox.$inferSelect;

const DELIVERY_LEASE_SECONDS = 30;
const DELIVERY_RETRY_MAX_SECONDS = 300;

export class OperationalEventConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OperationalEventConflictError";
  }
}

export class OperationalEventLeaseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OperationalEventLeaseError";
  }
}

const normalizeRequiredText = (value: string, label: string): string => {
  const normalized = value.trim();
  if (!normalized)
    throw new OperationalEventConflictError(`${label} is required.`);
  return normalized;
};

const serializeOutbox = (row: OutboxRow) => ({
  id: row.id,
  contractVersion: row.contractVersion,
  status: row.status,
  attemptCount: row.attemptCount,
  maxAttempts: row.maxAttempts,
  availableAt: row.availableAt.toISOString(),
  leaseOwner: row.leaseOwner,
  leaseExpiresAt: row.leaseExpiresAt?.toISOString() ?? null,
  deliveredAt: row.deliveredAt?.toISOString() ?? null,
  lastErrorCode: row.lastError?.code ?? null,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
  event: {
    kind: row.envelope.kind,
    severity: row.envelope.severity,
    outcome: row.envelope.outcome,
    authority: row.envelope.authority,
    source: row.envelope.source,
    subject: row.envelope.subject,
    correlation: row.envelope.correlation,
    occurredAt: row.envelope.occurredAt,
    observedAt: row.envelope.observedAt,
    payloadKeys: Object.keys(row.envelope.payload).sort(),
    evidenceCount: row.envelope.evidence.length,
  },
});

export const enqueueOperationalEventInTransaction = async ({
  tx,
  event: rawEvent,
  maxAttempts = DEFAULT_OPERATIONAL_EVENT_DELIVERY_MAX_ATTEMPTS,
  now,
}: {
  tx: OperationalEventTransaction;
  event: OperationalEventEnvelopeV1;
  maxAttempts?: number;
  now?: Date;
}): Promise<OutboxRow> => {
  const event = operationalEventEnvelopeSchemaV1.parse(rawEvent);
  if (!Number.isInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > 20) {
    throw new OperationalEventConflictError(
      "maxAttempts must be between 1 and 20.",
    );
  }
  const persistedAt = now ?? new Date(event.observedAt);
  const [inserted] = await tx
    .insert(operationalEventOutbox)
    .values({
      id: event.eventId,
      contractVersion: event.contractVersion,
      envelope: event,
      maxAttempts,
      availableAt: persistedAt,
      createdAt: persistedAt,
      updatedAt: persistedAt,
    })
    .onConflictDoNothing({ target: operationalEventOutbox.id })
    .returning();
  if (inserted) return inserted;

  const existing = await tx.query.operationalEventOutbox.findFirst({
    where: (table, { eq }) => eq(table.id, event.eventId),
  });
  if (
    !existing ||
    existing.maxAttempts !== maxAttempts ||
    !areOperationalEventEnvelopesIdempotentlyEquivalent(
      existing.envelope,
      event,
    )
  ) {
    throw new OperationalEventConflictError(
      "The operational event ID was already used for a different envelope.",
    );
  }
  return existing;
};

export const enqueueOperationalEvent = async ({
  database = db,
  event,
  maxAttempts,
  now,
}: {
  database?: OperationalEventDatabase;
  event: OperationalEventEnvelopeV1;
  maxAttempts?: number;
  now?: Date;
}): Promise<ReturnType<typeof serializeOutbox>> =>
  database.transaction(async (tx) =>
    serializeOutbox(
      await enqueueOperationalEventInTransaction({
        tx,
        event,
        maxAttempts,
        now,
      }),
    ),
  );

export const claimOperationalEventDelivery = async ({
  database = db,
  workerId: rawWorkerId,
  now: testNow,
}: {
  database?: OperationalEventDatabase;
  workerId: string;
  now?: Date;
}): Promise<OutboxRow | null> => {
  const workerId = normalizeRequiredText(rawWorkerId, "Worker ID");
  return database.transaction(async (tx) => {
    const authorityNow = await resolveDatabaseAuthorityNow(tx, testNow);
    const [candidate] = await tx
      .select()
      .from(operationalEventOutbox)
      .where(
        and(
          eq(operationalEventOutbox.status, "pending"),
          lte(operationalEventOutbox.availableAt, authorityNow),
          sql`${operationalEventOutbox.attemptCount} < ${operationalEventOutbox.maxAttempts}`,
        ),
      )
      .orderBy(
        asc(operationalEventOutbox.availableAt),
        asc(operationalEventOutbox.createdAt),
      )
      .limit(1)
      .for("update", { skipLocked: true });
    if (!candidate) return null;
    const leaseToken = crypto.randomUUID();
    const leaseExpiresAt = new Date(
      authorityNow.getTime() + DELIVERY_LEASE_SECONDS * 1_000,
    );
    const [claimed] = await tx
      .update(operationalEventOutbox)
      .set({
        status: "delivering",
        attemptCount: candidate.attemptCount + 1,
        leaseOwner: workerId,
        leaseToken,
        leaseExpiresAt,
        lastError: null,
        updatedAt: authorityNow,
      })
      .where(
        and(
          eq(operationalEventOutbox.id, candidate.id),
          eq(operationalEventOutbox.status, "pending"),
          eq(operationalEventOutbox.attemptCount, candidate.attemptCount),
        ),
      )
      .returning();
    return claimed ?? null;
  });
};

const assertFreshDeliveryLease = ({
  row,
  leaseToken,
  workerId,
  now,
}: {
  row: OutboxRow | undefined;
  leaseToken: string;
  workerId: string;
  now: Date;
}): OutboxRow => {
  if (
    !row ||
    row.status !== "delivering" ||
    row.leaseToken !== leaseToken ||
    row.leaseOwner !== workerId ||
    !row.leaseExpiresAt ||
    row.leaseExpiresAt <= now
  ) {
    throw new OperationalEventLeaseError(
      "Operational event delivery lease is stale, expired, or owned by another worker.",
    );
  }
  return row;
};

export const completeOperationalEventDelivery = async ({
  database = db,
  eventId,
  leaseToken,
  workerId: rawWorkerId,
  now: testNow,
}: {
  database?: OperationalEventDatabase;
  eventId: string;
  leaseToken: string;
  workerId: string;
  now?: Date;
}): Promise<ReturnType<typeof serializeOutbox>> => {
  const workerId = normalizeRequiredText(rawWorkerId, "Worker ID");
  return database.transaction(async (tx) => {
    const [current] = await tx
      .select()
      .from(operationalEventOutbox)
      .where(eq(operationalEventOutbox.id, eventId))
      .for("update");
    const authorityNow = await resolveDatabaseAuthorityNow(tx, testNow);
    const row = assertFreshDeliveryLease({
      row: current,
      leaseToken,
      workerId,
      now: authorityNow,
    });
    const event = operationalEventEnvelopeSchemaV1.parse(row.envelope);
    await tx
      .insert(operationalEvents)
      .values({
        id: event.eventId,
        contractVersion: event.contractVersion,
        kind: event.kind,
        severity: event.severity,
        outcome: event.outcome,
        authority: event.authority,
        service: event.source.service,
        environment: event.source.environment,
        subjectType: event.subject.type,
        subjectId: event.subject.id,
        correlationId: event.correlation.correlationId,
        occurredAt: new Date(event.occurredAt),
        observedAt: new Date(event.observedAt),
        envelope: event,
        storedAt: authorityNow,
      })
      .onConflictDoNothing({ target: operationalEvents.id });
    const stored = await tx.query.operationalEvents.findFirst({
      where: (table, { eq }) => eq(table.id, event.eventId),
    });
    if (
      !stored ||
      !areOperationalEventEnvelopesIdempotentlyEquivalent(
        stored.envelope,
        event,
      )
    ) {
      throw new OperationalEventConflictError(
        "The event store already contains a different document for this event ID.",
      );
    }
    const [updated] = await tx
      .update(operationalEventOutbox)
      .set({
        status: "delivered",
        leaseOwner: null,
        leaseToken: null,
        leaseExpiresAt: null,
        deliveredAt: authorityNow,
        lastError: null,
        updatedAt: authorityNow,
      })
      .where(
        and(
          eq(operationalEventOutbox.id, row.id),
          eq(operationalEventOutbox.status, "delivering"),
          eq(operationalEventOutbox.leaseToken, leaseToken),
        ),
      )
      .returning();
    if (!updated)
      throw new OperationalEventLeaseError(
        "Delivery completion lost its lease fence.",
      );
    return serializeOutbox(updated);
  });
};

export const failOperationalEventDelivery = async ({
  database = db,
  eventId,
  leaseToken,
  workerId: rawWorkerId,
  failure: rawFailure,
  now: testNow,
}: {
  database?: OperationalEventDatabase;
  eventId: string;
  leaseToken: string;
  workerId: string;
  failure: OperationalFailureV1;
  now?: Date;
}): Promise<ReturnType<typeof serializeOutbox>> => {
  const workerId = normalizeRequiredText(rawWorkerId, "Worker ID");
  const failure = operationalFailureSchemaV1.parse(rawFailure);
  return database.transaction(async (tx) => {
    const [current] = await tx
      .select()
      .from(operationalEventOutbox)
      .where(eq(operationalEventOutbox.id, eventId))
      .for("update");
    const authorityNow = await resolveDatabaseAuthorityNow(tx, testNow);
    const row = assertFreshDeliveryLease({
      row: current,
      leaseToken,
      workerId,
      now: authorityNow,
    });
    const deadLetter =
      row.attemptCount >= row.maxAttempts || !failure.retryable;
    const retrySeconds = Math.min(
      DELIVERY_RETRY_MAX_SECONDS,
      2 ** Math.max(0, row.attemptCount - 1),
    );
    const [updated] = await tx
      .update(operationalEventOutbox)
      .set({
        status: deadLetter ? "dead_letter" : "pending",
        availableAt: deadLetter
          ? row.availableAt
          : new Date(authorityNow.getTime() + retrySeconds * 1_000),
        leaseOwner: null,
        leaseToken: null,
        leaseExpiresAt: null,
        lastError: failure,
        updatedAt: authorityNow,
      })
      .where(
        and(
          eq(operationalEventOutbox.id, row.id),
          eq(operationalEventOutbox.status, "delivering"),
          eq(operationalEventOutbox.leaseToken, leaseToken),
        ),
      )
      .returning();
    if (!updated)
      throw new OperationalEventLeaseError(
        "Delivery failure update lost its lease fence.",
      );
    return serializeOutbox(updated);
  });
};

export const repairExpiredOperationalEventDeliveries = async ({
  database = db,
  limit = 100,
  now: testNow,
}: {
  database?: OperationalEventDatabase;
  limit?: number;
  now?: Date;
} = {}) => {
  if (!Number.isInteger(limit) || limit < 1 || limit > 500) {
    throw new OperationalEventConflictError(
      "Repair limit must be between 1 and 500.",
    );
  }
  return database.transaction(async (tx) => {
    const authorityNow = await resolveDatabaseAuthorityNow(tx, testNow);
    const rows = await tx
      .select()
      .from(operationalEventOutbox)
      .where(
        and(
          eq(operationalEventOutbox.status, "delivering"),
          lt(operationalEventOutbox.leaseExpiresAt, authorityNow),
        ),
      )
      .orderBy(asc(operationalEventOutbox.leaseExpiresAt))
      .limit(limit)
      .for("update", { skipLocked: true });
    const repaired = [];
    for (const row of rows) {
      const deadLetter = row.attemptCount >= row.maxAttempts;
      const failure = createStructuredOperationalFailure({
        code: "delivery.lease_expired",
        failureClass: "timeout",
        summary:
          "The operational event delivery lease expired before completion.",
        retryable: !deadLetter,
      });
      const [updated] = await tx
        .update(operationalEventOutbox)
        .set({
          status: deadLetter ? "dead_letter" : "pending",
          availableAt: authorityNow,
          leaseOwner: null,
          leaseToken: null,
          leaseExpiresAt: null,
          lastError: failure,
          updatedAt: authorityNow,
        })
        .where(
          and(
            eq(operationalEventOutbox.id, row.id),
            eq(operationalEventOutbox.status, "delivering"),
            eq(operationalEventOutbox.leaseToken, row.leaseToken!),
          ),
        )
        .returning();
      if (updated) repaired.push(serializeOutbox(updated));
    }
    return repaired;
  });
};

const normalizeDeadLetterRequeueInput = ({
  eventId,
  actor,
  reason,
  idempotencyKey,
  maxAttempts,
}: {
  eventId: string;
  actor: string;
  reason: string;
  idempotencyKey: string;
  maxAttempts: number;
}) => {
  const normalized = {
    eventId: normalizeRequiredText(eventId, "Event ID"),
    actor: normalizeRequiredText(actor, "Actor"),
    reason: normalizeRequiredText(reason, "Reason"),
    idempotencyKey: normalizeRequiredText(idempotencyKey, "Idempotency key"),
    maxAttempts,
  };
  if (normalized.reason.length > 500) {
    throw new OperationalEventConflictError(
      "Reason must contain at most 500 characters.",
    );
  }
  if (
    !Number.isInteger(normalized.maxAttempts) ||
    normalized.maxAttempts < 1 ||
    normalized.maxAttempts > 20
  ) {
    throw new OperationalEventConflictError(
      "maxAttempts must be between 1 and 20.",
    );
  }
  const request = {
    eventId: normalized.eventId,
    maxAttempts: normalized.maxAttempts,
  };
  return {
    ...normalized,
    request,
    requestHash: createOperationsDocumentDigest(request),
  };
};

export const previewOperationalEventDeadLetterRequeue = async ({
  database = db,
  eventId,
  maxAttempts = DEFAULT_OPERATIONAL_EVENT_DELIVERY_MAX_ATTEMPTS,
}: {
  database?: OperationalEventDatabase;
  eventId: string;
  maxAttempts?: number;
}) => {
  const normalizedEventId = normalizeRequiredText(eventId, "Event ID");
  if (!Number.isInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > 20) {
    throw new OperationalEventConflictError(
      "maxAttempts must be between 1 and 20.",
    );
  }
  const row = await database.query.operationalEventOutbox.findFirst({
    where: (table, { eq }) => eq(table.id, normalizedEventId),
  });
  if (!row) {
    throw new OperationalEventConflictError("Operational event was not found.");
  }
  return {
    applied: false,
    operation: "requeue one dead-lettered operational event",
    eligible: row.status === "dead_letter",
    maxAttempts,
    event: serializeOutbox(row),
  };
};

export const requeueOperationalEventDeadLetter = async ({
  database = db,
  eventId,
  actor,
  reason,
  idempotencyKey,
  maxAttempts = DEFAULT_OPERATIONAL_EVENT_DELIVERY_MAX_ATTEMPTS,
  now: testNow,
}: {
  database?: OperationalEventDatabase;
  eventId: string;
  actor: string;
  reason: string;
  idempotencyKey: string;
  maxAttempts?: number;
  now?: Date;
}) => {
  const input = normalizeDeadLetterRequeueInput({
    eventId,
    actor,
    reason,
    idempotencyKey,
    maxAttempts,
  });
  return database.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtext(${`airjam:event-delivery-command:${input.idempotencyKey}`}))`,
    );
    const existing = await tx.query.operationalEventDeliveryCommands.findFirst({
      where: (table, { eq }) => eq(table.idempotencyKey, input.idempotencyKey),
    });
    if (existing) {
      if (
        existing.action !== "requeue_dead_letter" ||
        existing.requestHash !== input.requestHash ||
        !existing.result ||
        !existing.completedAt
      ) {
        throw new OperationalEventConflictError(
          "The idempotency key was already used for a different or incomplete delivery command.",
        );
      }
      return {
        replayed: true,
        commandId: existing.id,
        auditEventId:
          typeof existing.result.auditEventId === "string"
            ? existing.result.auditEventId
            : null,
        event: existing.result.event,
      };
    }

    const authorityNow = await resolveDatabaseAuthorityNow(tx, testNow);
    const [current] = await tx
      .select()
      .from(operationalEventOutbox)
      .where(eq(operationalEventOutbox.id, input.eventId))
      .for("update");
    if (!current) {
      throw new OperationalEventConflictError(
        "Operational event was not found.",
      );
    }
    if (current.status !== "dead_letter") {
      throw new OperationalEventConflictError(
        "Only a dead-lettered operational event can be requeued.",
      );
    }

    const commandId = crypto.randomUUID();
    await tx.insert(operationalEventDeliveryCommands).values({
      id: commandId,
      idempotencyKey: input.idempotencyKey,
      eventId: input.eventId,
      action: "requeue_dead_letter",
      requestHash: input.requestHash,
      actor: input.actor,
      reason: input.reason,
      request: input.request,
      createdAt: authorityNow,
    });
    const [requeued] = await tx
      .update(operationalEventOutbox)
      .set({
        status: "pending",
        attemptCount: 0,
        maxAttempts: input.maxAttempts,
        availableAt: authorityNow,
        leaseOwner: null,
        leaseToken: null,
        leaseExpiresAt: null,
        deliveredAt: null,
        lastError: null,
        updatedAt: authorityNow,
      })
      .where(
        and(
          eq(operationalEventOutbox.id, current.id),
          eq(operationalEventOutbox.status, "dead_letter"),
          eq(operationalEventOutbox.attemptCount, current.attemptCount),
        ),
      )
      .returning();
    if (!requeued) {
      throw new OperationalEventConflictError(
        "Dead-letter requeue lost its state fence.",
      );
    }
    const auditEventId = `delivery-command:${commandId}`;
    await enqueueOperationalEventInTransaction({
      tx,
      now: authorityNow,
      event: {
        contractVersion: 1,
        plane: "lifecycle_runtime",
        eventId: auditEventId,
        kind: "operational_event.delivery_requeued",
        severity: "warning",
        outcome: "succeeded",
        authority: "airjam_authoritative",
        source: {
          service: "operational_worker",
          component: "event-delivery-command",
          environment: current.envelope.source.environment,
        },
        subject: { type: "service", id: "operational_worker" },
        actor: { type: "agent", id: input.actor },
        correlation: {
          contractVersion: 1,
          correlationId: `delivery-requeue:${commandId}`,
          causationEventId: current.id,
        },
        occurredAt: authorityNow.toISOString(),
        observedAt: authorityNow.toISOString(),
        payload: {
          commandId,
          targetEventId: current.id,
          previousAttemptCount: current.attemptCount,
          previousMaxAttempts: current.maxAttempts,
          maxAttempts: input.maxAttempts,
          reason: input.reason,
        },
        evidence: [
          {
            kind: "command",
            reference: `operational-event-delivery-command:${commandId}`,
            collectedAt: authorityNow.toISOString(),
          },
        ],
      },
    });
    const event = serializeOutbox(requeued);
    const result = { event, auditEventId };
    const [completed] = await tx
      .update(operationalEventDeliveryCommands)
      .set({ result, completedAt: authorityNow })
      .where(
        and(
          eq(operationalEventDeliveryCommands.id, commandId),
          sql`${operationalEventDeliveryCommands.result} is null`,
        ),
      )
      .returning({ id: operationalEventDeliveryCommands.id });
    if (!completed) {
      throw new OperationalEventConflictError(
        "Delivery command completion lost its fence.",
      );
    }
    return { replayed: false, commandId, auditEventId, event };
  });
};

export const runOperationalEventDeliveryCycle = async ({
  database = db,
  workerId,
}: {
  database?: OperationalEventDatabase;
  workerId: string;
}) => {
  const claimed = await claimOperationalEventDelivery({ database, workerId });
  if (!claimed) return { status: "idle" as const };
  try {
    const event = await completeOperationalEventDelivery({
      database,
      eventId: claimed.id,
      leaseToken: claimed.leaseToken!,
      workerId,
    });
    return { status: "delivered" as const, event };
  } catch (error) {
    if (error instanceof OperationalEventLeaseError) {
      return { status: "lease_lost" as const, eventId: claimed.id };
    }
    const failure = normalizeUnknownOperationalFailure({
      error,
      code: "delivery.event_store_failed",
      summary:
        "The operational event could not be committed to the event store.",
      retryable: true,
    });
    const event = await failOperationalEventDelivery({
      database,
      eventId: claimed.id,
      leaseToken: claimed.leaseToken!,
      workerId,
      failure,
    });
    return {
      status:
        event.status === "dead_letter"
          ? ("dead_lettered" as const)
          : ("retried" as const),
      event,
    };
  }
};

export const getOperationalEventDeliveryStatus = async ({
  database = db,
}: {
  database?: OperationalEventDatabase;
} = {}) => {
  const [counts, oldestPending] = await Promise.all([
    database
      .select({ status: operationalEventOutbox.status, total: count() })
      .from(operationalEventOutbox)
      .groupBy(operationalEventOutbox.status),
    database.query.operationalEventOutbox.findFirst({
      where: (table, { eq }) => eq(table.status, "pending"),
      orderBy: (table, { asc }) => [
        asc(table.availableAt),
        asc(table.createdAt),
      ],
    }),
  ]);
  const totals = Object.fromEntries(
    ["pending", "delivering", "delivered", "dead_letter"].map((status) => [
      status,
      Number(counts.find((row) => row.status === status)?.total ?? 0),
    ]),
  );
  return {
    contractVersion: 1 as const,
    totals,
    oldestPendingAt: oldestPending?.createdAt.toISOString() ?? null,
  };
};

export const listOperationalEventDeliveries = async ({
  database = db,
  status,
  limit = 100,
}: {
  database?: OperationalEventDatabase;
  status?: OutboxRow["status"];
  limit?: number;
} = {}) => {
  if (!Number.isInteger(limit) || limit < 1 || limit > 500) {
    throw new OperationalEventConflictError(
      "List limit must be between 1 and 500.",
    );
  }
  const rows = await database
    .select()
    .from(operationalEventOutbox)
    .where(status ? eq(operationalEventOutbox.status, status) : undefined)
    .orderBy(asc(operationalEventOutbox.createdAt))
    .limit(limit);
  return rows.map(serializeOutbox);
};

export const inspectOperationalEventDelivery = async ({
  database = db,
  eventId,
}: {
  database?: OperationalEventDatabase;
  eventId: string;
}) => {
  const row = await database.query.operationalEventOutbox.findFirst({
    where: (table, { eq }) => eq(table.id, eventId),
  });
  if (!row)
    throw new OperationalEventConflictError("Operational event was not found.");
  return serializeOutbox(row);
};

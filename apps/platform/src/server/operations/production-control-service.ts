import { db } from "@/db";
import {
  operationalBudgetCycles,
  operationalBudgetEvidence,
  operationalControlEvents,
  operationalLaneControls,
} from "@/db/schema";
import {
  decideOperationalAdmissionPolicy,
  getDefaultOperationalLaneControl,
  operationalLaneValues,
  readOperationalAuthoritySnapshot,
  readOperationalLaneControl,
  serializeOperationalLaneControl,
  type OperationalLane,
  type OperationalLaneControlSnapshot,
  type OperationalLaneMode,
} from "@air-jam/database-contract";
import { resolveOperationalBudgetRequirement } from "@air-jam/operations-contract";
import { and, eq } from "drizzle-orm";
import { acquireOperationalLaneLock } from "./operational-lane-lock";

export const PRODUCTION_CONTROL_CONTRACT_VERSION = 1 as const;

/** Budget protection and emergency pauses must preserve diagnosis and recovery. */
export const OPERATIONAL_RECOVERY_LANES: readonly OperationalLane[] =
  Object.freeze(["product_telemetry", "lifecycle_cleanup"]);

export type OperationalAdmissionDecision = {
  contractVersion: typeof PRODUCTION_CONTROL_CONTRACT_VERSION;
  decisionId: string;
  lane: OperationalLane;
  controlStatus: "available" | "unavailable";
  mode: OperationalLaneMode | null;
  outcome: "allowed" | "shadow_denied" | "denied";
  reason: ReturnType<typeof decideOperationalAdmissionPolicy>["reason"];
  retryAfterSeconds: number | null;
  controlRevision: number | null;
};

export type SetOperationalLaneControlInput = {
  lane: OperationalLane;
  mode: OperationalLaneMode;
  reason: string;
  retryAfterSeconds: number | null;
  expectedRevision: number;
  actor: string;
  idempotencyKey: string;
};

export class OperationalControlConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OperationalControlConflictError";
  }
}

export class OperationalAdmissionDeniedError extends Error {
  readonly decision: OperationalAdmissionDecision;

  constructor(decision: OperationalAdmissionDecision, options?: ErrorOptions) {
    const summary =
      decision.reason === "control_unavailable"
        ? `Production control for lane ${decision.lane} is unavailable.`
        : decision.reason === "budget_protection"
          ? `Production lane ${decision.lane} is temporarily blocked by budget protection.`
          : decision.reason === "lane_paused"
            ? `Production lane ${decision.lane} is paused.`
            : `Production admission for lane ${decision.lane} is blocked.`;
    super(
      `${summary}${
        decision.retryAfterSeconds
          ? ` Retry after ${decision.retryAfterSeconds} seconds.`
          : ""
      }`,
      options,
    );
    this.name = "OperationalAdmissionDeniedError";
    this.decision = decision;
  }
}

const normalizeRequiredText = (value: string, label: string): string => {
  const normalized = value.trim();
  if (!normalized) {
    throw new OperationalControlConflictError(`${label} is required.`);
  }
  return normalized;
};

export { getDefaultOperationalLaneControl };

export const buildOperationalLaneControlList = (
  rows: (typeof operationalLaneControls.$inferSelect)[],
): OperationalLaneControlSnapshot[] => {
  const rowsByLane = new Map(rows.map((row) => [row.lane, row]));
  return operationalLaneValues.map((lane) => {
    const row = rowsByLane.get(lane);
    return row
      ? serializeOperationalLaneControl(row)
      : getDefaultOperationalLaneControl(lane);
  });
};

export const listOperationalLaneControls = async ({
  database = db,
}: {
  database?: Pick<typeof db, "select">;
} = {}): Promise<OperationalLaneControlSnapshot[]> => {
  const rows = await database.select().from(operationalLaneControls);
  return buildOperationalLaneControlList(rows);
};

export const getOperationalLaneControl = async ({
  database = db,
  lane,
}: {
  database?: Pick<typeof db, "select">;
  lane: OperationalLane;
}): Promise<OperationalLaneControlSnapshot> =>
  readOperationalLaneControl({
    database,
    tables: { operationalLaneControls },
    lane,
  });

export const decideOperationalLaneAdmission = ({
  control,
  budget,
  budgetRequirement,
  decisionId = crypto.randomUUID(),
}: {
  control: OperationalLaneControlSnapshot;
  budget: Parameters<typeof decideOperationalAdmissionPolicy>[0]["budget"];
  budgetRequirement: Parameters<
    typeof decideOperationalAdmissionPolicy
  >[0]["budgetRequirement"];
  decisionId?: string;
}): OperationalAdmissionDecision => {
  const policy = decideOperationalAdmissionPolicy({
    lane: control.lane,
    control,
    budget,
    budgetRequirement,
  });
  return {
    contractVersion: PRODUCTION_CONTROL_CONTRACT_VERSION,
    decisionId,
    lane: control.lane,
    controlStatus: "available",
    mode: control.mode,
    outcome: policy.outcome,
    reason: policy.reason,
    retryAfterSeconds: policy.retryAfterSeconds,
    controlRevision: control.revision,
  };
};

const decideUnavailableOperationalLaneAdmission = ({
  lane,
  decisionId = crypto.randomUUID(),
}: {
  lane: OperationalLane;
  decisionId?: string;
}): OperationalAdmissionDecision => ({
  contractVersion: PRODUCTION_CONTROL_CONTRACT_VERSION,
  decisionId,
  lane,
  controlStatus: "unavailable",
  mode: null,
  outcome: "denied",
  reason: "control_unavailable",
  retryAfterSeconds: 30,
  controlRevision: null,
});

type OperationalAdmissionInput = {
  database?: Pick<typeof db, "select" | "execute">;
  lane: OperationalLane;
  decisionId?: string;
  /** Use the caller's transaction authority clock when one is already held. */
  asOf?: Date;
};

export const readOperationalLaneAdmission = async ({
  database = db,
  lane,
  decisionId,
  asOf,
}: OperationalAdmissionInput): Promise<OperationalAdmissionDecision> => {
  // Recovery and sensory lanes must not depend on the spending evidence they
  // help restore. Their explicit lane pause still applies.
  const budgetRequirement = OPERATIONAL_RECOVERY_LANES.includes(lane)
    ? "not_applicable"
    : resolveOperationalBudgetRequirement();
  const authority =
    budgetRequirement === "required"
      ? await readOperationalAuthoritySnapshot({
          database,
          tables: {
            operationalLaneControls,
            operationalBudgetCycles,
            operationalBudgetEvidence,
          },
          lane,
          asOf,
        })
      : {
          control: await getOperationalLaneControl({ database, lane }),
          budget: { evidenceStatus: "missing" as const, state: null },
        };
  return decideOperationalLaneAdmission({
    ...authority,
    budgetRequirement,
    decisionId,
  });
};

export const assertOperationalLaneAccepting = async (
  input: OperationalAdmissionInput,
): Promise<OperationalAdmissionDecision> => {
  let decision: OperationalAdmissionDecision;
  try {
    decision = await readOperationalLaneAdmission(input);
  } catch (cause) {
    throw new OperationalAdmissionDeniedError(
      decideUnavailableOperationalLaneAdmission(input),
      { cause },
    );
  }
  if (decision.outcome === "denied") {
    throw new OperationalAdmissionDeniedError(decision);
  }
  return decision;
};

const isMatchingMutation = (
  event: typeof operationalControlEvents.$inferSelect,
  input: SetOperationalLaneControlInput,
): boolean =>
  event.action === "set_lane_mode" &&
  event.lane === input.lane &&
  event.expectedRevision === input.expectedRevision &&
  event.actor === input.actor &&
  event.reason === input.reason &&
  event.next.mode === input.mode &&
  event.next.retryAfterSeconds === input.retryAfterSeconds;

const replayOperationalControlEvent = async ({
  database,
  input,
}: {
  database: Pick<typeof db, "query">;
  input: SetOperationalLaneControlInput;
}): Promise<OperationalLaneControlSnapshot | null> => {
  const event = await database.query.operationalControlEvents.findFirst({
    where: (table, { eq }) => eq(table.idempotencyKey, input.idempotencyKey),
  });
  if (!event) return null;
  if (!isMatchingMutation(event, input)) {
    throw new OperationalControlConflictError(
      "The idempotency key was already used for a different control mutation.",
    );
  }
  return event.next;
};

const normalizeOperationalLaneControlInput = (
  input: SetOperationalLaneControlInput,
): SetOperationalLaneControlInput => {
  const normalizedInput = {
    ...input,
    actor: normalizeRequiredText(input.actor, "Actor"),
    reason: normalizeRequiredText(input.reason, "Reason"),
    idempotencyKey: normalizeRequiredText(
      input.idempotencyKey,
      "Idempotency key",
    ),
  };
  if (normalizedInput.expectedRevision < 0) {
    throw new OperationalControlConflictError(
      "Expected revision must be zero or greater.",
    );
  }
  if (
    normalizedInput.retryAfterSeconds !== null &&
    normalizedInput.retryAfterSeconds <= 0
  ) {
    throw new OperationalControlConflictError(
      "Retry-after seconds must be positive when provided.",
    );
  }
  return normalizedInput;
};

type OperationalControlTransaction = Parameters<
  Parameters<typeof db.transaction>[0]
>[0];

export const setOperationalLaneControlInTransaction = async ({
  tx,
  input,
  now = new Date(),
  eventId = crypto.randomUUID(),
}: {
  tx: OperationalControlTransaction;
  input: SetOperationalLaneControlInput;
  now?: Date;
  eventId?: string;
}): Promise<OperationalLaneControlSnapshot> => {
  const normalizedInput = normalizeOperationalLaneControlInput(input);
  await acquireOperationalLaneLock(tx, normalizedInput.lane);
  const replay = await replayOperationalControlEvent({
    database: tx,
    input: normalizedInput,
  });
  if (replay) return replay;

  const currentRow = await tx.query.operationalLaneControls.findFirst({
    where: (table, { eq }) => eq(table.lane, normalizedInput.lane),
  });
  const previous = currentRow
    ? serializeOperationalLaneControl(currentRow)
    : getDefaultOperationalLaneControl(normalizedInput.lane);
  if (previous.revision !== normalizedInput.expectedRevision) {
    throw new OperationalControlConflictError(
      `Lane ${normalizedInput.lane} is at revision ${previous.revision}, not expected revision ${normalizedInput.expectedRevision}.`,
    );
  }

  const nextRevision = previous.revision + 1;
  const [updatedRow] = currentRow
    ? await tx
        .update(operationalLaneControls)
        .set({
          mode: normalizedInput.mode,
          reason: normalizedInput.reason,
          retryAfterSeconds: normalizedInput.retryAfterSeconds,
          revision: nextRevision,
          updatedBy: normalizedInput.actor,
          updatedAt: now,
        })
        .where(
          and(
            eq(operationalLaneControls.lane, normalizedInput.lane),
            eq(
              operationalLaneControls.revision,
              normalizedInput.expectedRevision,
            ),
          ),
        )
        .returning()
    : await tx
        .insert(operationalLaneControls)
        .values({
          lane: normalizedInput.lane,
          mode: normalizedInput.mode,
          reason: normalizedInput.reason,
          retryAfterSeconds: normalizedInput.retryAfterSeconds,
          revision: nextRevision,
          updatedBy: normalizedInput.actor,
          updatedAt: now,
        })
        .onConflictDoNothing()
        .returning();

  if (!updatedRow) {
    throw new OperationalControlConflictError(
      `Lane ${normalizedInput.lane} changed concurrently; inspect its current revision and retry.`,
    );
  }

  const next = serializeOperationalLaneControl(updatedRow);
  await tx.insert(operationalControlEvents).values({
    id: eventId,
    idempotencyKey: normalizedInput.idempotencyKey,
    action: "set_lane_mode",
    lane: normalizedInput.lane,
    expectedRevision: normalizedInput.expectedRevision,
    previous,
    next,
    actor: normalizedInput.actor,
    reason: normalizedInput.reason,
    createdAt: now,
  });

  return next;
};

export const setOperationalLaneControl = async ({
  database = db,
  input,
  now = new Date(),
  eventId = crypto.randomUUID(),
}: {
  database?: typeof db;
  input: SetOperationalLaneControlInput;
  now?: Date;
  eventId?: string;
}): Promise<OperationalLaneControlSnapshot> => {
  const normalizedInput = normalizeOperationalLaneControlInput(input);
  const replay = await replayOperationalControlEvent({
    database,
    input: normalizedInput,
  });
  if (replay) return replay;

  try {
    return await database.transaction((tx) =>
      setOperationalLaneControlInTransaction({
        tx,
        input: normalizedInput,
        now,
        eventId,
      }),
    );
  } catch (error) {
    const cause =
      error && typeof error === "object" && "cause" in error
        ? (error.cause as { code?: string; constraint_name?: string })
        : null;
    if (
      cause?.code === "23505" &&
      cause.constraint_name ===
        "operational_control_events_idempotency_key_uidx"
    ) {
      const concurrentReplay = await replayOperationalControlEvent({
        database,
        input: normalizedInput,
      });
      if (concurrentReplay) return concurrentReplay;
    }
    throw error;
  }
};

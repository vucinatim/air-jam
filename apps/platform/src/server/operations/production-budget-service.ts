import { db } from "@/db";
import {
  operationalBudgetCycles,
  operationalBudgetEvidence,
} from "@/db/schema";
import type {
  OperationalBudgetCycleSnapshot,
  OperationalBudgetEvidenceSnapshot,
} from "@air-jam/database-contract";
import {
  assertMatchingOperationalBudgetEvidence,
  assertOperationalBudgetCyclePolicy,
  buildOperationalBudgetCycleSnapshot,
  buildOperationalBudgetEvidenceSnapshot,
  buildOperationalBudgetStatus,
  normalizeOperationalBudgetEvidenceInput,
  normalizeOperationalBudgetRequiredText,
  OperationalBudgetConflictError,
  type OperationalBudgetEvidencePreview,
  type OperationalBudgetStatus,
  type RecordOperationalBudgetEvidenceInput,
  type ReplayOperationalBudgetEvidenceInput,
} from "./production-budget-policy";

export {
  AIR_JAM_1_0_LAUNCH_BUDGET_PERIOD_START,
  buildOperationalBudgetStatus,
  OPERATIONAL_BUDGET_POLICIES,
  OperationalBudgetConflictError,
  PRODUCTION_BUDGET_CONTRACT_VERSION,
  PRODUCTION_BUDGET_EVIDENCE_MAX_AGE_MS,
  PRODUCTION_BUDGET_MAX_FUTURE_SKEW_MS,
  resolveOperationalBudgetProfile,
  resolveOperationalBudgetState,
} from "./production-budget-policy";
export type {
  OperationalBudgetEvidencePreview,
  OperationalBudgetEvidenceStatus,
  OperationalBudgetStatus,
  RecordOperationalBudgetEvidenceInput,
  ReplayOperationalBudgetEvidenceInput,
} from "./production-budget-policy";

type BudgetQueryDatabase = Pick<typeof db, "query">;

const serializeCycle = (
  row: typeof operationalBudgetCycles.$inferSelect,
): OperationalBudgetCycleSnapshot => ({
  id: row.id,
  periodStart: row.periodStart.toISOString(),
  periodEnd: row.periodEnd.toISOString(),
  profile: row.profile,
  normalTargetMicrousd: row.normalTargetMicrousd,
  warningMicrousd: row.warningMicrousd,
  protectionMicrousd: row.protectionMicrousd,
  nearCeilingMicrousd: row.nearCeilingMicrousd,
  ceilingMicrousd: row.ceilingMicrousd,
  createdAt: row.createdAt.toISOString(),
});

const serializeEvidence = (
  row: typeof operationalBudgetEvidence.$inferSelect,
): OperationalBudgetEvidenceSnapshot => ({
  id: row.id,
  idempotencyKey: row.idempotencyKey,
  cycleId: row.cycleId,
  contractVersion: row.contractVersion,
  provider: row.provider,
  scopeKind: row.scopeKind,
  scopeId: row.scopeId,
  scopeName: row.scopeName,
  scopeMetadata: row.scopeMetadata,
  currency: row.currency,
  observedAt: row.observedAt.toISOString(),
  actualAmountMicrousd: row.actualAmountMicrousd,
  projectedAmountMicrousd: row.projectedAmountMicrousd,
  measurements: row.measurements,
  costBreakdownMicrousd: row.costBreakdownMicrousd,
  rateCard: row.rateCard,
  sourceVersion: row.sourceVersion,
  collectedBy: row.collectedBy,
  reason: row.reason,
  createdAt: row.createdAt.toISOString(),
});

const getCycleForPeriod = async ({
  database,
  periodStart,
  periodEnd,
}: {
  database: BudgetQueryDatabase;
  periodStart: Date;
  periodEnd: Date;
}) => {
  const row = await database.query.operationalBudgetCycles.findFirst({
    where: (table, { and, gt, lt }) =>
      and(lt(table.periodStart, periodEnd), gt(table.periodEnd, periodStart)),
  });
  return row ? serializeCycle(row) : null;
};

const getEvidenceByIdempotencyKey = async ({
  database,
  idempotencyKey,
}: {
  database: BudgetQueryDatabase;
  idempotencyKey: string;
}) => {
  const row = await database.query.operationalBudgetEvidence.findFirst({
    where: (table, { eq }) => eq(table.idempotencyKey, idempotencyKey),
  });
  return row ? serializeEvidence(row) : null;
};

const listCycleEvidence = async ({
  database,
  cycleId,
}: {
  database: BudgetQueryDatabase;
  cycleId: string;
}): Promise<OperationalBudgetEvidenceSnapshot[]> => {
  const rows = await database.query.operationalBudgetEvidence.findMany({
    where: (table, { eq }) => eq(table.cycleId, cycleId),
  });
  return rows.map(serializeEvidence);
};

export const findOperationalBudgetEvidenceReplay = async ({
  database = db,
  input,
}: {
  database?: BudgetQueryDatabase;
  input: ReplayOperationalBudgetEvidenceInput;
}): Promise<OperationalBudgetEvidenceSnapshot | null> => {
  const normalized = {
    provider: normalizeOperationalBudgetRequiredText(
      input.provider,
      "Provider",
    ),
    scopeKind: normalizeOperationalBudgetRequiredText(
      input.scopeKind,
      "Scope kind",
    ),
    scopeId: normalizeOperationalBudgetRequiredText(input.scopeId, "Scope id"),
    actor: normalizeOperationalBudgetRequiredText(input.actor, "Actor"),
    reason: normalizeOperationalBudgetRequiredText(input.reason, "Reason"),
    idempotencyKey: normalizeOperationalBudgetRequiredText(
      input.idempotencyKey,
      "Idempotency key",
    ),
  };
  const evidence = await getEvidenceByIdempotencyKey({
    database,
    idempotencyKey: normalized.idempotencyKey,
  });
  if (!evidence) return null;
  if (
    evidence.provider !== normalized.provider ||
    evidence.scopeKind !== normalized.scopeKind ||
    evidence.scopeId !== normalized.scopeId ||
    evidence.collectedBy !== normalized.actor ||
    evidence.reason !== normalized.reason
  ) {
    throw new OperationalBudgetConflictError(
      "The idempotency key was already used for a different provider collection.",
    );
  }
  return evidence;
};

export const getOperationalBudgetStatus = async ({
  database = db,
  asOf = new Date(),
}: {
  database?: typeof db;
  asOf?: Date;
} = {}): Promise<OperationalBudgetStatus> => {
  const row = await database.query.operationalBudgetCycles.findFirst({
    where: (table, { and, gt, lte }) =>
      and(lte(table.periodStart, asOf), gt(table.periodEnd, asOf)),
    orderBy: (table, { desc }) => [desc(table.periodStart)],
  });
  const cycle = row ? serializeCycle(row) : null;
  const evidence = cycle
    ? await listCycleEvidence({ database, cycleId: cycle.id })
    : [];
  return buildOperationalBudgetStatus({ cycle, evidence, asOf });
};

export const previewOperationalBudgetEvidence = async ({
  database = db,
  input,
  now = new Date(),
  evidenceId = "preview",
}: {
  database?: typeof db;
  input: RecordOperationalBudgetEvidenceInput;
  now?: Date;
  evidenceId?: string;
}): Promise<OperationalBudgetEvidencePreview> => {
  const normalized = normalizeOperationalBudgetEvidenceInput(input, now);
  const expectedCycle = buildOperationalBudgetCycleSnapshot({
    periodStart: normalized.evidence.billingPeriod.start,
    periodEnd: normalized.evidence.billingPeriod.end,
    createdAt: now,
  });
  const existingCycle = await getCycleForPeriod({
    database,
    periodStart: normalized.evidence.billingPeriod.start,
    periodEnd: normalized.evidence.billingPeriod.end,
  });
  if (existingCycle) {
    assertOperationalBudgetCyclePolicy(existingCycle, expectedCycle);
  }
  const cycle = existingCycle ?? expectedCycle;
  const requestedEvidence = buildOperationalBudgetEvidenceSnapshot({
    normalized,
    cycle,
    evidenceId,
    createdAt: now,
  });
  const existingEvidence = await getEvidenceByIdempotencyKey({
    database,
    idempotencyKey: normalized.idempotencyKey,
  });
  if (existingEvidence) {
    assertMatchingOperationalBudgetEvidence(
      existingEvidence,
      requestedEvidence,
    );
  }
  const cycleEvidence = await listCycleEvidence({
    database,
    cycleId: cycle.id,
  });
  const evidence = existingEvidence
    ? cycleEvidence
    : [...cycleEvidence, requestedEvidence];

  return {
    wouldCreateCycle: existingCycle === null,
    wouldRecordEvidence: existingEvidence === null,
    replayed: existingEvidence !== null,
    evidence: existingEvidence ?? requestedEvidence,
    status: buildOperationalBudgetStatus({
      cycle,
      evidence,
      asOf: normalized.evidence.observedAt,
    }),
  };
};

export const recordOperationalBudgetEvidence = async ({
  database = db,
  input,
  now = new Date(),
  evidenceId = crypto.randomUUID(),
}: {
  database?: typeof db;
  input: RecordOperationalBudgetEvidenceInput;
  now?: Date;
  evidenceId?: string;
}): Promise<OperationalBudgetEvidenceSnapshot> => {
  const normalized = normalizeOperationalBudgetEvidenceInput(input, now);
  const expectedCycle = buildOperationalBudgetCycleSnapshot({
    periodStart: normalized.evidence.billingPeriod.start,
    periodEnd: normalized.evidence.billingPeriod.end,
    createdAt: now,
  });
  const requestedEvidence = buildOperationalBudgetEvidenceSnapshot({
    normalized,
    cycle: expectedCycle,
    evidenceId,
    createdAt: now,
  });
  const replay = await getEvidenceByIdempotencyKey({
    database,
    idempotencyKey: normalized.idempotencyKey,
  });
  if (replay) {
    assertMatchingOperationalBudgetEvidence(replay, requestedEvidence);
    return replay;
  }

  return database.transaction(async (tx) => {
    const existingCycle = await getCycleForPeriod({
      database: tx,
      periodStart: normalized.evidence.billingPeriod.start,
      periodEnd: normalized.evidence.billingPeriod.end,
    });
    if (existingCycle) {
      assertOperationalBudgetCyclePolicy(existingCycle, expectedCycle);
    }
    const [insertedCycle] = existingCycle
      ? []
      : await tx
          .insert(operationalBudgetCycles)
          .values({
            ...expectedCycle,
            periodStart: new Date(expectedCycle.periodStart),
            periodEnd: new Date(expectedCycle.periodEnd),
            createdAt: new Date(expectedCycle.createdAt),
          })
          .onConflictDoNothing()
          .returning();
    const cycle =
      existingCycle ??
      (insertedCycle
        ? serializeCycle(insertedCycle)
        : await getCycleForPeriod({
            database: tx,
            periodStart: normalized.evidence.billingPeriod.start,
            periodEnd: normalized.evidence.billingPeriod.end,
          }));
    if (!cycle) {
      throw new OperationalBudgetConflictError(
        "Budget cycle changed concurrently and could not be read.",
      );
    }
    assertOperationalBudgetCyclePolicy(cycle, expectedCycle);

    const evidenceForCycle = { ...requestedEvidence, cycleId: cycle.id };
    const [insertedEvidence] = await tx
      .insert(operationalBudgetEvidence)
      .values({
        ...evidenceForCycle,
        observedAt: new Date(evidenceForCycle.observedAt),
        createdAt: new Date(evidenceForCycle.createdAt),
      })
      .onConflictDoNothing()
      .returning();
    if (insertedEvidence) return serializeEvidence(insertedEvidence);

    const concurrentReplay = await getEvidenceByIdempotencyKey({
      database: tx,
      idempotencyKey: normalized.idempotencyKey,
    });
    if (!concurrentReplay) {
      throw new OperationalBudgetConflictError(
        "Budget evidence changed concurrently and could not be read.",
      );
    }
    assertMatchingOperationalBudgetEvidence(concurrentReplay, evidenceForCycle);
    return concurrentReplay;
  });
};

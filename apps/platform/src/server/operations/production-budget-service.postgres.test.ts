import * as schema from "@/db/schema";
import {
  operationalBudgetCycles,
  operationalBudgetEvidence,
} from "@/db/schema";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { afterAll, describe, expect, it } from "vitest";
import {
  OperationalBudgetConflictError,
  getOperationalBudgetStatus,
  recordOperationalBudgetEvidence,
} from "./production-budget-service";

const databaseUrl = process.env.AIR_JAM_TEST_DATABASE_URL?.trim();
const describeWithPostgres = databaseUrl ? describe : describe.skip;

describeWithPostgres("production budget PostgreSQL invariants", () => {
  const client = postgres(databaseUrl!, { max: 4 });
  const database = drizzle(client, { schema });
  const offset = Number.parseInt(crypto.randomUUID().slice(0, 8), 16);
  const periodStart = new Date(Date.UTC(2040, 0, 1) + offset);
  const periodEnd = new Date(periodStart.getTime() + 31 * 24 * 60 * 60 * 1_000);
  const observedAt = new Date(periodStart.getTime() + 24 * 60 * 60 * 1_000);
  const cycleId = `air-jam-budget:${periodStart.toISOString()}:${periodEnd.toISOString()}`;
  const idempotencyKey = `production-budget-test:${crypto.randomUUID()}`;

  const evidence = (actualAmountMicrousd = 7_000_000) => ({
    contractVersion: 1,
    provider: "railway",
    scope: {
      kind: "project",
      id: "project-test",
      name: "air-jam-test",
      workspaceId: "workspace-test",
    },
    billingPeriod: {
      start: periodStart.toISOString(),
      end: periodEnd.toISOString(),
    },
    observedAt: observedAt.toISOString(),
    currency: "USD",
    actualAmountMicrousd,
    projectedAmountMicrousd: 8_000_000,
    measurements: { actual: [] },
    costBreakdownMicrousd: { actual: {} },
    rateCard: { id: "test-rate-card" },
    sourceVersion: "test-provider@1",
  });

  afterAll(async () => {
    await database
      .delete(operationalBudgetEvidence)
      .where(eq(operationalBudgetEvidence.cycleId, cycleId));
    await database
      .delete(operationalBudgetCycles)
      .where(eq(operationalBudgetCycles.id, cycleId));
    await client.end();
  });

  it("records exactly one immutable item under concurrent idempotent syncs", async () => {
    const input = {
      evidence: evidence(),
      actor: "test:budget-postgres",
      reason: "Prove concurrent budget evidence ingestion",
      idempotencyKey,
    };
    const attempts = await Promise.all([
      recordOperationalBudgetEvidence({
        database,
        input,
        now: observedAt,
        evidenceId: `${idempotencyKey}:one`,
      }),
      recordOperationalBudgetEvidence({
        database,
        input,
        now: observedAt,
        evidenceId: `${idempotencyKey}:two`,
      }),
    ]);

    expect(attempts[0]).toEqual(attempts[1]);
    const stored = await database.query.operationalBudgetEvidence.findMany({
      where: (table, { eq }) => eq(table.idempotencyKey, idempotencyKey),
    });
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({
      cycleId,
      actualAmountMicrousd: 7_000_000,
      collectedBy: "test:budget-postgres",
    });
  });

  it("derives status from stored evidence and rejects conflicting replay", async () => {
    const status = await getOperationalBudgetStatus({
      database,
      asOf: new Date(observedAt.getTime() + 60_000),
    });
    expect(status).toMatchObject({
      evidenceStatus: "fresh",
      state: "normal",
      actualAmountMicrousd: 7_000_000,
      cycle: { id: cycleId, profile: "ordinary" },
    });

    await expect(
      recordOperationalBudgetEvidence({
        database,
        input: {
          evidence: evidence(7_000_001),
          actor: "test:budget-postgres",
          reason: "Prove concurrent budget evidence ingestion",
          idempotencyKey,
        },
        now: observedAt,
      }),
    ).rejects.toBeInstanceOf(OperationalBudgetConflictError);
  });
});

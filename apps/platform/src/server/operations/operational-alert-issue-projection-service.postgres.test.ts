import * as schema from "@/db/schema";
import {
  GitHubAlertIssueAdapterError,
  type GitHubAlertIssueProjector,
} from "@/server/operations/github-alert-issue-adapter";
import type {
  OperationalAlertV1,
  OperationalEventEnvelopeV1,
  OperationalSloEvaluationV1,
} from "@air-jam/operations-contract";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import {
  claimOperationalAlertIssueProjection,
  inspectOperationalAlertIssueProjection,
  repairExpiredOperationalAlertIssueProjections,
  requeueOperationalAlertIssueProjection,
  runOperationalAlertIssueProjectionCycle,
  synchronizeNextOperationalAlertIssueProjection,
} from "./operational-alert-issue-projection-service";

const databaseUrl = process.env.AIR_JAM_TEST_DATABASE_URL?.trim();
const describeWithPostgres = databaseUrl ? describe : describe.skip;

describeWithPostgres("operational alert issue projection PostgreSQL lifecycle", () => {
  const client = postgres(databaseUrl!, { max: 8 });
  const database = drizzle(client, { schema });
  const suffix = crypto.randomUUID();
  const repository = "vucinatim/air-jam";
  const baseTime = new Date("2026-09-04T00:00:00.000Z");
  const at = (revision: number) =>
    new Date(baseTime.getTime() + revision * 60_000);

  const reset = async () => {
    await database.delete(schema.operationalAlertIssueProjections);
    await database.delete(schema.operationalAlerts);
    await database.delete(schema.operationalSloEvaluations);
    await database.delete(schema.operationalEvents);
    await database.delete(schema.operationalEventOutbox);
  };

  beforeEach(reset);
  afterAll(async () => {
    await reset();
    await client.end();
  });

  const persistAlertRevision = async ({
    key = `slo:projection:${suffix}:test`,
    revision,
    status = "open",
  }: {
    key?: string;
    revision: number;
    status?: "open" | "recovered";
  }): Promise<OperationalAlertV1> => {
    const observedAt = at(revision);
    const eventId = `alert-projection-event:${suffix}:${key}:${revision}`;
    const evaluationId = `alert-projection-evaluation:${suffix}:${key}:${revision}`;
    const event: OperationalEventEnvelopeV1 = {
      contractVersion: 1,
      plane: "lifecycle_runtime",
      eventId,
      kind: status === "open" ? "alert.slo.open" : "alert.slo.recovered",
      severity: status === "open" ? "critical" : "info",
      outcome: status === "open" ? "degraded" : "recovered",
      authority: "airjam_authoritative",
      source: {
        service: "realtime_server",
        component: "slo-evaluator",
        environment: "test",
      },
      subject: { type: "service", id: "realtime_server" },
      correlation: {
        contractVersion: 1,
        correlationId: key,
      },
      occurredAt: observedAt.toISOString(),
      observedAt: observedAt.toISOString(),
      payload: { alertKey: key, revision },
      evidence: [],
    };
    const evaluation: OperationalSloEvaluationV1 = {
      contractVersion: 1,
      evaluationId,
      sloId: `projection-slo-${suffix}`,
      environment: "test",
      service: "realtime_server",
      windowStartedAt: new Date(
        observedAt.getTime() - 60_000,
      ).toISOString(),
      windowEndedAt: observedAt.toISOString(),
      sampleCount: 2,
      successCount: status === "open" ? 0 : 2,
      successRatioBasisPoints: status === "open" ? 0 : 10_000,
      objectiveBasisPoints: 9_900,
      status: status === "open" ? "breaching" : "healthy",
      consecutiveBreaches: status === "open" ? 3 : 0,
      consecutiveRecoveries: status === "recovered" ? 3 : 0,
      evaluatedAt: observedAt.toISOString(),
      evidence: [],
    };
    const alert: OperationalAlertV1 = {
      contractVersion: 1,
      alertId: `alert-projection:${suffix}:${key}`,
      alertKey: key,
      policyId: evaluation.sloId,
      environment: "test",
      service: "realtime_server",
      severity: "critical",
      status,
      summary:
        status === "open"
          ? "Room and controller flow is unavailable."
          : "Room and controller flow recovered.",
      firstTriggeredAt: at(1).toISOString(),
      lastObservedAt: observedAt.toISOString(),
      occurrenceCount: revision,
      latestEventId: eventId,
      latestEvaluationId: evaluationId,
      ...(status === "recovered"
        ? { recoveredAt: observedAt.toISOString() }
        : {}),
      revision,
    };
    await database.transaction(async (tx) => {
      await tx.insert(schema.operationalEventOutbox).values({
        id: event.eventId,
        contractVersion: 1,
        envelope: event,
        status: "pending",
        attemptCount: 0,
        maxAttempts: 8,
        availableAt: observedAt,
        createdAt: observedAt,
        updatedAt: observedAt,
      });
      await tx.insert(schema.operationalSloEvaluations).values({
        id: evaluationId,
        sloId: evaluation.sloId,
        environment: "test",
        status: evaluation.status,
        triggerEventId: eventId,
        document: evaluation,
        evaluatedAt: observedAt,
        createdAt: observedAt,
      });
      const existing = await tx.query.operationalAlerts.findFirst({
        where: (table, { eq }) => eq(table.alertKey, key),
      });
      if (existing) {
        await tx
          .update(schema.operationalAlerts)
          .set({
            status,
            latestEventId: eventId,
            latestEvaluationId: evaluationId,
            revision,
            document: alert,
            updatedAt: observedAt,
          })
          .where(eq(schema.operationalAlerts.alertKey, key));
      } else {
        await tx.insert(schema.operationalAlerts).values({
          id: alert.alertId,
          alertKey: key,
          policyId: alert.policyId,
          environment: "test",
          service: "realtime_server",
          severity: "critical",
          status,
          latestEventId: eventId,
          latestEvaluationId: evaluationId,
          revision,
          document: alert,
          createdAt: observedAt,
          updatedAt: observedAt,
        });
      }
    });
    return alert;
  };

  it("maintains one projection across create, update, resolve, and failed-verification reopen", async () => {
    let issueState: "open" | "closed" = "open";
    let issueCount = 0;
    const actions: string[] = [];
    const projector: GitHubAlertIssueProjector = async ({
      alert,
      knownIssueNumber,
    }) => {
      const desiredState = alert.status === "recovered" ? "closed" : "open";
      const action = !knownIssueNumber
        ? "created"
        : issueState === "open" && desiredState === "closed"
          ? "resolved"
          : issueState === "closed" && desiredState === "open"
            ? "reopened"
            : "updated";
      if (!knownIssueNumber) issueCount += 1;
      issueState = desiredState;
      actions.push(action);
      return {
        action,
        issue: {
          number: 41,
          url: "https://github.com/vucinatim/air-jam/issues/41",
          state: issueState,
        },
        managedBodyHash: String(alert.revision).repeat(64),
      };
    };

    await persistAlertRevision({ revision: 1 });
    expect(
      (
        await runOperationalAlertIssueProjectionCycle({
          database,
          repository,
          workerId: "worker:one",
          projector,
        })
      ).status,
    ).toBe("created");
    await persistAlertRevision({ revision: 2 });
    expect(
      (
        await runOperationalAlertIssueProjectionCycle({
          database,
          repository,
          workerId: "worker:one",
          projector,
        })
      ).status,
    ).toBe("updated");
    await persistAlertRevision({ revision: 3, status: "recovered" });
    expect(
      (
        await runOperationalAlertIssueProjectionCycle({
          database,
          repository,
          workerId: "worker:one",
          projector,
        })
      ).status,
    ).toBe("resolved");
    await persistAlertRevision({ revision: 4, status: "open" });
    const reopened = await runOperationalAlertIssueProjectionCycle({
      database,
      repository,
      workerId: "worker:one",
      projector,
    });
    expect(reopened.status).toBe("reopened");
    expect(issueCount).toBe(1);
    expect(actions).toEqual(["created", "updated", "resolved", "reopened"]);
    expect(
      await inspectOperationalAlertIssueProjection({
        database,
        repository,
        alertKey: `slo:projection:${suffix}:test`,
      }),
    ).toMatchObject({
      status: "delivered",
      targetAlertRevision: 4,
      projectedAlertRevision: 4,
      issue: { number: 41, state: "open" },
    });
    expect(
      await database.select().from(schema.operationalAlertIssueProjections),
    ).toHaveLength(1);
  });

  it("keeps permission failure visible, supports audited idempotent requeue, and preserves alert truth", async () => {
    const alertKey = `slo:permission:${suffix}:test`;
    await persistAlertRevision({ key: alertKey, revision: 1 });
    const failed = await runOperationalAlertIssueProjectionCycle({
      database,
      repository,
      workerId: "worker:permission",
      projector: async () => {
        throw new GitHubAlertIssueAdapterError({
          code: "github.http_403",
          message: "Permission denied.",
          retryable: false,
        });
      },
    });
    expect(failed).toMatchObject({
      status: "dead_lettered",
      projection: {
        status: "dead_letter",
        lastError: { code: "github.http_403", retryable: false },
      },
    });
    expect(
      await database.query.operationalAlerts.findFirst({
        where: (table, { eq }) => eq(table.alertKey, alertKey),
      }),
    ).toMatchObject({ status: "open", revision: 1 });

    const input = {
      database,
      repository,
      alertKey,
      actor: "agent:repair",
      reason: "Issue-only permission is now verified.",
      idempotencyKey: `permission-requeue:${suffix}`,
      maxAttempts: 3,
    };
    const requeued = await requeueOperationalAlertIssueProjection(input);
    const replayed = await requeueOperationalAlertIssueProjection(input);
    expect(requeued).toMatchObject({ replayed: false });
    expect(replayed).toMatchObject({
      replayed: true,
      auditEventId: requeued.auditEventId,
    });
    await expect(
      requeueOperationalAlertIssueProjection({
        ...input,
        reason: "A different operation must not reuse the same command key.",
      }),
    ).rejects.toThrow("idempotency key");
    expect(
      await database.query.operationalEventOutbox.findFirst({
        where: (table, { eq }) => eq(table.id, requeued.auditEventId),
      }),
    ).toMatchObject({
      envelope: {
        kind: "github_issue_projection.requeued",
        actor: { type: "agent", id: "agent:repair" },
      },
    });
  });

  it("fences concurrent claims and repairs expired leases without duplicate authority", async () => {
    const alertKey = `slo:lease:${suffix}:test`;
    await persistAlertRevision({ key: alertKey, revision: 1 });
    await synchronizeNextOperationalAlertIssueProjection({
      database,
      repository,
      now: baseTime,
    });
    const claims = await Promise.all([
      claimOperationalAlertIssueProjection({
        database,
        repository,
        workerId: "worker:one",
        now: baseTime,
      }),
      claimOperationalAlertIssueProjection({
        database,
        repository,
        workerId: "worker:two",
        now: baseTime,
      }),
    ]);
    expect(claims.filter(Boolean)).toHaveLength(1);
    expect(
      await repairExpiredOperationalAlertIssueProjections({
        database,
        repository,
        now: new Date(baseTime.getTime() + 181_000),
      }),
    ).toHaveLength(1);
    expect(
      await inspectOperationalAlertIssueProjection({
        database,
        repository,
        alertKey,
      }),
    ).toMatchObject({ status: "pending", attemptCount: 1 });
  });
});

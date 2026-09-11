import * as schema from "@/db/schema";
import { acquireOperationalEvidenceWriteFence } from "@air-jam/database-contract";
import {
  createStructuredOperationalFailure,
  type OperationalEventEnvelopeV1,
  type OperationalSyntheticRunV1,
} from "@air-jam/operations-contract";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { synchronizeNextOperationalAlertIssueProjection } from "./operational-alert-issue-projection-service";
import { retainOperationalEvidence } from "./operational-evidence-retention-service";
import { persistOperationalSyntheticRun } from "./operational-synthetic-service";

const databaseUrl = process.env.AIR_JAM_TEST_DATABASE_URL?.trim();
const describeWithPostgres = databaseUrl ? describe : describe.skip;

describeWithPostgres("bounded operational evidence retention", () => {
  const client = postgres(databaseUrl!, { max: 8 });
  const database = drizzle(client, { schema });
  let now: Date;
  const daysAgo = (days: number) => new Date(now.getTime() - days * 86_400_000);
  const reset = async () => {
    if (process.env.AIR_JAM_RETENTION_SCALE_PROOF === "1" && databaseUrl) {
      // The opt-in scale proof requires a dedicated disposable test database;
      // reset its exact fixture tables without retaining prior benchmark bloat.
      await client`truncate table operational_alert_issue_projections,operational_alerts,
        operational_slo_evaluations,operational_synthetic_runs,operational_event_delivery_commands,
        operational_events,operational_event_outbox`;
      return;
    }
    await database.delete(schema.operationalAlertIssueProjections);
    await database.delete(schema.operationalAlerts);
    await database.delete(schema.operationalSloEvaluations);
    await database.delete(schema.operationalSyntheticRuns);
    await database.delete(schema.operationalEventDeliveryCommands);
    await database.delete(schema.operationalEvents);
    await database.delete(schema.operationalEventOutbox);
  };
  beforeEach(
    async () => {
      await reset();
      const [clock] = await client`select clock_timestamp() as now`;
      now = new Date(clock!.now);
    },
    process.env.AIR_JAM_RETENTION_SCALE_PROOF === "1" ? 120_000 : 10_000,
  );
  afterAll(
    async () => {
      await reset();
      await client.end();
    },
    process.env.AIR_JAM_RETENTION_SCALE_PROOF === "1" ? 120_000 : 10_000,
  );

  const event = (
    id: string,
    at = daysAgo(40),
    references: string[] = [],
  ): OperationalEventEnvelopeV1 => ({
    contractVersion: 1,
    plane: "lifecycle_runtime",
    eventId: id,
    kind: "test.retention",
    severity: "info",
    outcome: "succeeded",
    authority: "airjam_authoritative",
    source: {
      service: "operational_worker",
      component: "retention-test",
      environment: "test",
    },
    subject: { type: "service", id: "operational_worker" },
    correlation: { contractVersion: 1, correlationId: id },
    occurredAt: at.toISOString(),
    observedAt: at.toISOString(),
    payload: {},
    evidence: references.map((reference) => ({
      kind: "snapshot",
      reference,
      collectedAt: at.toISOString(),
    })),
  });

  const storeEvent = async (
    envelope: OperationalEventEnvelopeV1,
    deliveredAt = new Date(envelope.observedAt),
  ) => {
    await database.insert(schema.operationalEventOutbox).values({
      id: envelope.eventId,
      contractVersion: 1,
      envelope,
      status: "delivered",
      attemptCount: 1,
      availableAt: new Date(envelope.observedAt),
      deliveredAt,
      createdAt: new Date(envelope.observedAt),
      updatedAt: deliveredAt,
    });
    await database.insert(schema.operationalEvents).values({
      id: envelope.eventId,
      contractVersion: 1,
      kind: envelope.kind,
      severity: envelope.severity,
      outcome: envelope.outcome,
      authority: envelope.authority,
      service: envelope.source.service,
      environment: envelope.source.environment,
      subjectType: envelope.subject.type,
      subjectId: envelope.subject.id,
      correlationId: envelope.correlation.correlationId,
      occurredAt: new Date(envelope.occurredAt),
      observedAt: new Date(envelope.observedAt),
      storedAt: deliveredAt,
      envelope,
    });
  };
  const ids = async () =>
    (
      await database
        .select({ id: schema.operationalEventOutbox.id })
        .from(schema.operationalEventOutbox)
    )
      .map((row) => row.id)
      .sort();

  it("previews without writes, expires completed history, and respects per-table bounds", async () => {
    for (let i = 0; i < 5; i++) await storeEvent(event(`old:${i}`));
    await storeEvent(event("recent", daysAgo(29)));
    await storeEvent(event("recent-delivery", daysAgo(100)), daysAgo(1));
    const before = await ids();
    const preview = await retainOperationalEvidence({ database, limit: 2 });
    expect(preview.mode).toBe("preview");
    expect(preview.counts).toMatchObject({ outbox: 2, events: 2 });
    expect(await ids()).toEqual(before);
    expect(
      Date.parse(preview.evaluatedAt) - Date.parse(preview.historyCutoff),
    ).toBe(30 * 86_400_000);
    expect(
      Date.parse(preview.evaluatedAt) - Date.parse(preview.commandCutoff),
    ).toBe(90 * 86_400_000);
    const applied = await retainOperationalEvidence({
      database,
      apply: true,
      limit: 2,
    });
    expect(applied.counts).toEqual(preview.counts);
    for (let i = 0; i < 3; i++) {
      const result = await retainOperationalEvidence({
        database,
        apply: true,
        limit: 2,
      });
      for (const count of Object.values(result.counts))
        expect(count).toBeLessThanOrEqual(2);
    }
    expect(await ids()).toEqual(["recent", "recent-delivery"]);
    expect(
      (await retainOperationalEvidence({ database, apply: true })).counts,
    ).toEqual({
      commands: 0,
      evaluations: 0,
      syntheticRuns: 0,
      outbox: 0,
      events: 0,
    });
  });

  it("retains transitive references and live delivery while retiring an unreferenced cycle", async () => {
    await storeEvent(event("cause", daysAgo(100)));
    await storeEvent({
      ...event("middle", daysAgo(90)),
      correlation: {
        contractVersion: 1,
        correlationId: "chain",
        causationEventId: "cause",
      },
    });
    await storeEvent(event("recent-root", daysAgo(1), ["event:middle"]));
    await storeEvent(event("cycle:a", daysAgo(100), ["event:cycle:b"]));
    await storeEvent(event("cycle:b", daysAgo(100), ["event:cycle:a"]));
    for (const status of ["pending", "delivering", "dead_letter"] as const) {
      const envelope = event(`live:${status}`, daysAgo(100));
      await database.insert(schema.operationalEventOutbox).values({
        id: envelope.eventId,
        contractVersion: 1,
        envelope,
        status,
        createdAt: daysAgo(100),
        updatedAt: daysAgo(100),
        availableAt: daysAgo(100),
        ...(status === "delivering"
          ? {
              leaseOwner: "worker:test",
              leaseToken: "token:test",
              leaseExpiresAt: daysAgo(99),
            }
          : {}),
        ...(status === "dead_letter"
          ? {
              lastError: createStructuredOperationalFailure({
                code: "test.failed",
                failureClass: "internal",
                summary: "Fixture failure",
                retryable: false,
              }),
            }
          : {}),
      });
    }
    await retainOperationalEvidence({ database, apply: true });
    expect(await ids()).toEqual([
      "cause",
      "live:dead_letter",
      "live:delivering",
      "live:pending",
      "middle",
      "recent-root",
    ]);
  });

  it("reports a connected group that cannot fit and retires it when the bound fits", async () => {
    await storeEvent(event("oversized:a", daysAgo(100), ["event:oversized:b"]));
    await storeEvent(event("oversized:b", daysAgo(100), ["event:oversized:a"]));
    const small = await retainOperationalEvidence({
      database,
      apply: true,
      limit: 1,
    });
    expect(small.counts).toMatchObject({ outbox: 0, events: 0 });
    expect(small.skippedOversizedCandidates).toBeGreaterThan(0);
    expect(await ids()).toHaveLength(2);
    const fitting = await retainOperationalEvidence({
      database,
      apply: true,
      limit: 2,
    });
    expect(fitting.counts).toMatchObject({ outbox: 2, events: 2 });
    expect(await ids()).toEqual([]);
  });

  const persistRun = async (
    label: string,
    at: Date,
    status: "passed" | "failed" = "passed",
  ) => {
    const run: OperationalSyntheticRunV1 = {
      contractVersion: 1,
      runId: `run:${label}`,
      checkId: "platform-realtime-health",
      environment: "test",
      status,
      startedAt: new Date(at.getTime() - 100).toISOString(),
      completedAt: at.toISOString(),
      durationMilliseconds: 100,
      eventId: `run-event:${label}`,
      observations: ["platform", "realtime"].map((stepId) => ({
        stepId,
        status,
        latencyMilliseconds: 10,
        ...(status === "failed"
          ? {
              failure: createStructuredOperationalFailure({
                code: "test.unavailable",
                failureClass: "unavailable",
                summary: "Fixture failure",
                retryable: true,
              }),
            }
          : {}),
      })),
      evidence: [
        {
          kind: "snapshot",
          reference: `synthetic-run:run:${label}`,
          collectedAt: at.toISOString(),
        },
      ],
    };
    return persistOperationalSyntheticRun({
      database,
      run,
      actor: "agent:test",
      reason: "Retention proof",
      idempotencyKey: label,
      now: at,
    });
  };
  const deliverAll = async () => {
    await database.update(schema.operationalEventOutbox).set({
      status: "delivered",
      deliveredAt: daysAgo(35),
      updatedAt: daysAgo(35),
    });
    const delivered = await database
      .select()
      .from(schema.operationalEventOutbox);
    for (const row of delivered) {
      const envelope = row.envelope;
      await database
        .insert(schema.operationalEvents)
        .values({
          id: row.id,
          contractVersion: 1,
          kind: envelope.kind,
          severity: envelope.severity,
          outcome: envelope.outcome,
          authority: envelope.authority,
          service: envelope.source.service,
          environment: envelope.source.environment,
          subjectType: envelope.subject.type,
          subjectId: envelope.subject.id,
          correlationId: envelope.correlation.correlationId,
          occurredAt: new Date(envelope.occurredAt),
          observedAt: new Date(envelope.observedAt),
          storedAt: daysAgo(35),
          envelope,
        })
        .onConflictDoNothing();
    }
  };

  it("does not let an old open incident starve unrelated eligible history", async () => {
    for (let i = 0; i < 3; i++) {
      await persistRun(
        `protected:${i}`,
        new Date(daysAgo(45).getTime() + i * 60_000),
        "failed",
      );
    }
    await deliverAll();
    await storeEvent(event("free-outside-incident", daysAgo(34)));
    let cursor: string | undefined;
    for (let page = 0; page < 20; page++) {
      const result = await retainOperationalEvidence({
        database,
        apply: true,
        limit: 1,
        cursor,
      });
      cursor = result.nextCursor ?? undefined;
      if (!(await ids()).includes("free-outside-incident")) break;
    }
    expect(await ids()).not.toContain("free-outside-incident");
    for (let i = 0; i < 3; i++)
      expect(await ids()).toContain(`run-event:protected:${i}`);
  });

  it("retains latest SLO state and its samples while collecting older synthetic self-links", async () => {
    await persistRun("old", daysAgo(100));
    const latest = await persistRun("latest", daysAgo(40));
    await deliverAll();
    await retainOperationalEvidence({ database, apply: true });
    expect(await ids()).toEqual(["run-event:latest"]);
    const evaluations = await database
      .select()
      .from(schema.operationalSloEvaluations);
    expect(evaluations.map((row) => row.id)).toEqual([
      latest.evaluation!.evaluationId,
    ]);
    expect(
      (await database.select().from(schema.operationalSyntheticRuns)).map(
        (row) => row.id,
      ),
    ).toEqual(["run:latest"]);
  });

  it("preserves the open-incident window and stale issue target after internal recovery", async () => {
    await persistRun("before-incident", daysAgo(100));
    for (let i = 0; i < 3; i++)
      await persistRun(
        `failure:${i}`,
        new Date(daysAgo(45).getTime() + i * 60_000),
        "failed",
      );
    const projection = await synchronizeNextOperationalAlertIssueProjection({
      database,
      repository: "vucinatim/air-jam",
      now: daysAgo(45),
    });
    expect(projection).not.toBeNull();
    await deliverAll();
    await retainOperationalEvidence({ database, apply: true });
    for (let i = 0; i < 3; i++)
      expect(await ids()).toContain(`run-event:failure:${i}`);
    for (let i = 0; i < 3; i++)
      await persistRun(
        `recovery:${i}`,
        new Date(daysAgo(44).getTime() + i * 60_000),
      );
    await deliverAll();
    const [alert] = await database.select().from(schema.operationalAlerts);
    expect(alert!.status).toBe("recovered");
    await retainOperationalEvidence({ database, apply: true });
    for (let i = 0; i < 3; i++)
      expect(await ids()).toContain(`run-event:failure:${i}`);
    expect(await ids()).not.toContain("run-event:before-incident");
    expect(await database.select().from(schema.operationalAlerts)).toEqual([
      alert,
    ]);
    expect(
      await database.select().from(schema.operationalAlertIssueProjections),
    ).toHaveLength(1);

    // A closed provider issue alone is not confirmation of the recovered target.
    const markIssueClosed = async () => {
      await database.update(schema.operationalAlertIssueProjections).set({
        status: "delivered",
        issueNumber: 1,
        issueUrl: "https://github.com/vucinatim/air-jam/issues/1",
        issueState: "closed",
        managedBodyHash: "a".repeat(64),
        projectedAt: daysAgo(35),
        projectedAlertRevision: sql`${schema.operationalAlertIssueProjections.targetAlertRevision}`,
      });
    };
    await markIssueClosed();
    await retainOperationalEvidence({ database, apply: true });
    for (let i = 0; i < 3; i++)
      expect(await ids()).toContain(`run-event:failure:${i}`);

    await synchronizeNextOperationalAlertIssueProjection({
      database,
      repository: "vucinatim/air-jam",
      now: daysAgo(35),
    });
    await markIssueClosed();
    await retainOperationalEvidence({ database, apply: true });
    for (let i = 0; i < 3; i++)
      expect(await ids()).not.toContain(`run-event:failure:${i}`);
    expect(await database.select().from(schema.operationalAlerts)).toEqual([
      alert,
    ]);
    expect(
      await database.select().from(schema.operationalAlertIssueProjections),
    ).toHaveLength(1);
  });

  it("uses command completion age, protects unfinished commands, and expires receipt/audit cycles", async () => {
    for (const [id, completed] of [
      ["expired", 100],
      ["recent", 89],
      ["unfinished", null],
    ] as const) {
      await storeEvent(event(`target:${id}`, daysAgo(110)));
      await storeEvent(
        event(`audit:${id}`, daysAgo(100), [
          `operational-event-delivery-command:${id}`,
        ]),
      );
      await database.insert(schema.operationalEventDeliveryCommands).values({
        id,
        contractVersion: 1,
        idempotencyKey: id,
        eventId: `target:${id}`,
        action: "requeue_dead_letter",
        requestHash: "a".repeat(64),
        actor: "agent:test",
        reason: "Retention proof",
        request: {},
        result: completed === null ? null : { auditEventId: `audit:${id}` },
        completedAt: completed === null ? null : daysAgo(completed),
        createdAt: daysAgo(110),
      });
    }
    await retainOperationalEvidence({ database, apply: true });
    expect(
      (await database.select().from(schema.operationalEventDeliveryCommands))
        .map((row) => row.id)
        .sort(),
    ).toEqual(["recent", "unfinished"]);
    expect(await ids()).toContain("target:unfinished");
    expect(await ids()).toContain("audit:recent");
    expect(await ids()).not.toContain("audit:expired");
    expect(await ids()).not.toContain("target:expired");
  });

  it("waits for an in-flight evidence writer and observes its committed reference", async () => {
    await storeEvent(event("concurrent-cause", daysAgo(100)));
    let releaseWriter!: () => void;
    let writerLocked!: () => void;
    const locked = new Promise<void>((resolve) => {
      writerLocked = resolve;
    });
    const release = new Promise<void>((resolve) => {
      releaseWriter = resolve;
    });
    const writer = database.transaction(async (tx) => {
      await acquireOperationalEvidenceWriteFence(tx);
      writerLocked();
      await release;
      const envelope = event("concurrent-root", daysAgo(1), [
        "event:concurrent-cause",
      ]);
      await tx
        .insert(schema.operationalEventOutbox)
        .values({ id: envelope.eventId, contractVersion: 1, envelope });
    });
    await locked;
    let finished = false;
    const retention = retainOperationalEvidence({
      database,
      apply: true,
    }).finally(() => {
      finished = true;
    });
    try {
      // Observe PostgreSQL's lock wait instead of assuming a timing-only delay.
      let waiting = false;
      for (let attempt = 0; attempt < 100 && !waiting; attempt++) {
        const [row] = await database.execute(sql`select exists (
          select 1 from pg_locks where locktype='advisory' and not granted
          and database=(select oid from pg_database where datname=current_database())
        ) as waiting`);
        waiting = row!.waiting === true;
      }
      expect(waiting).toBe(true);
      expect(finished).toBe(false);
    } finally {
      releaseWriter();
      await writer;
      await retention;
    }
    expect(await ids()).toEqual(["concurrent-cause", "concurrent-root"]);
  });

  it("rejects invalid limits before acquiring database authority", async () => {
    for (const limit of [0, 1001, 1.5, Number.NaN]) {
      await expect(
        retainOperationalEvidence({ database, limit }),
      ).rejects.toThrow(/limit/i);
    }
  });

  it("advances past old referenced pages and rejects malformed cursors", async () => {
    await storeEvent(event("page:a", daysAgo(100)));
    await storeEvent(event("page:b", daysAgo(90)));
    await storeEvent(event("page:free", daysAgo(40)));
    await storeEvent(
      event("page:recent", daysAgo(1), ["event:page:a", "event:page:b"]),
    );
    let cursor: string | undefined;
    let blocked = 0;
    for (let page = 0; page < 10; page++) {
      const result = await retainOperationalEvidence({
        database,
        apply: true,
        limit: 1,
        cursor,
      });
      blocked += result.blockedCandidates;
      cursor = result.nextCursor ?? undefined;
      if (!cursor) break;
    }
    expect(blocked).toBeGreaterThan(0);
    expect(await ids()).toEqual(["page:a", "page:b", "page:recent"]);
    await expect(
      retainOperationalEvidence({ database, cursor: "not-a-cursor" }),
    ).rejects.toThrow(/cursor/i);
  });

  it.skipIf(process.env.AIR_JAM_RETENTION_SCALE_PROOF !== "1")(
    "collects a month of synthetic history with bounded indexed lookups",
    async () => {
      const volume = 300_000;
      const expired = 1_000;
      const template = await persistRun("scale-template", daysAgo(1));
      expect(template.evaluation).not.toBeNull();
      await reset();
      await client`
      insert into operational_event_outbox(id,contract_version,envelope,status,delivered_at,created_at,updated_at)
      select 'scale:'||n,1,${JSON.stringify(event("scale-template"))}::text::jsonb ||
        jsonb_build_object('eventId','scale:'||n,'occurredAt',at,'observedAt',at,'evidence',
          jsonb_build_array(jsonb_build_object('kind','snapshot','reference','synthetic-run:scale-run:'||n,'collectedAt',at))),
        'delivered',at,at,at from generate_series(1,${volume}) n cross join lateral(select
          case when n<=${expired} then now()-interval '40 days'+n*interval '9 seconds'
            else now()-interval '29 days'+(n-${expired})*interval '8 seconds' end as at) clock
    `;
      await client`
      insert into operational_events(id,contract_version,kind,severity,outcome,authority,service,environment,
        subject_type,subject_id,correlation_id,occurred_at,observed_at,envelope,stored_at)
      select id,1,'test.retention','info','succeeded','airjam_authoritative','operational_worker','test',
        'service','operational_worker',id,created_at,created_at,envelope,created_at from operational_event_outbox
    `;
      await client`
      insert into operational_synthetic_runs(id,idempotency_key,check_id,environment,status,event_id,document,started_at,completed_at,created_at)
      select 'scale-run:'||n,'scale-run:'||n,'platform-realtime-health','test','passed',id,
        ${JSON.stringify(template.run)}::text::jsonb || jsonb_build_object('runId','scale-run:'||n,'eventId',id,
          'startedAt',created_at,'completedAt',created_at,'evidence',jsonb_build_array(
            jsonb_build_object('kind','snapshot','reference','synthetic-run:scale-run:'||n,'collectedAt',created_at))),
        created_at,created_at,created_at from operational_event_outbox
        cross join lateral(select split_part(id,':',2)::integer as n) number
    `;
      await client`
      insert into operational_slo_evaluations(id,slo_id,environment,status,trigger_event_id,document,evaluated_at,created_at)
      select 'scale-eval:'||n,'control-plane-availability','test',${template.evaluation!.status},event_id,
        ${JSON.stringify(template.evaluation)}::text::jsonb || jsonb_build_object('evaluationId','scale-eval:'||n,
          'evaluatedAt',completed_at,'windowStartedAt',completed_at-interval '30 minutes','windowEndedAt',completed_at,
          'evidence',jsonb_build_array(jsonb_build_object('kind','snapshot','reference','event:'||event_id,'collectedAt',completed_at))),
        completed_at,completed_at from operational_synthetic_runs
        cross join lateral(select split_part(id,':',2)::integer as n) number
    `;
      for (const table of [
        "operational_event_outbox",
        "operational_events",
        "operational_synthetic_runs",
        "operational_slo_evaluations",
      ])
        await client.unsafe(`analyze ${table}`);
      const started = performance.now();
      const preview = await retainOperationalEvidence({
        database,
        limit: 1000,
      });
      const previewMilliseconds = Math.round(performance.now() - started);
      const applyStarted = performance.now();
      const applied = await retainOperationalEvidence({
        database,
        limit: 1000,
        apply: true,
      });
      const applyMilliseconds = Math.round(performance.now() - applyStarted);
      expect(applied.counts).toEqual(preview.counts);
      for (const kind of [
        "evaluations",
        "syntheticRuns",
        "outbox",
        "events",
      ] as const) {
        expect(applied.counts[kind]).toBeGreaterThan(105);
        expect(applied.counts[kind]).toBeLessThanOrEqual(1000);
      }
      const [retained] =
        await client`select count(*)::integer as recent from operational_synthetic_runs where completed_at>now()-interval '30 days'`;
      expect(retained!.recent).toBe(volume - expired);
      console.log(
        JSON.stringify({
          proof: "operational-retention-month",
          volumePerTable: volume,
          expiredBundles: expired,
          previewMilliseconds,
          applyMilliseconds,
          counts: applied.counts,
          recentRunsRetained: retained!.recent,
        }),
      );
    },
    // Bulk fixture insertion is opt-in; the service itself retains its 5s limit.
    300_000,
  );

  it("keeps a routine backlog batch bounded without loading history into the caller", async () => {
    const envelope = event("bulk", daysAgo(45));
    await client`
      insert into operational_event_outbox
        (id, contract_version, envelope, status, delivered_at, created_at, updated_at)
      select 'bulk:' || n, 1,
        ${JSON.stringify(envelope)}::jsonb || jsonb_build_object('eventId', 'bulk:' || n),
        'delivered', ${daysAgo(45).toISOString()}::timestamptz,
        ${daysAgo(45).toISOString()}::timestamptz, ${daysAgo(45).toISOString()}::timestamptz
      from generate_series(1, 5000) n
    `;
    await client`
      insert into operational_events
        (id, contract_version, kind, severity, outcome, authority, service, environment,
         subject_type, subject_id, correlation_id, occurred_at, observed_at, envelope, stored_at)
      select id, 1, 'test.retention', 'info', 'succeeded', 'airjam_authoritative',
        'operational_worker', 'test', 'service', 'operational_worker', id,
        created_at, created_at, envelope, delivered_at
      from operational_event_outbox
    `;
    const started = performance.now();
    const result = await retainOperationalEvidence({ database, apply: true });
    const duration = Math.round(performance.now() - started);
    expect(result.counts).toMatchObject({ outbox: 200, events: 200 });
    expect(await ids()).toHaveLength(4800);
    console.log(
      JSON.stringify({
        proof: "operational-retention-backlog",
        pairs: 5000,
        durationMilliseconds: duration,
        counts: result.counts,
      }),
    );
  }, 15_000);
});

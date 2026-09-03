import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { afterAll, describe, expect, it } from "vitest";
import { runtimeDatabaseSchema, type ServerDatabase } from "../src/db";
import { createDatabaseServerOperationalEventPublisher } from "../src/operations/operational-event-publisher";

const databaseUrl = process.env.AIR_JAM_TEST_DATABASE_URL?.trim();
const describeWithPostgres = databaseUrl ? describe : describe.skip;

describeWithPostgres(
  "server operational event publisher PostgreSQL contract",
  () => {
    const client = postgres(databaseUrl!, { max: 2 });
    const database = drizzle(client, {
      schema: runtimeDatabaseSchema,
    }) as ServerDatabase;
    const suffix = crypto.randomUUID();
    const component = `server-publisher-test:${suffix}`;

    afterAll(async () => {
      await client`
      delete from operational_event_outbox
      where envelope -> 'source' ->> 'component' = ${component}
         or id = ${`runtime-report:${suffix}`}
    `;
      await client.end();
    });

    it("persists one bounded structured server failure without raw exception data", async () => {
      const publisher = createDatabaseServerOperationalEventPublisher({
        database,
        environment: "test",
        instanceId: "server:test-instance",
      });
      await publisher.publishFailure({
        code: "runtime_usage.persistence_failed",
        failureClass: "dependency",
        summary: "The runtime-usage ledger could not persist an event.",
        retryable: true,
        component,
        subject: { type: "runtime_session", id: `runtime:${suffix}` },
        correlation: {
          contractVersion: 1,
          correlationId: `runtime:${suffix}`,
          runtimeSessionId: `runtime:${suffix}`,
        },
        occurredAt: new Date("2020-01-01T00:00:00.000Z"),
        details: {
          operation: "persist_usage",
          authorization: "Bearer must-not-persist",
        },
      });

      const rows = await client`
      select envelope
      from operational_event_outbox
      where envelope -> 'source' ->> 'component' = ${component}
    `;
      expect(rows).toHaveLength(1);
      expect(rows[0]!.envelope).toMatchObject({
        kind: "runtime_usage.persistence_failed",
        authority: "airjam_authoritative",
        source: {
          service: "realtime_server",
          environment: "test",
          instanceId: "server:test-instance",
        },
        payload: {
          failure: {
            code: "runtime_usage.persistence_failed",
            class: "dependency",
            retryable: true,
            details: { operation: "persist_usage" },
          },
        },
      });
      expect(JSON.stringify(rows[0]!.envelope)).not.toContain(
        "must-not-persist",
      );
    });

    it("persists an idempotent runtime-reported crash without raw browser error data", async () => {
      const publisher = createDatabaseServerOperationalEventPublisher({
        database,
        environment: "test",
      });
      const report = {
        reportId: suffix,
        roomId: "ROOM1",
        runtimeSessionId: `runtime:${suffix}`,
        controllerId: `controller:${suffix}`,
        gameId: "fixture-game",
        role: "controller" as const,
        code: "AJ_RUNTIME_RENDER_CRASH" as const,
        errorName: "TypeError",
        digest: "deadbeef",
        clientOccurredAt: "2020-01-01T00:00:00.000Z",
      };

      await publisher.publishRuntimeErrorReport(report);
      await publisher.publishRuntimeErrorReport(report);
      await expect(
        publisher.publishRuntimeErrorReport({
          ...report,
          digest: "cafebabe",
        }),
      ).rejects.toMatchObject({ name: "OperationalEventConflictError" });

      const rows = await client`
      select envelope
      from operational_event_outbox
      where id = ${`runtime-report:${suffix}`}
    `;
      expect(rows).toHaveLength(1);
      expect(rows[0]!.envelope).toMatchObject({
        kind: "hosted_runtime.render_crashed",
        authority: "runtime_reported",
        source: {
          service: "hosted_runtime",
          component: "controller-render-boundary",
          environment: "test",
        },
        subject: {
          type: "runtime_session",
          id: `runtime:${suffix}`,
        },
        correlation: {
          roomId: "ROOM1",
          controllerId: `controller:${suffix}`,
          gameId: "fixture-game",
        },
        payload: {
          report: {
            code: "AJ_RUNTIME_RENDER_CRASH",
            errorName: "TypeError",
            digest: "deadbeef",
          },
        },
      });
      expect(JSON.stringify(rows[0]!.envelope)).not.toContain("message");
      expect(JSON.stringify(rows[0]!.envelope)).not.toContain("stack");
      expect(JSON.stringify(rows[0]!.envelope)).not.toContain("url");
    });
  },
);

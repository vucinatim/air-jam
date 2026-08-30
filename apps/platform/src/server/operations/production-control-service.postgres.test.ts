import * as schema from "@/db/schema";
import { operationalControlEvents, operationalLaneControls } from "@/db/schema";
import { eq, like } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import {
  OperationalControlConflictError,
  setOperationalLaneControl,
} from "./production-control-service";

const databaseUrl = process.env.AIR_JAM_TEST_DATABASE_URL?.trim();
const describeWithPostgres = databaseUrl ? describe : describe.skip;

describeWithPostgres("production control PostgreSQL invariants", () => {
  const client = postgres(databaseUrl!, { max: 4 });
  const database = drizzle(client, { schema });
  const prefix = `production-control-test:${crypto.randomUUID()}`;

  beforeEach(async () => {
    await database
      .delete(operationalControlEvents)
      .where(like(operationalControlEvents.idempotencyKey, `${prefix}%`));
    await database
      .delete(operationalLaneControls)
      .where(eq(operationalLaneControls.lane, "preview_capacity"));
  });

  afterAll(async () => {
    await database
      .delete(operationalControlEvents)
      .where(like(operationalControlEvents.idempotencyKey, `${prefix}%`));
    await database
      .delete(operationalLaneControls)
      .where(eq(operationalLaneControls.lane, "preview_capacity"));
    await client.end();
  });

  it("allows exactly one mutation for an optimistic revision", async () => {
    const attempts = await Promise.allSettled([
      setOperationalLaneControl({
        database,
        input: {
          lane: "preview_capacity",
          mode: "paused",
          reason: "First concurrent mutation",
          retryAfterSeconds: 60,
          expectedRevision: 0,
          actor: "test:one",
          idempotencyKey: `${prefix}:concurrent-one`,
        },
      }),
      setOperationalLaneControl({
        database,
        input: {
          lane: "preview_capacity",
          mode: "restricted",
          reason: "Second concurrent mutation",
          retryAfterSeconds: null,
          expectedRevision: 0,
          actor: "test:two",
          idempotencyKey: `${prefix}:concurrent-two`,
        },
      }),
    ]);

    expect(
      attempts.filter((attempt) => attempt.status === "fulfilled"),
    ).toHaveLength(1);
    const rejected = attempts.find((attempt) => attempt.status === "rejected");
    expect(rejected).toBeDefined();
    expect((rejected as PromiseRejectedResult).reason).toBeInstanceOf(
      OperationalControlConflictError,
    );

    const controls = await database.select().from(operationalLaneControls);
    const events = await database
      .select()
      .from(operationalControlEvents)
      .where(like(operationalControlEvents.idempotencyKey, `${prefix}%`));
    expect(
      controls.filter((control) => control.lane === "preview_capacity"),
    ).toHaveLength(1);
    expect(events).toHaveLength(1);
  });

  it("replays one identical idempotent mutation without another audit event", async () => {
    const input = {
      lane: "preview_capacity" as const,
      mode: "paused" as const,
      reason: "Replay proof",
      retryAfterSeconds: 60,
      expectedRevision: 0,
      actor: "test:replay",
      idempotencyKey: `${prefix}:replay`,
    };

    const first = await setOperationalLaneControl({ database, input });
    const replay = await setOperationalLaneControl({ database, input });
    expect(replay).toEqual(first);

    const events = await database
      .select()
      .from(operationalControlEvents)
      .where(eq(operationalControlEvents.idempotencyKey, input.idempotencyKey));
    expect(events).toHaveLength(1);
  });
});

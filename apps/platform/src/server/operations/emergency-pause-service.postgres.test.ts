import * as schema from "@/db/schema";
import { operationalLaneValues } from "@air-jam/database-contract";
import { eq, inArray, like } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import {
  applyOperationalEmergencyPause,
  OPERATIONAL_EMERGENCY_PAUSE_LANES,
  previewOperationalEmergencyPause,
} from "./emergency-pause-service";
import {
  listOperationalLaneControls,
  OperationalControlConflictError,
  setOperationalLaneControl,
} from "./production-control-service";

const databaseUrl = process.env.AIR_JAM_TEST_DATABASE_URL?.trim();
const describeWithPostgres = databaseUrl ? describe : describe.skip;

describeWithPostgres("atomic emergency pause PostgreSQL contract", () => {
  const client = postgres(databaseUrl!, { max: 6 });
  const database = drizzle(client, { schema });
  const prefix = `emergency-pause-test:${crypto.randomUUID()}`;
  const input = {
    actor: `${prefix}:operator`,
    reason: "Stop new expensive work during incident",
    idempotencyKey: `${prefix}:incident`,
    retryAfterSeconds: 120,
  };

  const clean = async () => {
    await database
      .delete(schema.operationalControlEvents)
      .where(
        like(schema.operationalControlEvents.idempotencyKey, `%${prefix}%`),
      );
    await database
      .delete(schema.operationalLaneControls)
      .where(
        inArray(schema.operationalLaneControls.lane, operationalLaneValues),
      );
  };
  beforeEach(clean);
  afterAll(async () => {
    await clean();
    await client.end();
  });

  const events = () =>
    database
      .select()
      .from(schema.operationalControlEvents)
      .where(
        like(schema.operationalControlEvents.idempotencyKey, `%${prefix}%`),
      );

  it("pauses the entire expensive scope while preserving restricted prior state and recovery lanes", async () => {
    for (const lane of [
      "release_processing",
      "lifecycle_cleanup",
      "product_telemetry",
    ] as const) {
      await setOperationalLaneControl({
        database,
        input: {
          lane,
          mode: "restricted",
          expectedRevision: 0,
          actor: input.actor,
          reason: "Existing policy",
          retryAfterSeconds: null,
          idempotencyKey: `${prefix}:setup:${lane}`,
        },
      });
    }
    const before = await listOperationalLaneControls({ database });
    const beforeEvents = await events();
    const preview = await previewOperationalEmergencyPause({ database, input });
    expect(preview).toMatchObject({ replayed: false, wouldApply: true });
    expect(await listOperationalLaneControls({ database })).toEqual(before);
    expect(await events()).toEqual(beforeEvents);

    const result = await applyOperationalEmergencyPause({ database, input });
    expect(result.replayed).toBe(false);
    expect(result.lanes.map(({ lane }) => lane)).toEqual(
      OPERATIONAL_EMERGENCY_PAUSE_LANES,
    );
    expect(
      result.lanes.every(
        ({ applied, current }) =>
          applied.mode === "paused" &&
          current.mode === "paused" &&
          applied.retryAfterSeconds === 120,
      ),
    ).toBe(true);
    expect(
      result.lanes.find(({ lane }) => lane === "release_processing"),
    ).toMatchObject({
      previous: { mode: "restricted", revision: 1 },
      applied: { mode: "paused", revision: 2 },
    });
    const after = await listOperationalLaneControls({ database });
    expect(
      after.filter(({ lane }) =>
        result.scope.excludedLanes.includes(
          lane as "lifecycle_cleanup" | "product_telemetry",
        ),
      ),
    ).toEqual(
      before.filter(
        ({ lane }) =>
          lane === "lifecycle_cleanup" || lane === "product_telemetry",
      ),
    );
    expect(await events()).toHaveLength(beforeEvents.length + 11);
  });

  it("serializes concurrent identical commands and reports original receipt without re-pausing a restored lane", async () => {
    const results = await Promise.all([
      applyOperationalEmergencyPause({ database, input }),
      applyOperationalEmergencyPause({ database, input }),
    ]);
    expect(results.map(({ replayed }) => replayed).sort()).toEqual([
      false,
      true,
    ]);
    expect(results[0].lanes).toEqual(results[1].lanes);
    expect(await events()).toHaveLength(11);
    const restored = await setOperationalLaneControl({
      database,
      input: {
        lane: "release_submission",
        mode: "normal",
        expectedRevision: 1,
        actor: input.actor,
        reason: "Dependency recovered",
        retryAfterSeconds: null,
        idempotencyKey: `${prefix}:restore`,
      },
    });
    const preview = await previewOperationalEmergencyPause({ database, input });
    expect(preview).toMatchObject({ replayed: true, wouldApply: false });
    expect(
      preview.lanes.find(({ lane }) => lane === restored.lane)?.current,
    ).toEqual(restored);
    const replay = await applyOperationalEmergencyPause({ database, input });
    expect(replay.replayed).toBe(true);
    expect(
      replay.lanes.find(({ lane }) => lane === restored.lane),
    ).toMatchObject({
      previous: { mode: "normal", revision: 0 },
      applied: { mode: "paused", revision: 1 },
      current: restored,
    });
    expect(await events()).toHaveLength(12);
  });

  it.each([
    { actor: "changed-actor" },
    { reason: "changed reason" },
    { retryAfterSeconds: 30 },
  ])(
    "rejects conflicting reused command intent without mutation: %j",
    async (change) => {
      await applyOperationalEmergencyPause({ database, input });
      const before = await listOperationalLaneControls({ database });
      for (const operation of [
        previewOperationalEmergencyPause,
        applyOperationalEmergencyPause,
      ]) {
        await expect(
          operation({ database, input: { ...input, ...change } }),
        ).rejects.toBeInstanceOf(OperationalControlConflictError);
      }
      expect(await listOperationalLaneControls({ database })).toEqual(before);
      expect(await events()).toHaveLength(11);
    },
  );

  it("rolls back every lane and event if a later lane write fails", async () => {
    let eventWrites = 0;
    const cause = new Error("Injected audit storage failure");
    const failingDatabase = {
      transaction: (callback: Parameters<typeof database.transaction>[0]) =>
        database.transaction(async (tx) =>
          callback(
            new Proxy(tx, {
              get(target, property, receiver) {
                if (property === "insert")
                  return (table: Parameters<typeof tx.insert>[0]) => {
                    if (
                      table === schema.operationalControlEvents &&
                      ++eventWrites === 6
                    )
                      throw cause;
                    return target.insert(table);
                  };
                const value = Reflect.get(target, property, receiver);
                return typeof value === "function" ? value.bind(target) : value;
              },
            }),
          ),
        ),
    } as unknown as typeof database;
    await expect(
      applyOperationalEmergencyPause({ database: failingDatabase, input }),
    ).rejects.toBe(cause);
    expect(eventWrites).toBe(6);
    expect(await events()).toHaveLength(0);
    expect(
      (await listOperationalLaneControls({ database })).every(
        ({ mode, revision }) => mode === "normal" && revision === 0,
      ),
    ).toBe(true);
    await expect(
      applyOperationalEmergencyPause({ database, input }),
    ).resolves.toMatchObject({ replayed: false });
  });

  it("rejects an incomplete colliding receipt rather than partially replaying or pausing", async () => {
    await setOperationalLaneControl({
      database,
      input: {
        ...input,
        lane: "game_creation",
        mode: "paused",
        expectedRevision: 0,
        idempotencyKey: `emergency-pause:${input.idempotencyKey}:game_creation`,
      },
    });
    const before = await listOperationalLaneControls({ database });
    await expect(
      applyOperationalEmergencyPause({ database, input }),
    ).rejects.toBeInstanceOf(OperationalControlConflictError);
    expect(await listOperationalLaneControls({ database })).toEqual(before);
    expect(await events()).toHaveLength(1);
    expect(
      await database
        .select()
        .from(schema.operationalLaneControls)
        .where(eq(schema.operationalLaneControls.lane, "release_processing")),
    ).toHaveLength(0);
  });
});

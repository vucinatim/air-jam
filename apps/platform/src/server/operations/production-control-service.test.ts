import { db as platformDb } from "@/db";
import { operationalControlEvents, operationalLaneControls } from "@/db/schema";
import {
  operationalLaneValues,
  type OperationalLaneControlSnapshot,
} from "@air-jam/database-contract";
import { describe, expect, it } from "vitest";
import {
  assertOperationalLaneAccepting,
  buildOperationalLaneControlList,
  decideOperationalLaneAdmission,
  getDefaultOperationalLaneControl,
  OperationalAdmissionDeniedError,
  OperationalControlConflictError,
  setOperationalLaneControl,
} from "./production-control-service";

type Database = typeof platformDb;
type LaneRow = typeof operationalLaneControls.$inferSelect;
type EventRow = typeof operationalControlEvents.$inferSelect;

const makeLaneRow = (overrides: Partial<LaneRow> = {}): LaneRow => ({
  lane: "release_processing",
  mode: "normal",
  reason: "Initial control",
  retryAfterSeconds: null,
  revision: 1,
  updatedBy: "ops@example.invalid",
  updatedAt: new Date("2026-08-29T12:00:00.000Z"),
  ...overrides,
});

const createFakeDatabase = ({
  initialControl = null,
}: {
  initialControl?: LaneRow | null;
} = {}) => {
  let control = initialControl;
  let event: EventRow | null = null;
  let eventInsertCount = 0;
  let transactionExecuteCount = 0;

  const query = {
    operationalLaneControls: {
      findFirst: async () => control ?? undefined,
    },
    operationalControlEvents: {
      findFirst: async () => event ?? undefined,
    },
  };

  const transactionDatabase = {
    query,
    execute: async () => {
      transactionExecuteCount += 1;
      return [];
    },
    update: (table: unknown) => {
      if (table !== operationalLaneControls) {
        throw new Error("Unexpected update table.");
      }
      return {
        set: (values: Partial<LaneRow>) => ({
          where: () => ({
            returning: async () => {
              if (!control) return [];
              control = { ...control, ...values };
              return [control];
            },
          }),
        }),
      };
    },
    insert: (table: unknown) => {
      if (table === operationalLaneControls) {
        return {
          values: (values: LaneRow) => ({
            onConflictDoNothing: () => ({
              returning: async () => {
                if (control) return [];
                control = values;
                return [control];
              },
            }),
          }),
        };
      }
      if (table === operationalControlEvents) {
        return {
          values: async (values: EventRow) => {
            event = values;
            eventInsertCount += 1;
          },
        };
      }
      throw new Error("Unexpected insert table.");
    },
  };

  const database = {
    query,
    select: () => ({
      from: async () => (control ? [control] : []),
    }),
    transaction: async <T>(
      callback: (tx: typeof transactionDatabase) => Promise<T>,
    ) => callback(transactionDatabase),
  } as unknown as Database;

  return {
    database,
    getControl: () => control,
    getEvent: () => event,
    getEventInsertCount: () => eventInsertCount,
    getTransactionExecuteCount: () => transactionExecuteCount,
  };
};

describe("production control service", () => {
  it("returns every canonical lane and treats missing rows as normal revision zero", () => {
    const controls = buildOperationalLaneControlList([
      makeLaneRow({ lane: "release_processing", mode: "paused" }),
    ]);

    expect(controls).toHaveLength(operationalLaneValues.length);
    expect(controls.map((control) => control.lane)).toEqual(
      operationalLaneValues,
    );
    expect(
      controls.find((control) => control.lane === "release_processing"),
    ).toMatchObject({ mode: "paused", revision: 1 });
    expect(
      controls.find((control) => control.lane === "media_ingestion"),
    ).toEqual(getDefaultOperationalLaneControl("media_ingestion"));
  });

  it("denies paused lanes with stable retry guidance", async () => {
    const control: OperationalLaneControlSnapshot = {
      ...getDefaultOperationalLaneControl("artifact_ingestion"),
      mode: "paused",
      reason: "Storage dependency unavailable",
      retryAfterSeconds: 120,
      revision: 3,
    };
    const decision = decideOperationalLaneAdmission({
      control,
      decisionId: "decision-1",
    });

    expect(decision).toEqual({
      contractVersion: 1,
      decisionId: "decision-1",
      lane: "artifact_ingestion",
      controlStatus: "available",
      mode: "paused",
      outcome: "denied",
      reason: "lane_paused",
      retryAfterSeconds: 120,
      controlRevision: 3,
    });

    const { database } = createFakeDatabase({
      initialControl: makeLaneRow({
        lane: "artifact_ingestion",
        mode: "paused",
        retryAfterSeconds: 120,
      }),
    });
    await expect(
      assertOperationalLaneAccepting({
        database,
        lane: "artifact_ingestion",
        decisionId: "decision-2",
      }),
    ).rejects.toBeInstanceOf(OperationalAdmissionDeniedError);
  });

  it("keeps restricted lanes open for the quota layer to evaluate", () => {
    const decision = decideOperationalLaneAdmission({
      control: {
        ...getDefaultOperationalLaneControl("preview_capacity"),
        mode: "restricted",
        reason: "Enforce configured preview allowances",
        revision: 2,
      },
      decisionId: "decision-restricted",
    });

    expect(decision).toMatchObject({
      controlStatus: "available",
      mode: "restricted",
      outcome: "allowed",
      reason: null,
      controlRevision: 2,
    });
  });

  it("fails closed with a typed decision when control authority is unavailable", async () => {
    const database = {
      query: {
        operationalLaneControls: {
          findFirst: async () => {
            throw new Error("database unavailable");
          },
        },
      },
    } as unknown as Database;

    await expect(
      assertOperationalLaneAccepting({
        database,
        lane: "release_processing",
        decisionId: "decision-unavailable",
      }),
    ).rejects.toMatchObject({
      decision: {
        contractVersion: 1,
        decisionId: "decision-unavailable",
        lane: "release_processing",
        controlStatus: "unavailable",
        mode: null,
        outcome: "denied",
        reason: "control_unavailable",
        retryAfterSeconds: 30,
        controlRevision: null,
      },
    });
  });

  it("applies an optimistic audited mutation and replays its idempotency key", async () => {
    const fake = createFakeDatabase();
    const input = {
      lane: "release_processing" as const,
      mode: "paused" as const,
      reason: "Protect browser worker capacity",
      retryAfterSeconds: 300,
      expectedRevision: 0,
      actor: "agent:incident-123",
      idempotencyKey: "incident-123:pause-release-processing",
    };

    const first = await setOperationalLaneControl({
      database: fake.database,
      input,
      now: new Date("2026-08-29T14:00:00.000Z"),
      eventId: "event-1",
    });
    const replay = await setOperationalLaneControl({
      database: fake.database,
      input,
      now: new Date("2026-08-29T15:00:00.000Z"),
      eventId: "event-2",
    });

    expect(first).toEqual(replay);
    expect(first).toMatchObject({
      lane: "release_processing",
      mode: "paused",
      revision: 1,
      updatedBy: "agent:incident-123",
      updatedAt: "2026-08-29T14:00:00.000Z",
    });
    expect(fake.getEvent()).toMatchObject({
      id: "event-1",
      expectedRevision: 0,
      previous: { mode: "normal", revision: 0 },
      next: { mode: "paused", revision: 1 },
    });
    expect(fake.getEventInsertCount()).toBe(1);
    expect(fake.getTransactionExecuteCount()).toBe(1);
  });

  it("rejects stale revisions and conflicting idempotency reuse", async () => {
    const stale = createFakeDatabase({
      initialControl: makeLaneRow({ revision: 2 }),
    });
    await expect(
      setOperationalLaneControl({
        database: stale.database,
        input: {
          lane: "release_processing",
          mode: "paused",
          reason: "Stale attempt",
          retryAfterSeconds: null,
          expectedRevision: 1,
          actor: "agent:test",
          idempotencyKey: "stale-key",
        },
      }),
    ).rejects.toThrow(/revision 2, not expected revision 1/u);

    const conflicting = createFakeDatabase();
    const baseInput = {
      lane: "release_processing" as const,
      mode: "paused" as const,
      reason: "First request",
      retryAfterSeconds: null,
      expectedRevision: 0,
      actor: "agent:test",
      idempotencyKey: "shared-key",
    };
    await setOperationalLaneControl({
      database: conflicting.database,
      input: baseInput,
    });
    await expect(
      setOperationalLaneControl({
        database: conflicting.database,
        input: { ...baseInput, mode: "normal" },
      }),
    ).rejects.toBeInstanceOf(OperationalControlConflictError);
  });
});

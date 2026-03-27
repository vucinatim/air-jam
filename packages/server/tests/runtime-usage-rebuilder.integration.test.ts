import { afterEach, describe, expect, it } from "vitest";
import { db } from "../src/db";
import {
  runtimeUsageControllerSegments,
  runtimeUsageDailyGameMetrics,
  runtimeUsageEligibleSegments,
  runtimeUsageEvents,
  runtimeUsageGameSegments,
  runtimeUsageGameSessionMetrics,
  runtimeUsageSessions,
} from "../src/db";
import { rebuildRuntimeUsageSessionFromLedger } from "../src/analytics/runtime-usage-rebuilder";
import { eq } from "drizzle-orm";

const maybeIt = db ? it : it.skip;

const insertLedgerFixture = async (runtimeSessionId: string) => {
  const runtimeDb = db;
  if (!runtimeDb) {
    return;
  }

  await runtimeDb.insert(runtimeUsageSessions).values({
    id: runtimeSessionId,
    roomId: "ROOM_REBUILD",
    appId: "aj_app_rebuild",
    hostVerifiedVia: "appId",
    startedAt: new Date("2026-03-27T10:00:00.000Z"),
  });

  await runtimeDb.insert(runtimeUsageEvents).values([
    {
      id: `${runtimeSessionId}:room`,
      kind: "room_created",
      occurredAt: new Date("2026-03-27T10:00:00.000Z"),
      runtimeSessionId,
      roomId: "ROOM_REBUILD",
      appId: "aj_app_rebuild",
      payload: {},
    },
    {
      id: `${runtimeSessionId}:game`,
      kind: "game_became_active",
      occurredAt: new Date("2026-03-27T10:00:00.000Z"),
      runtimeSessionId,
      roomId: "ROOM_REBUILD",
      appId: "aj_app_rebuild",
      gameId: "game-rebuild",
      payload: { activation: "host_create_room" },
    },
    {
      id: `${runtimeSessionId}:join`,
      kind: "controller_joined",
      occurredAt: new Date("2026-03-27T10:00:01.000Z"),
      runtimeSessionId,
      roomId: "ROOM_REBUILD",
      appId: "aj_app_rebuild",
      gameId: "game-rebuild",
      payload: { controllerId: "ctrl-1" },
    },
    {
      id: `${runtimeSessionId}:close`,
      kind: "room_closed",
      occurredAt: new Date("2026-03-27T10:01:01.000Z"),
      runtimeSessionId,
      roomId: "ROOM_REBUILD",
      appId: "aj_app_rebuild",
      gameId: "game-rebuild",
      payload: { reason: "host_disconnected" },
    },
  ]);
};

afterEach(async () => {
  const runtimeDb = db;
  if (!runtimeDb) {
    return;
  }

  await runtimeDb.delete(runtimeUsageDailyGameMetrics);
  await runtimeDb.delete(runtimeUsageGameSessionMetrics);
  await runtimeDb.delete(runtimeUsageEligibleSegments);
  await runtimeDb.delete(runtimeUsageGameSegments);
  await runtimeDb.delete(runtimeUsageControllerSegments);
  await runtimeDb.delete(runtimeUsageEvents);
  await runtimeDb.delete(runtimeUsageSessions);
});

describe("runtime usage rebuilder", () => {
  maybeIt("rebuilds session projections idempotently from the raw ledger", async () => {
    const runtimeDb = db!;
    const runtimeSessionId = `runtime_rebuild_${crypto.randomUUID()}`;
    await insertLedgerFixture(runtimeSessionId);

    await rebuildRuntimeUsageSessionFromLedger(
      runtimeDb,
      runtimeSessionId,
      new Date("2026-03-27T10:01:01.000Z"),
    );
    await rebuildRuntimeUsageSessionFromLedger(
      runtimeDb,
      runtimeSessionId,
      new Date("2026-03-27T10:01:01.000Z"),
    );

    const [controllerSegments, gameSegments, eligibleSegments, sessionMetrics, dailyMetrics] =
      await Promise.all([
        runtimeDb
          .select()
          .from(runtimeUsageControllerSegments)
          .where(eq(runtimeUsageControllerSegments.runtimeSessionId, runtimeSessionId)),
        runtimeDb
          .select()
          .from(runtimeUsageGameSegments)
          .where(eq(runtimeUsageGameSegments.runtimeSessionId, runtimeSessionId)),
        runtimeDb
          .select()
          .from(runtimeUsageEligibleSegments)
          .where(eq(runtimeUsageEligibleSegments.runtimeSessionId, runtimeSessionId)),
        runtimeDb
          .select()
          .from(runtimeUsageGameSessionMetrics)
          .where(eq(runtimeUsageGameSessionMetrics.runtimeSessionId, runtimeSessionId)),
        runtimeDb
          .select()
          .from(runtimeUsageDailyGameMetrics)
          .where(eq(runtimeUsageDailyGameMetrics.gameId, "game-rebuild")),
      ]);

    expect(controllerSegments).toHaveLength(1);
    expect(gameSegments).toHaveLength(1);
    expect(eligibleSegments).toHaveLength(1);
    expect(sessionMetrics).toHaveLength(1);
    expect(dailyMetrics).toHaveLength(1);
    expect(sessionMetrics[0]).toEqual(
      expect.objectContaining({
        controllerSeconds: 60,
        eligiblePlaytimeSeconds: 60,
        peakConcurrentControllers: 1,
      }),
    );
  });

  maybeIt("removes stale session and daily metrics when replayed ledger no longer produces gameplay", async () => {
    const runtimeDb = db!;
    const runtimeSessionId = `runtime_rebuild_${crypto.randomUUID()}`;
    await insertLedgerFixture(runtimeSessionId);

    await rebuildRuntimeUsageSessionFromLedger(
      runtimeDb,
      runtimeSessionId,
      new Date("2026-03-27T10:01:01.000Z"),
    );

    await runtimeDb
      .delete(runtimeUsageEvents)
      .where(eq(runtimeUsageEvents.runtimeSessionId, runtimeSessionId));
    await runtimeDb.insert(runtimeUsageEvents).values({
      id: `${runtimeSessionId}:room-only`,
      kind: "room_created",
      occurredAt: new Date("2026-03-27T10:00:00.000Z"),
      runtimeSessionId,
      roomId: "ROOM_REBUILD",
      appId: "aj_app_rebuild",
      payload: {},
    });

    await rebuildRuntimeUsageSessionFromLedger(
      runtimeDb,
      runtimeSessionId,
      new Date("2026-03-27T10:01:01.000Z"),
    );

    const [gameSegments, eligibleSegments, sessionMetrics, dailyMetrics] =
      await Promise.all([
        runtimeDb
          .select()
          .from(runtimeUsageGameSegments)
          .where(eq(runtimeUsageGameSegments.runtimeSessionId, runtimeSessionId)),
        runtimeDb
          .select()
          .from(runtimeUsageEligibleSegments)
          .where(eq(runtimeUsageEligibleSegments.runtimeSessionId, runtimeSessionId)),
        runtimeDb
          .select()
          .from(runtimeUsageGameSessionMetrics)
          .where(eq(runtimeUsageGameSessionMetrics.runtimeSessionId, runtimeSessionId)),
        runtimeDb
          .select()
          .from(runtimeUsageDailyGameMetrics)
          .where(eq(runtimeUsageDailyGameMetrics.gameId, "game-rebuild")),
      ]);

    expect(gameSegments).toHaveLength(0);
    expect(eligibleSegments).toHaveLength(0);
    expect(sessionMetrics).toHaveLength(0);
    expect(dailyMetrics).toHaveLength(0);
  });
});

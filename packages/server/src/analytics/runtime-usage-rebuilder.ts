import { asc, eq } from "drizzle-orm";
import {
  type ServerDatabase,
  runtimeUsageControllerSegments,
  runtimeUsageEligibleSegments,
  runtimeUsageEvents,
  runtimeUsageGameSegments,
} from "../db.js";
import { refreshRuntimeUsageAggregatesForSession } from "./runtime-usage-aggregator.js";
import { acquireRuntimeUsageSessionLock } from "./runtime-usage-ledger.js";
import { rebuildRuntimeUsageProjectionFromEvents } from "./runtime-usage-rebuild-domain.js";
import type { RuntimeUsageEvent } from "./runtime-usage.js";

const toRuntimeUsageEvent = (
  row: typeof runtimeUsageEvents.$inferSelect,
): RuntimeUsageEvent => ({
  id: row.id,
  kind: row.kind as RuntimeUsageEvent["kind"],
  occurredAt: row.occurredAt.getTime(),
  runtimeSessionId: row.runtimeSessionId ?? undefined,
  roomId: row.roomId ?? undefined,
  appId: row.appId ?? undefined,
  gameId: row.gameId ?? undefined,
  hostVerifiedVia: row.hostVerifiedVia as RuntimeUsageEvent["hostVerifiedVia"],
  hostVerifiedOrigin: row.hostVerifiedOrigin ?? undefined,
  payload: row.payload,
});

export const rebuildRuntimeUsageSessionFromLedger = async (
  db: ServerDatabase,
  runtimeSessionId: string,
  referenceTime: Date,
): Promise<void> =>
  db.transaction(async (tx) => {
    await acquireRuntimeUsageSessionLock(tx, runtimeSessionId);
    const ledgerRows = await tx
      .select()
      .from(runtimeUsageEvents)
      .where(eq(runtimeUsageEvents.runtimeSessionId, runtimeSessionId))
      .orderBy(asc(runtimeUsageEvents.occurredAt), asc(runtimeUsageEvents.id));

    const events = ledgerRows.map(toRuntimeUsageEvent);
    const projection = rebuildRuntimeUsageProjectionFromEvents(events);

    await tx
      .delete(runtimeUsageControllerSegments)
      .where(
        eq(runtimeUsageControllerSegments.runtimeSessionId, runtimeSessionId),
      );
    await tx
      .delete(runtimeUsageEligibleSegments)
      .where(
        eq(runtimeUsageEligibleSegments.runtimeSessionId, runtimeSessionId),
      );
    await tx
      .delete(runtimeUsageGameSegments)
      .where(eq(runtimeUsageGameSegments.runtimeSessionId, runtimeSessionId));

    if (projection.controllerSegments.length > 0) {
      await tx.insert(runtimeUsageControllerSegments).values(
        projection.controllerSegments.map((segment) => ({
          id: segment.id,
          runtimeSessionId: segment.runtimeSessionId,
          roomId: segment.roomId,
          appId: segment.appId ?? null,
          controllerId: segment.controllerId,
          startedAt: segment.startedAt,
          endedAt: segment.endedAt,
          startEventId: segment.startEventId,
          endEventId: segment.endEventId,
          endReason: segment.endReason,
        })),
      );
    }

    if (projection.gameSegments.length > 0) {
      await tx.insert(runtimeUsageGameSegments).values(
        projection.gameSegments.map((segment) => ({
          id: segment.id,
          runtimeSessionId: segment.runtimeSessionId,
          roomId: segment.roomId,
          appId: segment.appId ?? null,
          gameId: segment.gameId,
          startedAt: segment.startedAt,
          endedAt: segment.endedAt,
          startEventId: segment.startEventId,
          endEventId: segment.endEventId,
          startReason: segment.startReason,
          endReason: segment.endReason,
        })),
      );
    }

    if (projection.eligibleSegments.length > 0) {
      await tx.insert(runtimeUsageEligibleSegments).values(
        projection.eligibleSegments.map((segment) => ({
          id: segment.id,
          runtimeSessionId: segment.runtimeSessionId,
          roomId: segment.roomId,
          appId: segment.appId ?? null,
          gameId: segment.gameId ?? null,
          startedAt: segment.startedAt,
          endedAt: segment.endedAt,
          startEventId: segment.startEventId,
          endEventId: segment.endEventId,
          startReason: segment.startReason,
          endReason: segment.endReason,
        })),
      );
    }

    await refreshRuntimeUsageAggregatesForSession(
      tx,
      runtimeSessionId,
      referenceTime,
    );
  });

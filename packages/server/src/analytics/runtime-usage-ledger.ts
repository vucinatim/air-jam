import { db, runtimeUsageEvents, runtimeUsageSessions } from "../db.js";
import type { ServerLogger } from "../logging/logger.js";
import { refreshRuntimeUsageAggregatesForSession } from "./runtime-usage-aggregator.js";
import { projectRuntimeUsageEventToSegments } from "./runtime-usage-projector.js";
import type {
  RuntimeUsageEvent,
  RuntimeUsagePublisher,
} from "./runtime-usage.js";

export const createDatabaseRuntimeUsageLedgerPublisher = (
  logger: ServerLogger,
): RuntimeUsagePublisher => {
  const ledgerLogger = logger.child({ component: "runtime-usage-ledger" });

  return {
    publish: (event) => {
      if (!db) {
        return;
      }

      void persistRuntimeUsageEvent(event).catch((err: unknown) => {
        ledgerLogger.warn(
          {
            err,
            eventId: event.id,
            kind: event.kind,
            runtimeSessionId: event.runtimeSessionId,
            roomId: event.roomId,
          },
          "Failed to persist runtime usage event",
        );
      });
    },
  };
};

const persistRuntimeUsageEvent = async (
  event: RuntimeUsageEvent,
): Promise<void> => {
  if (!db) {
    return;
  }

  await db.transaction(async (tx) => {
    if (
      event.runtimeSessionId &&
      event.roomId &&
      event.runtimeSessionStartedAt !== undefined
    ) {
      await tx
        .insert(runtimeUsageSessions)
        .values({
          id: event.runtimeSessionId,
          roomId: event.roomId,
          appId: event.appId,
          hostVerifiedVia: event.hostVerifiedVia,
          hostVerifiedOrigin: event.hostVerifiedOrigin,
          startedAt: new Date(event.runtimeSessionStartedAt),
        })
        .onConflictDoNothing();
    }

    const insertedEvents = await tx
      .insert(runtimeUsageEvents)
      .values({
        id: event.id,
        kind: event.kind,
        occurredAt: new Date(event.occurredAt),
        runtimeSessionId: event.runtimeSessionId,
        roomId: event.roomId,
        appId: event.appId,
        gameId: event.gameId,
        hostVerifiedVia: event.hostVerifiedVia,
        hostVerifiedOrigin: event.hostVerifiedOrigin,
        payload: event.payload ?? {},
      })
      .onConflictDoNothing()
      .returning({ id: runtimeUsageEvents.id });

    if (insertedEvents.length === 0) {
      return;
    }

    await projectRuntimeUsageEventToSegments(tx, event);

    if (event.runtimeSessionId) {
      await refreshRuntimeUsageAggregatesForSession(
        tx,
        event.runtimeSessionId,
        new Date(event.occurredAt),
      );
    }
  });
};

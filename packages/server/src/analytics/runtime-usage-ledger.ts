import { normalizeUnknownOperationalFailure } from "@air-jam/operations-contract";
import {
  runtimeUsageEvents,
  runtimeUsageSessions,
  type ServerDatabase,
} from "../db.js";
import type { ServerLogger } from "../logging/logger.js";
import {
  publishServerOperationalFailureSafely,
  type ServerOperationalEventPublisher,
} from "../operations/operational-event-publisher.js";
import { refreshRuntimeUsageAggregatesForSession } from "./runtime-usage-aggregator.js";
import { projectRuntimeUsageEventToSegments } from "./runtime-usage-projector.js";
import type {
  RuntimeUsageEvent,
  RuntimeUsagePublisher,
} from "./runtime-usage.js";

export const createDatabaseRuntimeUsageLedgerPublisher = (
  logger: ServerLogger,
  db: ServerDatabase | null,
  operationalEventPublisher?: ServerOperationalEventPublisher,
): RuntimeUsagePublisher => {
  const ledgerLogger = logger.child({ component: "runtime-usage-ledger" });

  return {
    publish: (event) => {
      if (!db) {
        return;
      }

      void persistRuntimeUsageEvent(db, event).catch((err: unknown) => {
        const failure = normalizeUnknownOperationalFailure({
          error: err,
          code: "runtime_usage.persistence_failed",
          summary:
            "The realtime runtime-usage ledger could not persist an event.",
          retryable: true,
          details: {
            failedEventId: event.id,
            failedEventKind: event.kind,
          },
        });
        ledgerLogger.warn(
          {
            failure,
            eventId: event.id,
            kind: event.kind,
            runtimeSessionId: event.runtimeSessionId,
            roomId: event.roomId,
          },
          "Failed to persist runtime usage event",
        );
        if (operationalEventPublisher) {
          const subjectId =
            event.runtimeSessionId ?? event.roomId ?? "runtime-usage-ledger";
          publishServerOperationalFailureSafely({
            publisher: operationalEventPublisher,
            logger: ledgerLogger,
            input: {
              code: "runtime_usage.persistence_failed",
              failureClass: "dependency",
              summary:
                "The realtime runtime-usage ledger could not persist an event.",
              retryable: true,
              component: "runtime-usage-ledger",
              subject: {
                type: event.runtimeSessionId ? "runtime_session" : "service",
                id: subjectId,
              },
              correlation: {
                contractVersion: 1,
                correlationId: event.runtimeSessionId
                  ? `runtime-usage:${event.runtimeSessionId}`
                  : `runtime-usage-event:${event.id}`,
                ...(event.runtimeSessionId
                  ? { runtimeSessionId: event.runtimeSessionId }
                  : {}),
                ...(event.roomId ? { roomId: event.roomId } : {}),
              },
              occurredAt: new Date(event.occurredAt),
              details: {
                failedEventId: event.id,
                failedEventKind: event.kind,
              },
            },
          });
        }
      });
    },
  };
};

const persistRuntimeUsageEvent = async (
  db: ServerDatabase,
  event: RuntimeUsageEvent,
): Promise<void> => {
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

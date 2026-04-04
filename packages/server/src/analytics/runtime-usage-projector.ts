import { and, desc, eq, isNull } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import {
  runtimeUsageControllerSegments,
  runtimeUsageEligibleSegments,
  runtimeUsageGameSegments,
} from "../db.js";
import type { RuntimeUsageEvent } from "./runtime-usage.js";
import {
  buildControllerSegmentId,
  buildEligibleSegmentId,
  buildGameSegmentId,
} from "./runtime-usage-rebuild-domain.js";
import {
  projectRuntimeUsageEvent,
  type RuntimeUsageProjectionAction,
} from "./runtime-usage-projection-domain.js";

type RuntimeUsageDb = PostgresJsDatabase<Record<string, never>>;

export const projectRuntimeUsageEventToSegments = async (
  db: RuntimeUsageDb,
  event: RuntimeUsageEvent,
): Promise<void> => {
  if (!event.runtimeSessionId || !event.roomId) {
    return;
  }

  const openControllerSegments = await db
    .select({
      id: runtimeUsageControllerSegments.id,
      controllerId: runtimeUsageControllerSegments.controllerId,
    })
    .from(runtimeUsageControllerSegments)
    .where(
      and(
        eq(
          runtimeUsageControllerSegments.runtimeSessionId,
          event.runtimeSessionId,
        ),
        isNull(runtimeUsageControllerSegments.endedAt),
      ),
    );

  const [openGameSegment] = await db
    .select({
      id: runtimeUsageGameSegments.id,
      gameId: runtimeUsageGameSegments.gameId,
    })
    .from(runtimeUsageGameSegments)
    .where(
      and(
        eq(runtimeUsageGameSegments.runtimeSessionId, event.runtimeSessionId),
        isNull(runtimeUsageGameSegments.endedAt),
      ),
    )
    .orderBy(desc(runtimeUsageGameSegments.startedAt))
    .limit(1);

  const [openEligibleSegment] = await db
    .select({
      id: runtimeUsageEligibleSegments.id,
    })
    .from(runtimeUsageEligibleSegments)
    .where(
      and(
        eq(runtimeUsageEligibleSegments.runtimeSessionId, event.runtimeSessionId),
        isNull(runtimeUsageEligibleSegments.endedAt),
      ),
    )
    .orderBy(desc(runtimeUsageEligibleSegments.startedAt))
    .limit(1);

  const controllerId =
    typeof event.payload?.controllerId === "string"
      ? event.payload.controllerId
      : undefined;

  const actions = projectRuntimeUsageEvent(event, {
    openControllerCount: openControllerSegments.length,
    hasOpenControllerSegmentForController: controllerId
      ? openControllerSegments.some(
          (segment) => segment.controllerId === controllerId,
        )
      : false,
    openGameId: openGameSegment?.gameId,
    hasOpenGameSegment: Boolean(openGameSegment),
    hasOpenEligibleSegment: Boolean(openEligibleSegment),
  });

  for (const action of actions) {
    await applyProjectionAction(db, event, action);
  }
};

const applyProjectionAction = async (
  db: RuntimeUsageDb,
  event: RuntimeUsageEvent,
  action: RuntimeUsageProjectionAction,
): Promise<void> => {
  const occurredAt = new Date(event.occurredAt);

  switch (action.type) {
    case "open_controller_segment":
      await db.insert(runtimeUsageControllerSegments).values({
        id: buildControllerSegmentId(
          event.runtimeSessionId!,
          action.controllerId,
          event.id,
        ),
        runtimeSessionId: event.runtimeSessionId!,
        roomId: event.roomId!,
        appId: event.appId,
        controllerId: action.controllerId,
        startedAt: occurredAt,
        startEventId: event.id,
      });
      return;
    case "close_controller_segment":
      await db
        .update(runtimeUsageControllerSegments)
        .set({
          endedAt: occurredAt,
          endEventId: event.id,
          endReason: action.reason,
        })
        .where(
          and(
            eq(
              runtimeUsageControllerSegments.runtimeSessionId,
              event.runtimeSessionId!,
            ),
            eq(runtimeUsageControllerSegments.controllerId, action.controllerId),
            isNull(runtimeUsageControllerSegments.endedAt),
          ),
        );
      return;
    case "close_all_controller_segments":
      await db
        .update(runtimeUsageControllerSegments)
        .set({
          endedAt: occurredAt,
          endEventId: event.id,
          endReason: action.reason,
        })
        .where(
          and(
            eq(
              runtimeUsageControllerSegments.runtimeSessionId,
              event.runtimeSessionId!,
            ),
            isNull(runtimeUsageControllerSegments.endedAt),
          ),
        );
      return;
    case "open_game_segment":
      await db.insert(runtimeUsageGameSegments).values({
        id: buildGameSegmentId(event.runtimeSessionId!, action.gameId, event.id),
        runtimeSessionId: event.runtimeSessionId!,
        roomId: event.roomId!,
        appId: event.appId,
        gameId: action.gameId,
        startedAt: occurredAt,
        startEventId: event.id,
        startReason: action.reason,
      });
      return;
    case "close_all_game_segments":
      await db
        .update(runtimeUsageGameSegments)
        .set({
          endedAt: occurredAt,
          endEventId: event.id,
          endReason: action.reason,
        })
        .where(
          and(
            eq(runtimeUsageGameSegments.runtimeSessionId, event.runtimeSessionId!),
            isNull(runtimeUsageGameSegments.endedAt),
          ),
        );
      return;
    case "open_eligible_segment":
      await db.insert(runtimeUsageEligibleSegments).values({
        id: buildEligibleSegmentId(
          event.runtimeSessionId!,
          action.gameId,
          event.id,
        ),
        runtimeSessionId: event.runtimeSessionId!,
        roomId: event.roomId!,
        appId: event.appId,
        gameId: action.gameId,
        startedAt: occurredAt,
        startEventId: event.id,
        startReason: action.reason,
      });
      return;
    case "close_eligible_segment":
      await db
        .update(runtimeUsageEligibleSegments)
        .set({
          endedAt: occurredAt,
          endEventId: event.id,
          endReason: action.reason,
        })
        .where(
          and(
            eq(
              runtimeUsageEligibleSegments.runtimeSessionId,
              event.runtimeSessionId!,
            ),
            isNull(runtimeUsageEligibleSegments.endedAt),
          ),
        );
      return;
  }
};

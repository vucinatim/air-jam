import {
  buildRuntimeUsageDailyGameMetrics,
  buildRuntimeUsageGameSessionMetrics,
  type RuntimeUsageControllerSegment,
  type RuntimeUsageEligibleSegment,
  type RuntimeUsageGameSegment,
} from "./runtime-usage-aggregates-domain.js";
import {
  projectRuntimeUsageEvent,
  type RuntimeUsageProjectionAction,
} from "./runtime-usage-projection-domain.js";
import type { RuntimeUsageEvent } from "./runtime-usage.js";

export interface RebuiltRuntimeUsageControllerSegment
  extends RuntimeUsageControllerSegment {
  startEventId: string;
  endEventId?: string;
  endReason?: string;
}

export interface RebuiltRuntimeUsageGameSegment extends RuntimeUsageGameSegment {
  startEventId: string;
  endEventId?: string;
  startReason?: string;
  endReason?: string;
}

export interface RebuiltRuntimeUsageEligibleSegment
  extends RuntimeUsageEligibleSegment {
  startEventId: string;
  endEventId?: string;
  startReason?: string;
  endReason?: string;
}

export interface RuntimeUsageReplayProjection {
  controllerSegments: RebuiltRuntimeUsageControllerSegment[];
  gameSegments: RebuiltRuntimeUsageGameSegment[];
  eligibleSegments: RebuiltRuntimeUsageEligibleSegment[];
}

export interface RuntimeUsageReplayResult extends RuntimeUsageReplayProjection {
  gameSessionMetrics: ReturnType<typeof buildRuntimeUsageGameSessionMetrics>;
  dailyGameMetrics: ReturnType<typeof buildRuntimeUsageDailyGameMetrics>;
}

const eventReplayPriority: Record<RuntimeUsageEvent["kind"], number> = {
  host_bootstrap_verified: 10,
  room_created: 20,
  room_registered: 25,
  game_launch_started: 30,
  game_became_active: 40,
  controller_joined: 50,
  controller_disconnected: 60,
  controller_left: 70,
  game_returned_to_system: 80,
  room_closed: 90,
};

export const buildControllerSegmentId = (
  runtimeSessionId: string,
  controllerId: string,
  startEventId: string,
): string => `ctrl:${runtimeSessionId}:${controllerId}:${startEventId}`;

export const buildGameSegmentId = (
  runtimeSessionId: string,
  gameId: string,
  startEventId: string,
): string => `game:${runtimeSessionId}:${gameId}:${startEventId}`;

export const buildEligibleSegmentId = (
  runtimeSessionId: string,
  gameId: string | undefined,
  startEventId: string,
): string => `eligible:${runtimeSessionId}:${gameId ?? "unknown"}:${startEventId}`;

export const sortRuntimeUsageEventsForReplay = (
  events: RuntimeUsageEvent[],
): RuntimeUsageEvent[] =>
  [...events].sort((left, right) => {
    if (left.occurredAt !== right.occurredAt) {
      return left.occurredAt - right.occurredAt;
    }

    const leftPriority = eventReplayPriority[left.kind] ?? 999;
    const rightPriority = eventReplayPriority[right.kind] ?? 999;
    if (leftPriority !== rightPriority) {
      return leftPriority - rightPriority;
    }

    return left.id.localeCompare(right.id);
  });

const resolveControllerId = (event: RuntimeUsageEvent): string | undefined => {
  const candidate = event.payload?.controllerId;
  return typeof candidate === "string" && candidate.length > 0
    ? candidate
    : undefined;
};

const applyReplayAction = (
  event: RuntimeUsageEvent,
  action: RuntimeUsageProjectionAction,
  state: RuntimeUsageReplayProjection,
  openControllerSegments: Map<string, RebuiltRuntimeUsageControllerSegment>,
  openGameSegments: RebuiltRuntimeUsageGameSegment[],
  openEligibleSegments: RebuiltRuntimeUsageEligibleSegment[],
): void => {
  if (!event.runtimeSessionId || !event.roomId) {
    return;
  }

  const occurredAt = new Date(event.occurredAt);

  switch (action.type) {
    case "open_controller_segment": {
      const segment: RebuiltRuntimeUsageControllerSegment = {
        id: buildControllerSegmentId(
          event.runtimeSessionId,
          action.controllerId,
          event.id,
        ),
        runtimeSessionId: event.runtimeSessionId,
        roomId: event.roomId,
        appId: event.appId,
        controllerId: action.controllerId,
        startedAt: occurredAt,
        endedAt: null,
        startEventId: event.id,
      };

      openControllerSegments.set(action.controllerId, segment);
      state.controllerSegments.push(segment);
      return;
    }
    case "close_controller_segment": {
      const segment = openControllerSegments.get(action.controllerId);
      if (!segment) {
        return;
      }

      segment.endedAt = occurredAt;
      segment.endEventId = event.id;
      segment.endReason = action.reason;
      openControllerSegments.delete(action.controllerId);
      return;
    }
    case "close_all_controller_segments": {
      for (const segment of openControllerSegments.values()) {
        segment.endedAt = occurredAt;
        segment.endEventId = event.id;
        segment.endReason = action.reason;
      }
      openControllerSegments.clear();
      return;
    }
    case "open_game_segment": {
      const segment: RebuiltRuntimeUsageGameSegment = {
        id: buildGameSegmentId(event.runtimeSessionId, action.gameId, event.id),
        runtimeSessionId: event.runtimeSessionId,
        roomId: event.roomId,
        appId: event.appId,
        gameId: action.gameId,
        startedAt: occurredAt,
        endedAt: null,
        startEventId: event.id,
        startReason: action.reason,
      };

      openGameSegments.push(segment);
      state.gameSegments.push(segment);
      return;
    }
    case "close_all_game_segments": {
      for (const segment of openGameSegments) {
        segment.endedAt = occurredAt;
        segment.endEventId = event.id;
        segment.endReason = action.reason;
      }
      openGameSegments.length = 0;
      return;
    }
    case "open_eligible_segment": {
      const segment: RebuiltRuntimeUsageEligibleSegment = {
        id: buildEligibleSegmentId(
          event.runtimeSessionId,
          action.gameId,
          event.id,
        ),
        runtimeSessionId: event.runtimeSessionId,
        roomId: event.roomId,
        appId: event.appId,
        gameId: action.gameId,
        startedAt: occurredAt,
        endedAt: null,
        startEventId: event.id,
        startReason: action.reason,
      };

      openEligibleSegments.push(segment);
      state.eligibleSegments.push(segment);
      return;
    }
    case "close_eligible_segment": {
      const segment = openEligibleSegments.at(-1);
      if (!segment) {
        return;
      }

      segment.endedAt = occurredAt;
      segment.endEventId = event.id;
      segment.endReason = action.reason;
      openEligibleSegments.pop();
      return;
    }
  }
};

export const rebuildRuntimeUsageProjectionFromEvents = (
  events: RuntimeUsageEvent[],
): RuntimeUsageReplayProjection => {
  const state: RuntimeUsageReplayProjection = {
    controllerSegments: [],
    gameSegments: [],
    eligibleSegments: [],
  };
  const openControllerSegments = new Map<
    string,
    RebuiltRuntimeUsageControllerSegment
  >();
  const openGameSegments: RebuiltRuntimeUsageGameSegment[] = [];
  const openEligibleSegments: RebuiltRuntimeUsageEligibleSegment[] = [];

  for (const event of sortRuntimeUsageEventsForReplay(events)) {
    const controllerId = resolveControllerId(event);
    const actions = projectRuntimeUsageEvent(event, {
      openControllerCount: openControllerSegments.size,
      hasOpenControllerSegmentForController: controllerId
        ? openControllerSegments.has(controllerId)
        : false,
      openGameId: openGameSegments.at(-1)?.gameId,
      hasOpenGameSegment: openGameSegments.length > 0,
      hasOpenEligibleSegment: openEligibleSegments.length > 0,
    });

    for (const action of actions) {
      applyReplayAction(
        event,
        action,
        state,
        openControllerSegments,
        openGameSegments,
        openEligibleSegments,
      );
    }
  }

  return state;
};

export const rebuildRuntimeUsageFromEvents = (
  events: RuntimeUsageEvent[],
  referenceTime: Date,
): RuntimeUsageReplayResult => {
  const projection = rebuildRuntimeUsageProjectionFromEvents(events);
  const gameSessionMetrics = buildRuntimeUsageGameSessionMetrics(
    projection.gameSegments,
    projection.controllerSegments,
    projection.eligibleSegments,
    referenceTime,
  );

  return {
    ...projection,
    gameSessionMetrics,
    dailyGameMetrics: buildRuntimeUsageDailyGameMetrics(
      gameSessionMetrics,
      referenceTime,
    ),
  };
};

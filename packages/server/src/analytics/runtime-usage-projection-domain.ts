import type { RuntimeUsageEvent } from "./runtime-usage.js";

export interface RuntimeUsageProjectionOpenState {
  openControllerCount: number;
  hasOpenControllerSegmentForController: boolean;
  openGameId?: string;
  hasOpenGameSegment: boolean;
  hasOpenEligibleSegment: boolean;
}

export type RuntimeUsageProjectionAction =
  | {
      type: "open_controller_segment";
      controllerId: string;
    }
  | {
      type: "close_controller_segment";
      controllerId: string;
      reason: string;
    }
  | {
      type: "close_all_controller_segments";
      reason: string;
    }
  | {
      type: "open_game_segment";
      gameId: string;
      reason?: string;
    }
  | {
      type: "close_all_game_segments";
      reason: string;
    }
  | {
      type: "open_eligible_segment";
      gameId?: string;
      reason?: string;
    }
  | {
      type: "close_eligible_segment";
      reason: string;
    };

const getPayloadString = (
  event: RuntimeUsageEvent,
  key: string,
): string | undefined => {
  const value = event.payload?.[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
};

const resolveControllerId = (event: RuntimeUsageEvent): string | undefined =>
  getPayloadString(event, "controllerId");

const resolveOpenEligibleGameId = (
  event: RuntimeUsageEvent,
  openGameId?: string,
): string | undefined => event.gameId ?? openGameId;

export const projectRuntimeUsageEvent = (
  event: RuntimeUsageEvent,
  openState: RuntimeUsageProjectionOpenState,
): RuntimeUsageProjectionAction[] => {
  const actions: RuntimeUsageProjectionAction[] = [];

  switch (event.kind) {
    case "controller_joined": {
      const controllerId = resolveControllerId(event);
      if (!controllerId) {
        return actions;
      }

      if (!openState.hasOpenControllerSegmentForController) {
        actions.push({
          type: "open_controller_segment",
          controllerId,
        });
      }

      if (
        openState.hasOpenGameSegment &&
        openState.openControllerCount === 0 &&
        !openState.hasOpenEligibleSegment
      ) {
        actions.push({
          type: "open_eligible_segment",
          gameId: resolveOpenEligibleGameId(event, openState.openGameId),
          reason: "controller_joined",
        });
      }

      return actions;
    }
    case "controller_disconnected":
    case "controller_left": {
      const controllerId = resolveControllerId(event);
      if (!controllerId) {
        return actions;
      }

      if (openState.hasOpenControllerSegmentForController) {
        actions.push({
          type: "close_controller_segment",
          controllerId,
          reason: event.kind,
        });
      }

      if (
        openState.hasOpenGameSegment &&
        openState.openControllerCount === 1 &&
        openState.hasOpenEligibleSegment
      ) {
        actions.push({
          type: "close_eligible_segment",
          reason: event.kind,
        });
      }

      return actions;
    }
    case "game_became_active": {
      const gameId = event.gameId;
      if (!gameId) {
        return actions;
      }

      if (!openState.hasOpenGameSegment) {
        actions.push({
          type: "open_game_segment",
          gameId,
          reason: getPayloadString(event, "activation"),
        });
      }

      if (
        openState.openControllerCount > 0 &&
        !openState.hasOpenEligibleSegment
      ) {
        actions.push({
          type: "open_eligible_segment",
          gameId,
          reason: "game_became_active",
        });
      }

      return actions;
    }
    case "game_returned_to_system": {
      if (openState.hasOpenEligibleSegment) {
        actions.push({
          type: "close_eligible_segment",
          reason: getPayloadString(event, "reason") ?? "game_returned_to_system",
        });
      }

      if (openState.hasOpenGameSegment) {
        actions.push({
          type: "close_all_game_segments",
          reason: getPayloadString(event, "reason") ?? "game_returned_to_system",
        });
      }

      return actions;
    }
    case "room_closed": {
      if (openState.hasOpenEligibleSegment) {
        actions.push({
          type: "close_eligible_segment",
          reason: getPayloadString(event, "reason") ?? "room_closed",
        });
      }

      if (openState.hasOpenGameSegment) {
        actions.push({
          type: "close_all_game_segments",
          reason: getPayloadString(event, "reason") ?? "room_closed",
        });
      }

      if (openState.openControllerCount > 0) {
        actions.push({
          type: "close_all_controller_segments",
          reason: getPayloadString(event, "reason") ?? "room_closed",
        });
      }

      return actions;
    }
    default:
      return actions;
  }
};

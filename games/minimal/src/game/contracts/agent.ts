import {
  defineAirJamAgentContract,
  defineAirJamAgentStores,
  agentAction,
  agentStore,
  agentActionInput,
} from "@air-jam/sdk";
import type { MinimalState } from "../store";

const stores = defineAirJamAgentStores({
  default: agentStore<MinimalState>(),
});

export const agentContract = defineAirJamAgentContract({
  stores,
  snapshotDescription:
    "Shared tap counter snapshot with semantic actions for tapping and resetting the starter state.",
  projectSnapshot: (context) => {
    const state = context.stores.default;
    if (!state) {
      return {
        available: false,
        summary: "The shared counter store is not available yet.",
      };
    }

    const leaders = Object.entries(state.perPlayerCounts)
      .sort(([, left], [, right]) => right - left)
      .slice(0, 4)
      .map(([controllerId, count]) => ({
        controllerId,
        count,
      }));

    return {
      available: true,
      totalCount: state.totalCount,
      playerCount: Object.keys(state.perPlayerCounts).length,
      perPlayerCounts: state.perPlayerCounts,
      leaders,
      availableActions: ["tap", "reset_counter"],
    };
  },
  actions: {
    tap: agentAction.participant(
      {
        actionName: "tap",
      },
      {
        input: agentActionInput.none(),
        description:
          "Increment the shared tap counter as the current controller.",
        availability: "Requires a connected controller identity.",
        resultDescription:
          "The shared counter and the current controller's personal count increment by one.",
      },
    ),
    reset_counter: agentAction.participant(
      {
        actionName: "reset",
      },
      {
        input: agentActionInput.none(),
        description:
          "Reset the minimal starter counter back to zero for deterministic retesting.",
        availability: "Any time.",
        resultDescription:
          "The shared total and all per-controller counts are cleared.",
      },
    ),
  },
});

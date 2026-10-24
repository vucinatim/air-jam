import { vi } from "vitest";
import {
  defineAirJamAgentContract,
  type AnyAirJamAgentContract,
} from "../../src/agent/agent-contract";
import {
  AIR_JAM_RUNTIME_CONTROL_KEY,
  registerHostAgentContract,
  registerHostRuntimeActionStore,
  registerHostRuntimeParticipantReceiver,
  type HostRuntimeControl,
} from "../../src/runtime/contracts/control";
import type {
  HostObservationRequest,
  HostObservationSurface,
} from "../../src/runtime/contracts/observation";
import { registerHostObservationSurface } from "../../src/runtime/host-observation";

export function observationFixture(
  target: object = {},
  actions: AnyAirJamAgentContract["actions"] = {},
) {
  const hostState = {
    runtimeState: "playing" as "playing" | "paused",
    connectionStatus: "connected" as const,
  };
  const invoke = vi.fn();
  const dispatchParticipant = vi
    .fn()
    .mockReturnValue({ ok: true, status: "accepted", source: "host" });
  const removeStore = registerHostRuntimeActionStore(target, {
    roomId: "ROOM",
    storeDomain: "default",
    contractStoreDomain: "default",
    stateEpoch: "store-one",
    read: () => ({ data: { score: 2, secret: "not-projected" }, revision: 7 }),
    invoke,
    dispatchParticipant,
  });
  const removeContract = registerHostAgentContract(target, {
    roomId: "ROOM",
    gameId: "fixture",
    contract: defineAirJamAgentContract({
      stores: { default: {} },
      actions,
      projectSnapshot: ({ controllerId, stores }) => ({
        score: Reflect.get(stores.default ?? {}, "score"),
        controllerId,
      }),
    }),
  });
  const control: HostRuntimeControl = Reflect.get(
    target,
    AIR_JAM_RUNTIME_CONTROL_KEY,
  );
  const surface = (value: HostObservationSurface) =>
    registerHostObservationSurface(target, "ROOM", value);
  const request = {
    roomId: "ROOM",
    controllerId: null,
    scope: "diagnostic" as const,
    includeImage: true,
  };
  const observe = async (input: HostObservationRequest) => {
    const response = await control.agent({ operation: "observe", ...input });
    if (response.operation !== "observe")
      throw new Error("Expected observation response.");
    return response.observation;
  };
  return {
    target,
    hostState,
    receiver: (
      options: Partial<
        Parameters<typeof registerHostRuntimeParticipantReceiver>[2]
      > = {},
    ) =>
      registerHostRuntimeParticipantReceiver(target, "ROOM", {
        now: () => performance.now(),
        readState: () => ({ ...hostState }),
        isParticipant: () => true,
        ...options,
      }),
    control,
    invoke,
    dispatchParticipant,
    request,
    observe,
    surface,
    close: () => {
      removeContract();
      removeStore();
    },
  };
}

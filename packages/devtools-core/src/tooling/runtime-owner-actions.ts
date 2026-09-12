import type { VisualHarnessPageSurface } from "@air-jam/harness/visual";
import type { AirJamActionInvocationResult } from "@air-jam/sdk";
import {
  AIR_JAM_RUNTIME_CONTROL_KEY,
  type HostRuntimeActionRequest,
  type HostRuntimeControl,
} from "@air-jam/sdk/runtime-control";

/** Execute only in the game realm held by this browser owner, never its shell. */
export const invokeOwnedHostAction = async (
  host: VisualHarnessPageSurface,
  action: HostRuntimeActionRequest,
): Promise<AirJamActionInvocationResult> => {
  try {
    return await host.game.locator("body").evaluate(
      async (_, { key, request }) => {
        const control = (
          window as unknown as Record<string, HostRuntimeControl | undefined>
        )[key];
        return control
          ? await control.invoke(request)
          : {
              ok: false,
              status: "rejected",
              source: "client",
              reason: "host_runtime_unavailable",
              message: "The owned game has no active host control binding.",
            };
      },
      { key: AIR_JAM_RUNTIME_CONTROL_KEY, request: action },
    );
  } catch {
    return {
      ok: false,
      status: "rejected",
      source: "client",
      reason: "host_ack_missing",
      message:
        "The owned game frame became unavailable before its acknowledgement was observed.",
    };
  }
};

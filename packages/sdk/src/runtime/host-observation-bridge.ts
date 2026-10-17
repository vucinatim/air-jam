import { z } from "zod";
import {
  isLocalDevControlSurfaceTopology,
  type ResolvedAirJamRuntimeTopology,
} from "../runtime-topology";
import {
  AIR_JAM_RUNTIME_CONTROL_KEY,
  type HostRuntimeControl,
} from "./contracts/control";
import type { HostRuntimeInspectionContract } from "./contracts/inspection";
import {
  hostObservationRequestMessageSchema as requestSchema,
  hostObservationResponseMessageSchema as responseSchema,
  type HostObservationRequest,
} from "./contracts/observation";
import { embeddedRuntimeParent } from "./embedded-parent";

export function requestHostObservation(
  target: Window,
  origin: string,
  requestId: string,
  request: HostObservationRequest,
) {
  target.postMessage(
    requestSchema.parse({ type: "AIRJAM_HOST_OBSERVE", requestId, request }),
    origin,
  );
}

export function readHostObservation(
  event: MessageEvent<unknown>,
  expectedWindow: Window,
  expectedOrigin: string,
) {
  if (event.source !== expectedWindow || event.origin !== expectedOrigin)
    return null;
  const response = responseSchema.safeParse(event.data);
  return response.success ? response.data : null;
}

export function publishEmbeddedHostObservation(
  inspection: HostRuntimeInspectionContract,
  topology: ResolvedAirJamRuntimeTopology,
) {
  const embedding = embeddedRuntimeParent(topology);
  if (!embedding || !isLocalDevControlSurfaceTopology(topology))
    return { supported: false, close: () => {} };
  const parent = embedding.window;
  const parentOrigin = embedding.origin;
  let closed = false;
  let busy = false;
  const respond = (
    requestId: string,
    result: z.infer<typeof responseSchema>["result"],
  ) => {
    if (!closed)
      parent.postMessage(
        { type: "AIRJAM_HOST_OBSERVATION", requestId, result },
        parentOrigin,
      );
  };
  const listener = (event: MessageEvent<unknown>) => {
    if (event.source !== parent || event.origin !== parentOrigin) return;
    const parsed = requestSchema.safeParse(event.data);
    if (!parsed.success) return;
    const { requestId, request } = parsed.data;
    if (busy) {
      respond(requestId, {
        ok: false,
        error: "observation_busy: One observation is already in progress.",
      });
      return;
    }
    if (request.roomId !== inspection.roomId) {
      respond(requestId, {
        ok: false,
        error: "observation_replaced: This document owns another room.",
      });
      return;
    }
    const control: HostRuntimeControl | undefined = Reflect.get(
      window,
      AIR_JAM_RUNTIME_CONTROL_KEY,
    );
    if (!control) {
      respond(requestId, {
        ok: false,
        error: "contract_runtime_unavailable: No live game contract.",
      });
      return;
    }
    busy = true;
    void (async () => {
      try {
        const result = await control.agent({
          operation: "observe",
          ...request,
        });
        if (result.operation !== "observe")
          throw new Error("Invalid host observation response.");
        respond(requestId, { ok: true, observation: result.observation });
      } catch (error) {
        respond(requestId, {
          ok: false,
          error:
            String(error instanceof Error ? error.message : error).slice(
              0,
              1024,
            ) || "Observation failed.",
        });
      } finally {
        busy = false;
      }
    })();
  };
  window.addEventListener("message", listener);
  return {
    supported: true,
    close: () => {
      closed = true;
      window.removeEventListener("message", listener);
    },
  };
}

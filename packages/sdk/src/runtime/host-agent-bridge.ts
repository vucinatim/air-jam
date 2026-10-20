import { z } from "zod";
import {
  isLocalDevControlSurfaceTopology,
  type ResolvedAirJamRuntimeTopology,
} from "../runtime-topology";
import {
  hostAgentRequestMessageSchema as requestSchema,
  hostAgentResultMessageSchema as resultSchema,
  type HostAgentRequest,
} from "./contracts/agent-control";
import {
  AIR_JAM_RUNTIME_CONTROL_KEY,
  type HostRuntimeControl,
} from "./contracts/control";
import type { HostRuntimeInspectionContract } from "./contracts/inspection";
import { embeddedRuntimeParent } from "./embedded-parent";

export function requestHostAgent(
  target: Window,
  origin: string,
  requestId: string,
  request: HostAgentRequest,
) {
  target.postMessage(
    requestSchema.parse({ type: "AIRJAM_HOST_AGENT", requestId, request }),
    origin,
  );
}

export function readHostAgentResult(
  event: MessageEvent<unknown>,
  expectedWindow: Window,
  expectedOrigin: string,
) {
  if (event.source !== expectedWindow || event.origin !== expectedOrigin)
    return null;
  const result = resultSchema.safeParse(event.data);
  return result.success ? result.data : null;
}

/**
 * Answers the development editor that embeds this host: observations, live
 * state reads and the game's own semantic actions, for this document's room
 * only. The editor decides who may ask; this document only checks that the
 * request comes from its configured parent.
 */
export function publishEmbeddedHostAgent(
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
    result: z.infer<typeof resultSchema>["result"],
  ) => {
    if (!closed)
      parent.postMessage(
        { type: "AIRJAM_HOST_AGENT_RESULT", requestId, result },
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
        error: "host_agent_busy: One host request is already in progress.",
      });
      return;
    }
    if (request.roomId !== inspection.roomId) {
      respond(requestId, {
        ok: false,
        error: "runtime_replaced: This document owns another room.",
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
        const response = await control.agent(request);
        if (response.operation !== request.operation)
          throw new Error("Invalid host agent response.");
        respond(requestId, { ok: true, response });
      } catch (error) {
        respond(requestId, {
          ok: false,
          error:
            String(error instanceof Error ? error.message : error).slice(
              0,
              1024,
            ) || "Host request failed.",
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

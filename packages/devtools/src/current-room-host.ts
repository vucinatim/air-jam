import {
  hostAgentResultMessageSchema,
  type HostAgentRequest,
  type HostAgentResponse,
} from "@air-jam/sdk/runtime-control";
import { BodyLimitError, readBoundedText } from "./bounded-response.js";
import {
  currentRoomHostRequestSchema,
  type CurrentRoomAttachment,
} from "./game-run-protocol.js";

const MAXIMUM_RESPONSE_BYTES = 2 * 1024 * 1024;

/**
 * The creator's host, reached through the editor that granted the room. The
 * endpoint is an ephemeral delegation, never part of a run record or trace.
 */
export function currentRoomHost(
  attachment: CurrentRoomAttachment,
  ownerInstanceId: string,
): (
  request: HostAgentRequest,
  timeoutMs: number,
  signal?: AbortSignal,
) => Promise<HostAgentResponse> {
  return async (request, timeoutMs, signal) => {
    const input = currentRoomHostRequestSchema.parse({
      targetId: attachment.host.targetId,
      ownerInstanceId,
      request,
    });
    const deadline = AbortSignal.timeout(timeoutMs);
    let response: Response;
    try {
      response = await fetch(attachment.host.endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
        signal: signal ? AbortSignal.any([signal, deadline]) : deadline,
        redirect: "error",
        credentials: "omit",
      });
    } catch {
      throw new Error(
        "current_host_unavailable: The creator's editor could not be reached.",
      );
    }
    if (!response.ok) {
      if ([401, 403, 409].includes(response.status)) {
        let message = "The creator's room is no longer granted.";
        try {
          if (response.body) {
            const body = JSON.parse(await readBoundedText(response.body, 4096));
            if (typeof body?.error === "string" && body.error.trim())
              message = body.error.trim().slice(0, 300);
          }
        } catch {
          // Missing, invalid or oversized refusal bodies use the generic cause.
        }
        throw new Error(`runtime_replaced: ${message}`);
      }
      await response.body?.cancel();
      throw new Error(
        `current_host_unavailable: The editor returned HTTP ${response.status}.`,
      );
    }
    if (!response.body)
      throw new Error("current_host_invalid: Empty host response.");
    let source: string;
    try {
      source = await readBoundedText(response.body, MAXIMUM_RESPONSE_BYTES);
    } catch (error) {
      throw new Error(
        error instanceof BodyLimitError
          ? "current_host_limit: The creator's host exceeded its transfer budget."
          : "current_host_unavailable: Host response transfer failed.",
      );
    }
    let result;
    try {
      result = hostAgentResultMessageSchema.shape.result.parse(
        JSON.parse(source),
      );
    } catch {
      throw new Error(
        "current_host_invalid: The creator's host response failed validation.",
      );
    }
    if (!result.ok) throw new Error(result.error);
    const answer = result.response;
    if (answer.operation !== request.operation)
      throw new Error(
        "current_host_invalid: The creator's host answered another request.",
      );
    if (
      answer.operation === "observe" &&
      request.operation === "observe" &&
      (answer.observation.identity.roomId !== request.roomId ||
        answer.observation.controllerId !== request.controllerId ||
        answer.observation.scope !== request.scope ||
        (request.expected &&
          Object.entries(request.expected).some(
            ([key, value]) =>
              Reflect.get(answer.observation.identity, key) !== value,
          )))
    )
      throw new Error(
        "runtime_replaced: The observation belongs to another runtime or player.",
      );
    return answer;
  };
}

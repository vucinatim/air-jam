import {
  hostObservationResponseMessageSchema,
  type HostObservation,
  type HostObservationRequest,
} from "@air-jam/sdk/runtime-control";
import { BodyLimitError, readBoundedText } from "./bounded-response.js";
import {
  currentRoomObservationRequestSchema,
  type CurrentRoomAttachment,
} from "./game-run-protocol.js";

const MAXIMUM_OBSERVATION_BYTES = 2 * 1024 * 1024;

/** The endpoint is an ephemeral delegation, never part of a run record or trace. */
export function currentRoomObserver(
  attachment: CurrentRoomAttachment,
  ownerInstanceId: string,
): (
  request: HostObservationRequest,
  signal: AbortSignal,
) => Promise<HostObservation> {
  return async (request: HostObservationRequest, signal: AbortSignal) => {
    const input = currentRoomObservationRequestSchema.parse({
      targetId: attachment.observation.targetId,
      ownerInstanceId,
      request,
    });
    let response: Response;
    try {
      response = await fetch(attachment.observation.endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
        signal,
        redirect: "error",
        credentials: "omit",
      });
    } catch {
      throw new Error(
        "current_observation_unavailable: The delegated editor could not be reached.",
      );
    }
    if (!response.ok) {
      await response.body?.cancel();
      throw new Error(
        [401, 403, 409].includes(response.status)
          ? "runtime_replaced: Current-room observation is no longer authorized."
          : `current_observation_unavailable: Observation returned HTTP ${response.status}.`,
      );
    }
    if (!response.body)
      throw new Error(
        "current_observation_invalid: Empty observation response.",
      );
    let source: string;
    try {
      source = await readBoundedText(response.body, MAXIMUM_OBSERVATION_BYTES);
    } catch (error) {
      throw new Error(
        error instanceof BodyLimitError
          ? "current_observation_limit: The delegated frame exceeded its transfer budget."
          : "current_observation_unavailable: Observation transfer failed.",
      );
    }
    let result;
    try {
      result = hostObservationResponseMessageSchema.shape.result.parse(
        JSON.parse(source),
      );
    } catch {
      throw new Error(
        "current_observation_invalid: The delegated frame failed validation.",
      );
    }
    if (!result.ok)
      throw new Error(
        "runtime_replaced: The delegated editor refused the observation.",
      );
    const observation = result.observation;
    if (
      observation.identity.roomId !== request.roomId ||
      observation.controllerId !== request.controllerId ||
      observation.scope !== request.scope ||
      (request.expected &&
        Object.entries(request.expected).some(
          ([key, value]) => Reflect.get(observation.identity, key) !== value,
        ))
    )
      throw new Error(
        "runtime_replaced: Delegated observation belongs to another runtime or player.",
      );
    return observation;
  };
}

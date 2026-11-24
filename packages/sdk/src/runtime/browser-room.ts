import { AIRJAM_DEV_LOG_EVENTS } from "../protocol";
import type { RuntimeErrorReporter } from "../protocol/runtime-reporting";
import type { RoomConnector } from "../room-protocol";
import { createWebSocketConnector } from "../room-session/web-socket-link";
import type { ResolvedAirJamRuntimeTopology } from "../runtime-topology";
import type { ControllerBridgeContext } from "./controller-bridge-context";
import { emitAirJamDevRuntimeEvent } from "./dev-runtime-events";
import { embeddedRuntimeParent } from "./embedded-parent";
import { requestEmbeddingRoom } from "./room-bridge";

/**
 * How a browser page reaches its room: through the page that embeds it
 * when its topology says it is embedded, else over a WebSocket to the rooms
 * its topology names.
 */
export const browserRoomConnector = ({
  topology,
  role,
  embedding,
}: {
  topology: ResolvedAirJamRuntimeTopology;
  role: "host" | "controller";
  /** The surface or harness the embedding page knows this frame by; null when not embedded. */
  embedding: ControllerBridgeContext | null;
}): RoomConnector => {
  const parent = embedding ? embeddedRuntimeParent(topology) : null;
  if (parent && embedding)
    return requestEmbeddingRoom({ parent, role, context: embedding });
  return createWebSocketConnector(topology.socketOrigin);
};

/** Without an app reporter, runtime error reports go to the development log. */
export const devLogRuntimeErrorReporter: RuntimeErrorReporter = (report) =>
  emitAirJamDevRuntimeEvent({
    event: AIRJAM_DEV_LOG_EVENTS.runtime.errorReport,
    level: "error",
    message: `The ${report.role} crashed while rendering (${report.errorName}).`,
    roomId: report.roomId,
    ...(report.seat ? { controllerId: report.seat } : {}),
    data: { ...report },
  });

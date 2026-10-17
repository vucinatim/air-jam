import {
  AIRJAM_DEV_LOG_EVENTS,
  controllerLeasedControlAckSchema,
  controllerLeasedControlSchema,
  type ControllerLeasedControlAck,
} from "@air-jam/sdk/protocol";
import { createWindowedEventSummary } from "../../logging/create-windowed-event-summary.js";
import type { SocketHandlerContext } from "../socket-handler-context.js";

const pendingByRoom = new WeakMap<object, Set<string>>();
const HOST_ACK_TIMEOUT_MS = 1000;

export function registerControllerLeasedControl(context: SocketHandlerContext) {
  const { socket, io, roomManager, isControllerAuthorizedForRoom } = context;
  const outcomes = createWindowedEventSummary({
    logger: context.logger.child({
      component: "controller-participant-control",
    }),
    event: AIRJAM_DEV_LOG_EVENTS.controller.leasedControlSummary,
    msg: "Leased participant control outcomes",
  });
  socket.on("disconnect", () => outcomes.flushAll());
  socket.on("controller:leasedControl", async (payload, acknowledge) => {
    if (typeof acknowledge !== "function") return;
    const finish = (ack: ControllerLeasedControlAck, error?: unknown) => {
      outcomes.record({
        key:
          ack.status === "applied" ? ack.status : `${ack.status}:${ack.reason}`,
        bindings: {
          roomId: socket.data.controllerAuthority?.roomId,
          controllerId: socket.data.controllerAuthority?.controllerId,
        },
        data: {
          ...(ack.status === "applied" ? {} : { reason: ack.reason }),
          status: ack.status,
          ...(error
            ? { error: error instanceof Error ? error.message : String(error) }
            : {}),
        },
        metrics: {
          appliedCount: ack.status === "applied" ? 1 : 0,
          rejectedCount: ack.status === "rejected" ? 1 : 0,
          unconfirmedCount: ack.status === "unconfirmed" ? 1 : 0,
        },
      });
      if (socket.disconnected) outcomes.flushAll();
      acknowledge(ack);
    };
    const parsed = controllerLeasedControlSchema.safeParse(payload);
    if (!parsed.success) {
      finish({ status: "rejected", reason: "invalid_request" });
      return;
    }
    const input = parsed.data;
    if (!isControllerAuthorizedForRoom(input.roomId, input.controllerId)) {
      finish({ status: "rejected", reason: "unauthorized" });
      return;
    }
    const room = roomManager.getRoom(input.roomId);
    if (!room) {
      finish({ status: "rejected", reason: "room_not_found" });
      return;
    }
    const hostId = roomManager.getActiveHostId(room);
    const hostSocket = hostId ? io.sockets.sockets.get(hostId) : undefined;
    if (!hostSocket) {
      finish({ status: "rejected", reason: "active_host_missing" });
      return;
    }
    const pending = pendingByRoom.get(room) ?? new Set<string>();
    if (pending.has(input.controllerId)) {
      finish({ status: "rejected", reason: "busy" });
      return;
    }
    pending.add(input.controllerId);
    pendingByRoom.set(room, pending);
    try {
      let acknowledgement: unknown;
      try {
        acknowledgement = await hostSocket
          .timeout(HOST_ACK_TIMEOUT_MS)
          .emitWithAck("server:leasedControl", input);
      } catch (error) {
        finish(
          { status: "unconfirmed", reason: "host_ack_unavailable" },
          error,
        );
        return;
      }
      if (
        roomManager.getRoom(input.roomId) !== room ||
        roomManager.getActiveHostId(room) !== hostId ||
        !isControllerAuthorizedForRoom(input.roomId, input.controllerId)
      ) {
        finish({ status: "unconfirmed", reason: "runtime_replaced" });
        return;
      }
      const result =
        controllerLeasedControlAckSchema.safeParse(acknowledgement);
      if (
        !result.success ||
        (result.data.status === "applied" &&
          (result.data.leaseId !== input.lease.id ||
            result.data.sequence !== input.lease.sequence ||
            result.data.operation.kind !== input.operation.kind))
      ) {
        finish({ status: "unconfirmed", reason: "invalid_acknowledgement" });
        return;
      }
      finish(result.data);
    } finally {
      pending.delete(input.controllerId);
      if (!pending.size) pendingByRoom.delete(room);
    }
  });
}

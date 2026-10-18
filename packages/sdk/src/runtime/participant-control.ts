import type { InputManager } from "../internal/input-manager";
import type {
  ControllerLeasedControl,
  ControllerLeasedControlAck,
} from "../protocol/leased-control";
import { PARTICIPANT_CONTROL_DEADLINE_MS } from "../protocol/leased-control";
import type { HostObservationIdentity } from "./contracts/runtime-identity";
import { sameHostRuntimeIdentity } from "./contracts/runtime-identity";

type InputBuffer = Pick<
  InputManager,
  | "claimLeasedInput"
  | "supportsLeasedInput"
  | "setLeasedInput"
  | "releaseLeasedInput"
  | "clearInput"
>;
type ActionOperation = Extract<
  ControllerLeasedControl["operation"],
  { kind: "action" }
>;
type AppliedOperation = Extract<
  ControllerLeasedControlAck,
  { status: "applied" }
>["operation"];
type DispatchResult =
  | AppliedOperation
  | Extract<ControllerLeasedControlAck, { status: "rejected" }>;

export class ParticipantControl {
  private leases = new Map<
    string,
    {
      id: string;
      sequence: number;
      request: string;
      acknowledgement: ControllerLeasedControlAck;
    }
  >();

  constructor(
    private readonly runtime: {
      identity: () => HostObservationIdentity | null;
      isParticipant: (controllerId: string) => boolean;
      input: () => InputBuffer | undefined;
      dispatch: (
        controllerId: string,
        operation: ActionOperation,
      ) => DispatchResult;
    },
  ) {}

  apply(request: ControllerLeasedControl): ControllerLeasedControlAck {
    const identity = this.runtime.identity();
    if (!identity || !sameHostRuntimeIdentity(identity, request.expected))
      return { status: "rejected", reason: "stale_identity" };
    if (!this.runtime.isParticipant(request.controllerId))
      return { status: "rejected", reason: "unauthorized" };
    const previous = this.leases.get(request.controllerId);
    if (previous && previous.id !== request.lease.id)
      return { status: "rejected", reason: "lease_conflict" };
    const signature = JSON.stringify(request, (_key, value) =>
      value && typeof value === "object" && !Array.isArray(value)
        ? Object.fromEntries(
            Object.keys(value)
              .sort()
              .map((key) => [key, Reflect.get(value, key)]),
          )
        : value,
    );
    if (previous && request.lease.sequence <= previous.sequence) {
      if (request.lease.sequence !== previous.sequence)
        return { status: "rejected", reason: "stale_sequence" };
      if (previous.request !== signature)
        return { status: "rejected", reason: "sequence_conflict" };
      return previous.acknowledgement.status === "applied"
        ? { ...previous.acknowledgement, replayed: true }
        : previous.acknowledgement;
    }
    if (request.operation.kind !== "release") {
      const now = performance.now();
      if (request.operation.deadlineMs < now)
        return { status: "rejected", reason: "stale_decision" };
      if (request.operation.deadlineMs > now + PARTICIPANT_CONTROL_DEADLINE_MS)
        return { status: "rejected", reason: "invalid_deadline" };
    }
    let acknowledgement: ControllerLeasedControlAck;
    try {
      const operation = request.operation;
      const buffer = this.runtime.input();
      let result: DispatchResult;
      if (operation.kind === "release") {
        buffer?.releaseLeasedInput(request.controllerId);
        result = { kind: "release" };
      } else if (operation.kind === "input") {
        if (!buffer?.supportsLeasedInput)
          return { status: "rejected", reason: "unsupported" };
        if (
          !buffer.setLeasedInput(
            request.controllerId,
            operation.input,
            operation.ttlMs,
          )
        )
          return { status: "rejected", reason: "invalid_input" };
        result = { kind: "input" };
      } else {
        result = this.runtime.dispatch(request.controllerId, operation);
        if (!("status" in result))
          buffer?.claimLeasedInput(request.controllerId);
      }
      // A discrete action must not extend or replace an already-held input.
      acknowledgement =
        "status" in result
          ? result
          : {
              status: "applied",
              leaseId: request.lease.id,
              sequence: request.lease.sequence,
              replayed: false,
              operation: result,
            };
    } catch (error) {
      // A throwing handler may have already changed state. Never dispatch it again.
      this.leases.set(request.controllerId, {
        id: request.lease.id,
        sequence: request.lease.sequence,
        request: signature,
        acknowledgement: {
          status: "unconfirmed",
          reason: "runtime_unavailable",
        },
      });
      throw error;
    }
    if (acknowledgement.status !== "rejected")
      this.leases.set(request.controllerId, {
        id: request.lease.id,
        sequence: request.lease.sequence,
        request: signature,
        acknowledgement,
      });
    return acknowledgement;
  }

  owns(controllerId: string) {
    return this.leases.has(controllerId);
  }

  clearController(controllerId: string) {
    this.runtime.input()?.clearInput(controllerId);
    this.leases.delete(controllerId);
  }

  invalidateInput() {
    const input = this.runtime.input();
    if (!input) return;
    for (const controllerId of this.leases.keys())
      input.releaseLeasedInput(controllerId);
  }
}

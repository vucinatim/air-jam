import {
  controllerLeasedControlSchema,
  type ControllerJoinAck,
  type ControllerLeasedControl,
  type ControllerLeasedControlAck,
  type HostRegistrationAck,
} from "@air-jam/sdk/protocol";
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { setupServerTestHarness } from "./helpers/server-test-harness";
import { emitWithAck } from "./helpers/socket-test-utils";

describe("leased player input transport", () => {
  const harness = setupServerTestHarness();
  async function setup() {
    const host = await harness.connectSocket();
    expect((await harness.bootstrapHost(host, "app-test", "game")).ok).toBe(
      true,
    );
    const created = await harness.emitWithAck<HostRegistrationAck>(
      host,
      "host:createRoom",
      { maxPlayers: 4 },
    );
    if (!created.ok || !created.roomId)
      throw new Error("The test host did not create its room.");
    const roomId = created.roomId;
    const controller = await harness.connectSocket();
    const joined = await harness.emitWithAck<ControllerJoinAck>(
      controller,
      "controller:join",
      {
        roomId,
        controllerId: "lease-player",
        deviceId: "aj-mcp-device-lease-player",
      },
    );
    expect(joined.ok).toBe(true);
    const input: ControllerLeasedControl = {
      roomId,
      controllerId: "lease-player",
      expected: {
        documentId: "host-document",
        roomId,
        contractId: "game-contract",
        runtimeId: "game-runtime",
        surfaceId: "game-surface",
        participantId: "participant-receiver",
      },
      lease: { id: randomUUID(), sequence: 1 },
      operation: {
        kind: "input",
        deadlineMs: performance.now() + 2000,
        input: { direction: 1 },
        ttlMs: 250,
      },
    };
    const applied = (
      request: ControllerLeasedControl,
    ): ControllerLeasedControlAck => ({
      status: "applied",
      leaseId: request.lease.id,
      sequence: request.lease.sequence,
      replayed: false,
      operation: {
        kind: request.operation.kind === "release" ? "release" : "input",
      },
    });
    const send = (request: unknown = input) =>
      emitWithAck<ControllerLeasedControlAck>(
        controller,
        "controller:leasedControl",
        request,
        2500,
      );
    const nextHostInput = () =>
      new Promise<{
        input: ControllerLeasedControl;
        acknowledge: (ack: ControllerLeasedControlAck) => void;
      }>((resolve) => {
        host.once("server:leasedControl", (payload, acknowledge) => {
          if (typeof acknowledge !== "function")
            throw new Error(
              "A leased input requires its host receipt callback.",
            );
          resolve({
            input: controllerLeasedControlSchema.parse(payload),
            acknowledge: (ack) => acknowledge(ack),
          });
        });
      });
    return { host, controller, roomId, input, applied, send, nextHostInput };
  }

  it("forwards a bounded input and returns its actual host buffer acknowledgement", async () => {
    const f = await setup();
    const received = f.nextHostInput();
    const result = f.send();
    const call = await received;
    expect(call.input).toEqual(f.input);
    call.acknowledge(f.applied(call.input));
    expect(await result).toEqual(f.applied(f.input));
  });

  it("denies another controller identity and invalid leases before forwarding", async () => {
    const f = await setup();
    let forwarded = 0;
    f.host.on("server:leasedControl", () => {
      forwarded++;
    });
    expect(
      await f.send({ ...f.input, controllerId: "another-player" }),
    ).toEqual({ status: "rejected", reason: "unauthorized" });
    expect(
      await f.send({
        ...f.input,
        operation: {
          kind: "input",
          deadlineMs: performance.now() + 2000,
          input: {},
          ttlMs: 2001,
        },
      }),
    ).toEqual({ status: "rejected", reason: "invalid_request" });
    expect(forwarded).toBe(0);
  });

  it("fails safely with an older host and never downgrades to ordinary held input", async () => {
    const f = await setup();
    let ordinaryInputs = 0;
    f.host.on("server:input", () => {
      ordinaryInputs++;
    });
    expect(await f.send()).toEqual({
      status: "unconfirmed",
      reason: "host_ack_unavailable",
    });
    expect(ordinaryInputs).toBe(0);
  });

  it("admits only one input per player while the actual host acknowledgement is pending", async () => {
    const f = await setup();
    const received = f.nextHostInput();
    const first = f.send();
    const call = await received;
    expect(
      await f.send({ ...f.input, lease: { ...f.input.lease, sequence: 2 } }),
    ).toEqual({ status: "rejected", reason: "busy" });
    call.acknowledge(f.applied(call.input));
    expect(await first).toMatchObject({ status: "applied", sequence: 1 });
  });

  it("does not confirm a receipt from a room that was replaced while it was pending", async () => {
    const f = await setup();
    const received = f.nextHostInput();
    const result = f.send();
    const call = await received;
    harness.getRoomManager().deleteRoom(f.roomId);
    call.acknowledge(f.applied(call.input));
    expect(await result).toEqual({
      status: "unconfirmed",
      reason: "runtime_replaced",
    });
  });

  it("does not confirm a receipt for another lease or sequence", async () => {
    const f = await setup();
    const received = f.nextHostInput();
    const result = f.send();
    const call = await received;
    call.acknowledge({
      status: "applied",
      leaseId: randomUUID(),
      sequence: call.input.lease.sequence,
      replayed: false,
      operation: { kind: "input" },
    });
    expect(await result).toEqual({
      status: "unconfirmed",
      reason: "invalid_acknowledgement",
    });
  });
});

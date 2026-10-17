import { afterEach, expect, it, vi } from "vitest";
import { z } from "zod";
import { InputManager } from "../src/internal/input-manager";
import type { ControllerLeasedControl } from "../src/protocol/leased-control";
import {
  applyHostRuntimeLeasedControl,
  readHostRuntimeIdentity,
} from "../src/runtime/contracts/control";
import { observationFixture } from "./fixtures/host-observation";

const leaseId = "223e4567-e89b-42d3-a456-426614174000";
const manager = () =>
  new InputManager({
    schema: z.object({ direction: z.number().min(-1).max(1) }),
  });
const request = (
  expected: ControllerLeasedControl["expected"],
  sequence = 1,
): ControllerLeasedControl => ({
  roomId: "ROOM",
  controllerId: "player",
  lease: { id: leaseId, sequence },
  expected,
  operation: {
    kind: "input",
    deadlineMs: performance.now() + 2000,
    input: { direction: 1 },
    ttlMs: 250,
  },
});

it("advertises leased input only when its actual receiver exists and shares observation identity", async () => {
  const f = observationFixture();
  const input = manager();
  const before = await f.observe({ ...f.request, includeImage: false });
  expect(before.capabilities).toEqual({ participantControl: {} });
  expect(
    applyHostRuntimeLeasedControl(f.target, request(before.identity)),
  ).toEqual({ status: "rejected", reason: "unsupported" });
  const stop = f.receiver({
    input,
    isParticipant: () => true,
  });
  try {
    const current = await f.observe({ ...f.request, includeImage: false });
    expect(current.capabilities).toMatchObject({
      participantControl: { input: 1, inputSchema: { status: "available" } },
    });
    expect(readHostRuntimeIdentity(f.target, "ROOM")).toEqual(current.identity);
    expect(
      applyHostRuntimeLeasedControl(f.target, request(current.identity)),
    ).toMatchObject({ status: "applied", sequence: 1 });
    expect(input.getInput("player")).toEqual({ direction: 1 });
  } finally {
    stop();
    f.close();
  }
  expect(input.getInput("player")).toBeUndefined();
});

it("fences host-local surface replacement even when the contract and replicated epochs stay unchanged", async () => {
  const f = observationFixture();
  const input = manager();
  const stop = f.receiver({
    input,
    isParticipant: () => true,
  });
  const removeFirst = f.surface({ read: () => ({ state: { ballX: 10 } }) });
  const first = await f.observe({ ...f.request, includeImage: false });
  expect(
    applyHostRuntimeLeasedControl(f.target, request(first.identity)),
  ).toMatchObject({ status: "applied" });
  removeFirst();
  const removeSecond = f.surface({ read: () => ({ state: { ballX: 90 } }) });
  try {
    const second = await f.observe({ ...f.request, includeImage: false });
    expect(second.identity.runtimeId).toBe(first.identity.runtimeId);
    expect(second.identity.contractId).toBe(first.identity.contractId);
    expect(second.identity.surfaceId).not.toBe(first.identity.surfaceId);
    expect(input.getInput("player")).toBeUndefined();
    expect(
      applyHostRuntimeLeasedControl(f.target, request(first.identity, 2)),
    ).toEqual({ status: "rejected", reason: "stale_identity" });
    expect(input.getInput("player")).toBeUndefined();
  } finally {
    removeSecond();
    stop();
    f.close();
  }
});

it("clears held input when its contract is removed and refuses the previous generation", async () => {
  const f = observationFixture();
  const input = manager();
  const stop = f.receiver({
    input,
    isParticipant: () => true,
  });
  const current = await f.observe({ ...f.request, includeImage: false });
  applyHostRuntimeLeasedControl(f.target, request(current.identity));
  f.close();
  expect(input.getInput("player")).toBeUndefined();
  expect(
    applyHostRuntimeLeasedControl(f.target, request(current.identity, 2)),
  ).toEqual({ status: "rejected", reason: "stale_identity" });
  stop();
});

it("rejects stale document and contract identities without changing an existing player's input", async () => {
  const f = observationFixture();
  const input = manager();
  const stop = f.receiver({
    input,
    isParticipant: () => true,
  });
  try {
    const current = await f.observe({ ...f.request, includeImage: false });
    for (const expected of [
      { ...current.identity, documentId: "older-document" },
      { ...current.identity, contractId: "older-contract" },
      { ...current.identity, runtimeId: "older-runtime" },
    ]) {
      expect(
        applyHostRuntimeLeasedControl(f.target, request(expected)),
      ).toEqual({
        status: "rejected",
        reason: "stale_identity",
      });
    }
    expect(input.getInput("player")).toBeUndefined();
    expect(f.invoke).not.toHaveBeenCalled();
  } finally {
    stop();
    f.close();
  }
});

it("an older receiver cleanup cannot remove or clear its successor", async () => {
  const f = observationFixture();
  const input = manager();
  const oldStop = f.receiver({
    input,
    isParticipant: () => true,
  });
  oldStop();
  const stop = f.receiver({
    input,
    isParticipant: () => true,
  });
  try {
    const current = await f.observe({ ...f.request, includeImage: false });
    applyHostRuntimeLeasedControl(f.target, request(current.identity));
    oldStop();
    expect(input.getInput("player")).toEqual({ direction: 1 });
    expect(
      (await f.observe({ ...f.request, includeImage: false })).capabilities,
    ).toMatchObject({
      participantControl: { input: 1, inputSchema: { status: "available" } },
    });
  } finally {
    stop();
    f.close();
  }
});

it("dispatches discovered semantic actions as the participant in an action-only game", async () => {
  const { agentAction } = await import("../src/agent/agent-contract");
  const { agentActionInput } = await import("../src/agent/agent-action");
  const f = observationFixture(
    {},
    {
      tap: agentAction.participant(
        { actionName: "increment" },
        {
          input: agentActionInput.number(),
          toPayload: (value) => ({ amount: value }),
        },
      ),
      reset: agentAction.host(
        { actionName: "reset" },
        { input: agentActionInput.none() },
      ),
    },
  );
  const unregister = f.receiver({
    isParticipant: () => true,
  });
  try {
    const observed = await f.observe({ ...f.request, includeImage: false });
    expect(observed.capabilities).toEqual({
      participantControl: { actions: 1 },
    });
    expect(observed.actions).toEqual(
      expect.arrayContaining([expect.objectContaining({ actionId: "tap" })]),
    );
    const action: ControllerLeasedControl = {
      ...request(observed.identity),
      operation: {
        kind: "action",
        deadlineMs: performance.now() + 2000,
        actionId: "tap",
        input: 3,
      },
    };
    const apply = () => applyHostRuntimeLeasedControl(f.target, action);
    expect(apply()).toMatchObject({
      status: "applied",
      replayed: false,
      operation: {
        kind: "action",
        result: { ok: true },
      },
    });
    expect(f.dispatchParticipant).toHaveBeenCalledExactlyOnceWith({
      controllerId: "player",
      actionName: "increment",
      payload: { amount: 3 },
    });
    expect(apply()).toMatchObject({ status: "applied", replayed: true });
    expect(f.dispatchParticipant).toHaveBeenCalledTimes(1);
    expect(
      applyHostRuntimeLeasedControl(f.target, {
        ...action,
        operation: {
          kind: "action",
          deadlineMs: performance.now() + 2000,
          actionId: "tap",
          input: 4,
        },
      }),
    ).toEqual({ status: "rejected", reason: "sequence_conflict" });
    expect(
      applyHostRuntimeLeasedControl(f.target, {
        ...action,
        lease: { ...action.lease, sequence: 2 },
        operation: {
          kind: "action",
          deadlineMs: performance.now() + 2000,
          actionId: "reset",
        },
      }),
    ).toEqual({ status: "rejected", reason: "invalid_action_lane" });
    expect(f.invoke).not.toHaveBeenCalled();
  } finally {
    unregister();
    f.close();
  }
});

it("keeps one ordered writer through release and expiry; leave permits a new writer", async () => {
  const { clearHostRuntimeParticipant } =
    await import("../src/runtime/contracts/control");
  const f = observationFixture();
  const input = manager();
  const stop = f.receiver({
    input,
    isParticipant: () => true,
  });
  try {
    const observed = await f.observe({ ...f.request, includeImage: false });
    const first = request(observed.identity);
    const release: ControllerLeasedControl = {
      ...first,
      lease: { ...first.lease, sequence: 2 },
      operation: { kind: "release" },
    };
    expect(applyHostRuntimeLeasedControl(f.target, first)).toMatchObject({
      status: "applied",
    });
    expect(applyHostRuntimeLeasedControl(f.target, release)).toMatchObject({
      status: "applied",
    });
    expect(input.getInput("player")).toBeUndefined();
    expect(applyHostRuntimeLeasedControl(f.target, first)).toEqual({
      status: "rejected",
      reason: "stale_sequence",
    });
    const another = {
      ...first,
      lease: { ...first.lease, id: "223e4567-e89b-42d3-a456-426614174001" },
    };
    expect(applyHostRuntimeLeasedControl(f.target, another)).toEqual({
      status: "rejected",
      reason: "lease_conflict",
    });
    clearHostRuntimeParticipant(f.target, "ROOM", "player");
    expect(applyHostRuntimeLeasedControl(f.target, another)).toMatchObject({
      status: "applied",
    });
  } finally {
    stop();
    f.close();
  }
});

it("never dispatches an uncertain throwing action again, including after a lost reply", async () => {
  const { agentAction } = await import("../src/agent/agent-contract");
  const { agentActionInput } = await import("../src/agent/agent-action");
  const f = observationFixture(
    {},
    {
      tap: agentAction.participant(
        { actionName: "increment" },
        { input: agentActionInput.none() },
      ),
    },
  );
  const unregister = f.receiver({
    isParticipant: () => true,
  });
  try {
    const observed = await f.observe({ ...f.request, includeImage: false });
    const action: ControllerLeasedControl = {
      ...request(observed.identity),
      operation: {
        kind: "action",
        deadlineMs: performance.now() + 2000,
        actionId: "tap",
      },
    };
    f.dispatchParticipant.mockImplementation(() => {
      throw new Error("Effect may have happened.");
    });
    expect(() => applyHostRuntimeLeasedControl(f.target, action)).toThrow(
      "Effect may have happened.",
    );
    expect(applyHostRuntimeLeasedControl(f.target, action)).toEqual({
      status: "unconfirmed",
      reason: "runtime_unavailable",
    });
    expect(f.dispatchParticipant).toHaveBeenCalledTimes(1);
  } finally {
    unregister();
    f.close();
  }
});

it("rejects malformed, oversized and unbounded operations at the wire boundary", async () => {
  const { controllerLeasedControlSchema } =
    await import("../src/protocol/leased-control");
  const f = observationFixture();
  try {
    const observed = await f.observe({ ...f.request, includeImage: false });
    const valid = request(observed.identity);
    expect(controllerLeasedControlSchema.safeParse(valid).success).toBe(true);
    for (const invalid of [
      { ...valid, roomId: "NEXT" },
      { ...valid, operation: { ...valid.operation, ttlMs: 2001 } },
      { ...valid, operation: { kind: "release", ttlMs: 100 } },
      {
        ...valid,
        operation: {
          kind: "action",
          deadlineMs: performance.now() + 2000,
          actionId: "tap",
          input: "a".repeat(16_384),
        },
      },
      { ...valid, host: true },
    ])
      expect(controllerLeasedControlSchema.safeParse(invalid).success).toBe(
        false,
      );
  } finally {
    f.close();
  }
});

it("shares input/action ordering and never extends movement with action acknowledgements or retries", async () => {
  const { agentAction } = await import("../src/agent/agent-contract");
  const { agentActionInput } = await import("../src/agent/agent-action");
  const clock = vi.spyOn(performance, "now").mockReturnValue(100);
  const f = observationFixture(
    {},
    {
      tap: agentAction.participant(
        { actionName: "increment" },
        { input: agentActionInput.none() },
      ),
    },
  );
  const input = manager();
  const stop = f.receiver({
    input,
    isParticipant: () => true,
  });
  try {
    const observed = await f.observe({ ...f.request, includeImage: false });
    const moving = request(observed.identity);
    expect(applyHostRuntimeLeasedControl(f.target, moving)).toMatchObject({
      status: "applied",
    });
    clock.mockReturnValue(200);
    const action: ControllerLeasedControl = {
      ...request(observed.identity, 2),
      operation: {
        kind: "action",
        deadlineMs: performance.now() + 2000,
        actionId: "tap",
      },
    };
    expect(applyHostRuntimeLeasedControl(f.target, action)).toMatchObject({
      status: "applied",
    });
    expect(input.getInput("player")).toEqual({ direction: 1 });
    clock.mockReturnValue(350);
    expect(applyHostRuntimeLeasedControl(f.target, action)).toMatchObject({
      status: "applied",
      replayed: true,
    });
    expect(input.getInput("player")).toBeUndefined();
    expect(applyHostRuntimeLeasedControl(f.target, moving)).toEqual({
      status: "rejected",
      reason: "stale_sequence",
    });
    expect(f.dispatchParticipant).toHaveBeenCalledTimes(1);
  } finally {
    stop();
    f.close();
    clock.mockRestore();
  }
});

afterEach(() => vi.restoreAllMocks());

it("refuses a delayed command after its participant has left, including cached receipts", async () => {
  const f = observationFixture();
  const input = manager();
  let present = true;
  const stop = f.receiver({
    input,
    isParticipant: () => present,
  });
  try {
    const observed = await f.observe({ ...f.request, includeImage: false });
    const command = request(observed.identity);
    expect(applyHostRuntimeLeasedControl(f.target, command)).toMatchObject({
      status: "applied",
    });
    present = false;
    const { clearHostRuntimeParticipant } =
      await import("../src/runtime/contracts/control");
    clearHostRuntimeParticipant(f.target, "ROOM", "player");
    expect(applyHostRuntimeLeasedControl(f.target, command)).toEqual({
      status: "rejected",
      reason: "unauthorized",
    });
    expect(
      applyHostRuntimeLeasedControl(f.target, request(observed.identity, 2)),
    ).toEqual({ status: "rejected", reason: "unauthorized" });
    expect(input.getInput("player")).toBeUndefined();
  } finally {
    stop();
    f.close();
  }
});

it("expires admission in the observed host clock, without losing receipts or cleanup", async () => {
  const { agentAction } = await import("../src/agent/agent-contract");
  const { agentActionInput } = await import("../src/agent/agent-action");
  const clock = vi.spyOn(performance, "now").mockReturnValue(100);
  const f = observationFixture(
    {},
    {
      tap: agentAction.participant(
        { actionName: "increment" },
        { input: agentActionInput.none() },
      ),
    },
  );
  const input = manager();
  const stop = f.receiver({ input });
  try {
    const observed = await f.observe({ ...f.request, includeImage: false });
    expect(observed.clock).toEqual({ startedAtMs: 100, finishedAtMs: 100 });
    const moving: ControllerLeasedControl = {
      ...request(observed.identity),
      operation: {
        kind: "input",
        deadlineMs: 200,
        input: { direction: 1 },
        ttlMs: 100,
      },
    };
    expect(applyHostRuntimeLeasedControl(f.target, moving)).toMatchObject({
      status: "applied",
    });
    clock.mockReturnValue(400);
    expect(input.getInput("player")).toBeUndefined();
    expect(applyHostRuntimeLeasedControl(f.target, moving)).toMatchObject({
      status: "applied",
      replayed: true,
    });
    expect(input.getInput("player")).toBeUndefined();
    const action: ControllerLeasedControl = {
      ...request(observed.identity, 2),
      operation: { kind: "action", deadlineMs: 200, actionId: "tap" },
    };
    expect(applyHostRuntimeLeasedControl(f.target, action)).toEqual({
      status: "rejected",
      reason: "stale_decision",
    });
    expect(f.dispatchParticipant).not.toHaveBeenCalled();
    expect(
      applyHostRuntimeLeasedControl(f.target, {
        ...action,
        operation: { kind: "action", deadlineMs: 2401, actionId: "tap" },
      }),
    ).toEqual({ status: "rejected", reason: "invalid_deadline" });
    expect(
      applyHostRuntimeLeasedControl(f.target, {
        ...action,
        operation: { kind: "release" },
      }),
    ).toMatchObject({ status: "applied" });
  } finally {
    stop();
    f.close();
    clock.mockRestore();
  }
});

it("recovers a receipt when a retry changes only JSON object key ordering", async () => {
  const f = observationFixture();
  const input = new InputManager({
    schema: z.object({
      direction: z.number(),
      metadata: z.record(z.string(), z.number()),
    }),
  });
  const set = vi.spyOn(input, "setLeasedInput");
  const stop = f.receiver({
    input,
    isParticipant: () => true,
  });
  try {
    const observed = await f.observe({ ...f.request, includeImage: false });
    const first = {
      ...request(observed.identity),
      operation: {
        kind: "input",
        deadlineMs: performance.now() + 2000,
        input: { direction: 1, metadata: { first: 1, second: 2 } },
        ttlMs: 250,
      },
    } satisfies ControllerLeasedControl;
    const retry: ControllerLeasedControl = {
      ...first,
      operation: {
        kind: "input",
        deadlineMs: first.operation.deadlineMs,
        ttlMs: 250,
        input: { metadata: { second: 2, first: 1 }, direction: 1 },
      },
    };
    expect(applyHostRuntimeLeasedControl(f.target, first)).toMatchObject({
      status: "applied",
      replayed: false,
    });
    expect(applyHostRuntimeLeasedControl(f.target, retry)).toMatchObject({
      status: "applied",
      replayed: true,
    });
    expect(set).toHaveBeenCalledTimes(1);
  } finally {
    stop();
    f.close();
  }
});

it("rejects pathological nesting and cyclic caller data before recursive JSON validation", async () => {
  const { controllerLeasedControlSchema } =
    await import("../src/protocol/leased-control");
  const f = observationFixture();
  try {
    const observed = await f.observe({ ...f.request, includeImage: false });
    let deeplyNested: unknown = null;
    for (let index = 0; index < 12_000; index++)
      deeplyNested = { nested: deeplyNested };
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    for (const input of [deeplyNested, cyclic, Array(4097).fill(0)]) {
      expect(() =>
        controllerLeasedControlSchema.safeParse({
          ...request(observed.identity),
          operation: {
            kind: "action",
            deadlineMs: performance.now() + 2000,
            actionId: "tap",
            input,
          },
        }),
      ).not.toThrow();
      expect(
        controllerLeasedControlSchema.safeParse({
          ...request(observed.identity),
          operation: {
            kind: "action",
            deadlineMs: performance.now() + 2000,
            actionId: "tap",
            input,
          },
        }).success,
      ).toBe(false);
    }
  } finally {
    f.close();
  }
});

it("fences a receiver replacement even when the renderer, contract and store epochs stay the same", async () => {
  const f = observationFixture();
  const input = manager();
  const stopFirst = f.receiver({ input });
  const first = await f.observe({ ...f.request, includeImage: false });
  expect(
    applyHostRuntimeLeasedControl(f.target, request(first.identity)),
  ).toMatchObject({ status: "applied" });
  stopFirst();
  const successor = manager();
  const stop = f.receiver({ input: successor });
  try {
    const second = await f.observe({ ...f.request, includeImage: false });
    expect(second.identity.runtimeId).toBe(first.identity.runtimeId);
    expect(second.identity.contractId).toBe(first.identity.contractId);
    expect(second.identity.surfaceId).toBe(first.identity.surfaceId);
    expect(second.identity.participantId).not.toBe(
      first.identity.participantId,
    );
    expect(
      applyHostRuntimeLeasedControl(f.target, request(first.identity, 2)),
    ).toEqual({ status: "rejected", reason: "stale_identity" });
    expect(successor.getInput("player")).toBeUndefined();
  } finally {
    stop();
    f.close();
  }
});

it("reports the actual input schema and brackets core paused/playing state around capture", async () => {
  const f = observationFixture();
  const stop = f.receiver({ input: manager() });
  const stopSurface = f.surface({
    read: () => ({ state: {} }),
    capture: async () => {
      f.hostState.runtimeState = "paused";
      return null;
    },
  });
  try {
    const observed = await f.observe(f.request);
    expect(observed.host).toEqual({
      before: { runtimeState: "playing", connectionStatus: "connected" },
      after: { runtimeState: "paused", connectionStatus: "connected" },
    });
    expect(
      observed.capabilities?.participantControl?.inputSchema,
    ).toMatchObject({
      status: "available",
      schema: {
        type: "object",
        properties: { direction: { type: "number", minimum: -1, maximum: 1 } },
      },
    });
  } finally {
    stopSurface();
    stop();
    f.close();
  }
});

it("never combines old input capabilities with a successor receiver during capture", async () => {
  const f = observationFixture();
  const stop = f.receiver({ input: manager() });
  let stopSuccessor: (() => void) | undefined;
  const stopSurface = f.surface({
    read: () => ({ state: {} }),
    capture: async () => {
      stop();
      stopSuccessor = f.receiver({ input: manager() });
      return null;
    },
  });
  try {
    await expect(f.observe(f.request)).rejects.toThrow("observation_replaced");
  } finally {
    stopSurface();
    stopSuccessor?.();
    stop();
    f.close();
  }
});

import type { ControllerLeasedControlAck } from "@air-jam/sdk/protocol";
import { expect, it, vi } from "vitest";
import { currentRoomHost } from "../src/current-room-host.js";
import type {
  DecisionAnswer,
  DecisionProvider,
} from "../src/decision-provider.js";
import type { GameRunSession } from "../src/game-run-owner.js";
import { attachment, fixture, io, tapOrWait } from "./game-run-fixture.js";

it.each([
  { status: 410, reason: "stopped", message: "Stopped by the partner." },
  {
    status: 403,
    reason: "runtime_replaced",
    message: "The game reloaded in the creator's editor.",
  },
])(
  "keeps $reason when the grant refusal arrives before a delayed cancel",
  async ({ status, reason, message }) => {
    const f = await fixture();
    f.session.summary.semanticAccess = "delegated-host";
    const granted = attachment();
    const host = currentRoomHost(granted, f.session.summary.ownerInstanceId);
    const observe = f.session.observe;
    let revoked = false;
    const shutdown = Promise.withResolvers<void>();
    io.stopPolicy.mockReturnValue(shutdown.promise);
    io.decide.mockResolvedValue({
      control: { kind: "input", input: { direction: 1 } },
    });
    vi.stubGlobal("fetch", async (_url: string, options: RequestInit) => {
      if (revoked) return Response.json({ error: message }, { status });
      const { request } = JSON.parse(String(options.body));
      return Response.json({
        ok: true,
        response: { operation: "observe", observation: await observe(request) },
      });
    });
    f.session.observe = vi.fn(async (options) => {
      const response = await host(
        {
          operation: "observe",
          roomId: "ROOM",
          controllerId: "player",
          ...options,
        },
        5000,
      );
      if (response.operation !== "observe") throw new Error("Expected observe");
      return response.observation;
    });
    try {
      await f.owner.start(
        { kind: "play", runId: f.request.runId, target: { kind: "current" } },
        granted,
      );
      await vi.waitFor(() => expect(f.events).toContain("input"));
      vi.useFakeTimers({ toFake: ["Date"] });
      const revokedAt = Date.now();
      revoked = true;
      await vi.waitFor(() => expect(f.session.close).toHaveBeenCalledOnce());
      const stopping = await f.owner.read(f.request.runId);
      expect(stopping.end?.reason).toBe(reason);
      expect(stopping.end?.message).toContain(message);
      if (status === 410) {
        expect(stopping.stopRequestedAt).toBe(stopping.abortedAt);
        expect(
          Date.parse(stopping.stopRequestedAt ?? ""),
        ).toBeGreaterThanOrEqual(revokedAt);
      } else expect(stopping.stopRequestedAt).toBeUndefined();
      expect(
        Date.parse(stopping.releaseAcknowledgedAt ?? "") - revokedAt,
      ).toBeLessThanOrEqual(2000);
      const controls = vi.mocked(f.session.control).mock.calls.slice();
      expect(controls.at(-1)?.[0].operation.kind).toBe("release");
      expect(Date.parse(stopping.lastInputAt ?? "")).toBeLessThanOrEqual(
        Date.parse(stopping.abortedAt ?? ""),
      );
      vi.setSystemTime(revokedAt + 5000);
      shutdown.resolve();
      const ended = await f.ended();
      expect(await f.owner.stop(f.request.runId)).toEqual(ended);
      expect(vi.mocked(f.session.control).mock.calls).toEqual(controls);
    } finally {
      shutdown.resolve();
      vi.unstubAllGlobals();
      vi.useRealTimers();
    }
  },
);

it("overlaps fresh policy preparation with attachment and reuses the run's game inspection", async () => {
  const f = await fixture();
  f.session.summary.semanticAccess = "delegated-host";
  const prepared = Promise.withResolvers<void>();
  const attached = Promise.withResolvers<GameRunSession>();
  const startPolicy = io.startPolicy.getMockImplementation();
  if (!startPolicy) throw new Error("Missing policy fixture");
  io.startPolicy.mockImplementation(async (options) => {
    await prepared.promise;
    return startPolicy(options);
  });
  f.openSession.mockReturnValueOnce(attached.promise);
  io.decide.mockImplementation(() => new Promise(() => {}));
  await f.owner.start(
    { kind: "play", runId: f.request.runId, target: { kind: "current" } },
    attachment(),
  );
  await vi.waitFor(() => {
    expect(io.startPolicy).toHaveBeenCalledOnce();
    expect(f.openSession).toHaveBeenCalledOnce();
  });
  expect(io.inspectGame).toHaveBeenCalledOnce();
  expect(f.openSession).toHaveBeenCalledWith(
    expect.objectContaining({
      game: await io.inspectGame.mock.results[0].value,
    }),
  );
  vi.useFakeTimers({ toFake: ["Date"] });
  try {
    const started = Date.now();
    vi.setSystemTime(started + 1000);
    attached.resolve(f.session);
    await vi.waitFor(() =>
      expect(f.session.readParticipants).toHaveBeenCalled(),
    );
    vi.setSystemTime(started + 4000);
    prepared.resolve();
    await vi.waitFor(() => expect(io.decide).toHaveBeenCalledOnce());
    const record = await f.owner.stop(f.request.runId);
    expect(Date.parse(record.rosterJoinedAt ?? "") - started).toBeLessThan(
      2000,
    );
    expect(record.policyInitializationMs).toBeGreaterThanOrEqual(0);
  } finally {
    prepared.resolve();
    attached.resolve(f.session);
    vi.useRealTimers();
  }
});

it.each(["play", "test"] as const)(
  "%s fences a late policy answer with slow shutdown and keeps its own teardown",
  async (kind) => {
    const answer = Promise.withResolvers<DecisionAnswer>();
    const shutdown = Promise.withResolvers<void>();
    const decisions = vi.fn<DecisionProvider["ask"]>(() => answer.promise);
    const f = await fixture({ decisions });
    f.session.summary.semanticAccess = "delegated-host";
    io.decide.mockResolvedValue(tapOrWait);
    io.stopPolicy.mockReturnValue(shutdown.promise);
    if (kind === "play")
      await f.owner.start(
        { kind, runId: f.request.runId, target: { kind: "current" } },
        attachment(),
      );
    else {
      f.request.target = { kind: "current" };
      await f.owner.start(f.request, attachment());
    }
    await vi.waitFor(() => expect(decisions).toHaveBeenCalledOnce());
    const observations = vi.mocked(f.session.observe).mock.calls.length;
    const controls = vi.mocked(f.session.control).mock.calls.length;
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      const stoppedAt = Date.now();
      const stopping = f.owner.stop(f.request.runId);
      await vi.waitFor(() => expect(io.stopPolicy).toHaveBeenCalledOnce());
      answer.resolve({ choice: "wait", confidence: 1 });
      await new Promise((resolve) => setImmediate(resolve));
      expect(f.events).not.toContain("input");
      if (kind === "play") {
        expect(f.session.close).toHaveBeenCalledOnce();
        const releasing = vi
          .mocked(f.session.control)
          .mock.calls.slice(controls);
        expect(releasing.map(([request]) => request.operation.kind)).toEqual([
          "release",
        ]);
        const record = await f.owner.read(f.request.runId);
        expect(
          Date.parse(record.releaseAcknowledgedAt ?? "") - stoppedAt,
        ).toBeLessThanOrEqual(2000);
        expect(vi.mocked(f.session.observe).mock.calls).toHaveLength(
          observations,
        );
      } else expect(f.session.close).not.toHaveBeenCalled();
      vi.setSystemTime(stoppedAt + 5000);
      shutdown.resolve();
      const record = await stopping;
      expect(record.stopRequestedAt).toBe(new Date(stoppedAt).toISOString());
      expect(record.abortedAt).toBe(record.stopRequestedAt);
      expect(record.end?.reason).toBe("stopped");
      if (kind === "test") {
        expect(f.events).toContain("final-observation");
        expect(io.evaluate).toHaveBeenCalledWith(
          expect.objectContaining({ phase: "final" }),
          expect.any(Number),
        );
        expect(record.evidence?.observation).toBeDefined();
      } else {
        expect(record.evaluation).toBeUndefined();
        expect(record.evidence?.observation).toBeFalsy();
      }
    } finally {
      shutdown.resolve();
      answer.resolve({ choice: "wait", confidence: 1 });
      vi.useRealTimers();
    }
  },
);

it("never retries an unconfirmed play input after abort", async () => {
  const f = await fixture();
  f.session.summary.semanticAccess = "delegated-host";
  io.decide.mockResolvedValue({
    control: { kind: "input", input: { direction: 1 } },
  });
  const pending = Promise.withResolvers<ControllerLeasedControlAck>();
  const control = f.session.control;
  f.session.control = vi.fn((request) =>
    request.operation.kind === "input" ? pending.promise : control(request),
  );
  await f.owner.start(
    { kind: "play", runId: f.request.runId, target: { kind: "current" } },
    attachment(),
  );
  await vi.waitFor(() =>
    expect(f.session.control).toHaveBeenCalledWith(
      expect.objectContaining({
        operation: expect.objectContaining({
          kind: "input",
          input: { direction: 1 },
        }),
      }),
    ),
  );
  const stopping = f.owner.stop(f.request.runId);
  pending.resolve({
    status: "unconfirmed",
    reason: "transport_ack_unavailable",
  });
  const record = await stopping;
  expect(
    vi
      .mocked(f.session.control)
      .mock.calls.filter(([request]) => request.operation.kind === "input"),
  ).toHaveLength(1);
  expect(record.lastInputAt).toBeDefined();
  expect(Date.parse(record.lastInputAt ?? "")).toBeLessThanOrEqual(
    Date.parse(record.abortedAt ?? ""),
  );
  expect(record.cleanup?.seats[0].release?.status).toBe("applied");
});

import type { ControllerLeasedControlAck } from "@air-jam/sdk/protocol";
import { expect, it, vi } from "vitest";
import type {
  DecisionAnswer,
  DecisionProvider,
} from "../src/decision-provider.js";
import type { GameRunSession } from "../src/game-run-owner.js";
import { attachment, fixture, io, tapOrWait } from "./game-run-fixture.js";

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

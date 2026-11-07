import { randomUUID } from "node:crypto";
import { expect, it } from "vitest";
import { startGameRunSchema } from "../src/game-run-protocol.js";
import { PLAY_RUN_PLAYER } from "../src/testing.js";

it("accepts profile-free play only in the granted current room", () => {
  const request = {
    kind: "play",
    runId: randomUUID(),
    target: { kind: "current" },
    intent: "Play the other paddle",
  };
  expect(startGameRunSchema.parse(request)).toEqual({ ...request, seed: 0 });
  for (const extra of [
    { profileId: "pong" },
    { policyId: "model" },
    { budget: { durationMs: 1000, steps: 1 } },
    { settings: {} },
    { target: { kind: "owned" } },
    { target: { kind: "headless" } },
  ])
    expect(startGameRunSchema.safeParse({ ...request, ...extra }).success).toBe(
      false,
    );
  expect(PLAY_RUN_PLAYER).toEqual({
    seats: [{ id: "player", label: "Player" }],
    scope: "player",
    includeImage: false,
    timing: { intervalMs: 100, decisionMs: 1200, inputTtlMs: 1500 },
  });
});
it("keeps existing test admission and settings restrictions", () => {
  const request = {
    runId: randomUUID(),
    target: { kind: "owned" },
    profileId: "pong",
    policyId: "code",
    budget: { durationMs: 1000, steps: 10 },
  };
  expect(startGameRunSchema.parse(request)).toEqual({
    ...request,
    kind: "test",
    seed: 0,
  });
  expect(
    startGameRunSchema.safeParse({
      ...request,
      target: { kind: "current" },
      settings: {},
    }).success,
  ).toBe(false);
});

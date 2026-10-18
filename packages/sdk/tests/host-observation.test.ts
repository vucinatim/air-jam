import { describe, expect, it, vi } from "vitest";
import {
  hostObservationImageSchema,
  hostObservationRequestSchema,
  hostObservationSchema,
} from "../src/runtime/contracts/observation";
import { observationFixture } from "./fixtures/host-observation";

describe("owned host observations", () => {
  it("accepts the maximum image payload and rejects a larger payload with the same encoded length", () => {
    const image = {
      mimeType: "image/jpeg",
      width: 1280,
      height: 720,
      coverage: "render-surface",
      data: Buffer.alloc(640_000).toString("base64"),
    };
    expect(hostObservationImageSchema.safeParse(image).success).toBe(true);
    const tooLarge = Buffer.alloc(640_001).toString("base64");
    expect(tooLarge.length).toBe(image.data.length);
    expect(
      hostObservationImageSchema.safeParse({ ...image, data: tooLarge })
        .success,
    ).toBe(false);
  });
  it("reads fresh host-local state and honest capture intervals without leaking raw stores or granting actions", async () => {
    const game = observationFixture();
    let tick = 3;
    const remove = game.surface({
      read: ({ scope, controllerId }) => ({
        state: { ball: { x: tick }, scope, controllerId },
        tick,
      }),
      capture: async () => {
        tick = 4;
        return {
          mimeType: "image/jpeg",
          data: "YWJj",
          width: 20,
          height: 10,
          coverage: "render-surface",
        };
      },
    });
    const first = await game.observe(game.request);
    expect(first).toMatchObject({
      sequence: 1,
      snapshot: { score: 2, controllerId: null },
      runtime: { ball: { x: 3 }, scope: "diagnostic", controllerId: null },
      ticks: { before: 3, after: 4 },
      visual: { status: "captured", image: { coverage: "render-surface" } },
      stores: {
        before: [{ storeDomain: "default", revision: 7 }],
        after: [{ storeDomain: "default", revision: 7 }],
      },
    });
    expect(JSON.stringify(first)).not.toContain("not-projected");
    expect(first.actions).toEqual([]);
    expect(game.invoke).not.toHaveBeenCalled();
    const next = await game.observe({
      ...game.request,
      expected: first.identity,
      scope: "player",
      controllerId: "seat",
    });
    expect(next.sequence).toBe(2);
    expect(next.runtime).toMatchObject({
      controllerId: "seat",
      scope: "player",
    });
    expect(next.id).not.toBe(first.id);
    remove();
    game.close();
  });

  it("distinguishes unsupported, unmounted and deliberately omitted images", async () => {
    const game = observationFixture();
    expect((await game.observe(game.request)).visual).toEqual({
      status: "unavailable",
      reason: "unsupported",
    });
    const remove = game.surface({
      read: () => ({ state: {} }),
      capture: () => null,
    });
    expect((await game.observe(game.request)).visual).toEqual({
      status: "unavailable",
      reason: "surface-unavailable",
    });
    expect(
      (await game.observe({ ...game.request, includeImage: false })).visual,
    ).toEqual({ status: "unavailable", reason: "not-requested" });
    remove();
    game.close();
  });

  it("rejects stale surface identities and a replacement during async capture", async () => {
    const game = observationFixture();
    let remove = game.surface({ read: () => ({ state: {} }) });
    const before = await game.observe(game.request);
    remove();
    remove = game.surface({ read: () => ({ state: {} }) });
    await expect(
      game.observe({ ...game.request, expected: before.identity }),
    ).rejects.toThrow("observation_replaced");
    remove();
    remove = game.surface({
      read: () => ({ state: {} }),
      capture: async () => {
        remove();
        return null;
      },
    });
    await expect(game.observe(game.request)).rejects.toThrow(
      "observation_replaced",
    );
    game.close();
  });

  it("rejects ambiguous owners and keeps replacement cleanup independent", async () => {
    const game = observationFixture();
    const first = game.surface({ read: () => ({ state: {} }) });
    const second = game.surface({ read: () => ({ state: { active: true } }) });
    await expect(game.observe(game.request)).rejects.toThrow(
      "observation_surface_ambiguous",
    );
    first();
    first();
    expect((await game.observe(game.request)).runtime).toEqual({
      active: true,
    });
    second();
    game.close();
  });

  it("rejects malformed requests, unrelated rooms, excessive state and invalid authored projections", async () => {
    const game = observationFixture();
    expect(
      hostObservationRequestSchema.safeParse({
        ...game.request,
        operation: "invoke-host",
      }).success,
    ).toBe(false);
    await expect(
      game.observe({ ...game.request, roomId: "OTHER" }),
    ).rejects.toThrow("contract_runtime_unavailable");
    const remove = game.surface({
      read: () => ({ state: { tooLarge: "x".repeat(128_001) } }),
    });
    await expect(game.observe(game.request)).rejects.toThrow("state budget");
    remove();
    const invalid = game.surface({
      read: () => ({ state: { callback: () => 0 } }),
    });
    await expect(game.observe(game.request)).rejects.toThrow(
      "serializable JSON",
    );
    invalid();
    game.close();
  });

  it("retains a bounded validated JSON envelope", async () => {
    const game = observationFixture();
    const observation = await game.observe(game.request);
    expect(
      hostObservationSchema.parse(JSON.parse(JSON.stringify(observation))),
    ).toEqual(observation);
    game.close();
  });

  it("bounds a stalled authored capture and never publishes its late result", async () => {
    vi.useFakeTimers();
    const game = observationFixture();
    const remove = game.surface({
      read: () => ({ state: {} }),
      capture: () => new Promise(() => {}),
    });
    try {
      const observation = expect(game.observe(game.request)).rejects.toThrow(
        "observation_timeout",
      );
      await vi.advanceTimersByTimeAsync(3_000);
      await observation;
      expect(game.invoke).not.toHaveBeenCalled();
    } finally {
      remove();
      game.close();
      vi.useRealTimers();
    }
  });
});

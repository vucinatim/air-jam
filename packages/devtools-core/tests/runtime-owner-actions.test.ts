import type { VisualHarnessPageSurface } from "@air-jam/harness/visual";
import {
  AIR_JAM_RUNTIME_CONTROL_KEY,
  type HostRuntimeActionRequest,
} from "@air-jam/sdk/runtime-control";
import { afterEach, describe, expect, it, vi } from "vitest";
import { invokeOwnedHostAction } from "../src/tooling/runtime-owner-actions.js";

const request: HostRuntimeActionRequest = {
  roomId: "ROOM",
  storeDomain: "default",
  actionName: "finishMatch",
  payload: { score: 2 },
};
const hostFixture = (embedded: boolean) => {
  const evaluate = vi.fn(
    async (fn: (element: null, arg: unknown) => unknown, arg: unknown) =>
      await fn(null, arg),
  );
  const game = { locator: vi.fn(() => ({ evaluate })) };
  const page = embedded
    ? {
        locator: vi.fn(() => {
          throw new Error("Shell fallback is forbidden");
        }),
      }
    : game;
  return {
    host: { game, page, embedded } as unknown as VisualHarnessPageSurface,
    evaluate,
    game,
    page,
  };
};

afterEach(() => vi.unstubAllGlobals());

describe("owned host game realm control", () => {
  it.each([false, true])(
    "calls the canonical dispatcher only in its owned game realm (embedded=%s)",
    async (embedded) => {
      const fixture = hostFixture(embedded);
      const acknowledgement = {
        ok: true,
        status: "accepted",
        source: "host",
        result: { changed: true },
      };
      const invoke = vi.fn(async () => acknowledgement);
      vi.stubGlobal("window", { [AIR_JAM_RUNTIME_CONTROL_KEY]: { invoke } });
      expect(await invokeOwnedHostAction(fixture.host, request)).toBe(
        acknowledgement,
      );
      expect(invoke).toHaveBeenCalledExactlyOnceWith(request);
      expect(fixture.game.locator).toHaveBeenCalledExactlyOnceWith("body");
      if (embedded) expect(fixture.page.locator).not.toHaveBeenCalled();
    },
  );

  it("preserves domain rejections from the live SDK binding", async () => {
    const acknowledgement = {
      ok: false,
      status: "rejected",
      source: "client",
      reason: "host_runtime_not_registered",
    };
    vi.stubGlobal("window", {
      [AIR_JAM_RUNTIME_CONTROL_KEY]: { invoke: async () => acknowledgement },
    });
    expect(await invokeOwnedHostAction(hostFixture(true).host, request)).toBe(
      acknowledgement,
    );
  });

  it("does not fall back when the owned frame has no control binding", async () => {
    vi.stubGlobal("window", {});
    const fixture = hostFixture(true);
    expect(await invokeOwnedHostAction(fixture.host, request)).toMatchObject({
      ok: false,
      reason: "host_runtime_unavailable",
    });
    expect(fixture.page.locator).not.toHaveBeenCalled();
  });

  it("reports a detached frame without exposing browser internals", async () => {
    const fixture = hostFixture(true);
    fixture.evaluate.mockRejectedValueOnce(
      new Error("Frame detached: private browser details"),
    );
    const result = await invokeOwnedHostAction(fixture.host, request);
    expect(result).toMatchObject({
      ok: false,
      reason: "host_ack_missing",
    });
    expect(JSON.stringify(result)).not.toContain("private browser details");
  });
});

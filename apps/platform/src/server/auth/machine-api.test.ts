import { describe, expect, it } from "vitest";
import { toMachineApiErrorResponse } from "./machine-api";
import { PlatformMachineAuthError } from "./machine-auth-errors";

describe("machine API errors", () => {
  it("preserves structured admission details and retry timing", async () => {
    const decision = {
      contractVersion: 1,
      decisionId: "decision-1",
      lane: "release_processing",
      controlStatus: "available",
      mode: "paused",
      outcome: "denied",
      reason: "lane_paused",
      retryAfterSeconds: 120,
      controlRevision: 3,
    };
    const response = toMachineApiErrorResponse(
      new PlatformMachineAuthError({
        code: "rate_limited",
        message: "Release processing is paused.",
        status: 503,
        retryAfterSeconds: 120,
        details: { decision },
      }),
    );

    expect(response.status).toBe(503);
    expect(response.headers.get("retry-after")).toBe("120");
    expect(await response.json()).toEqual({
      error: "rate_limited",
      message: "Release processing is paused.",
      retryAfterSeconds: 120,
      details: { decision },
    });
  });
});

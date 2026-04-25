import { describe, expect, it } from "vitest";
import { resolveReleasePostModerationAction } from "./release-artifact-service";

describe("resolveReleasePostModerationAction", () => {
  it("promotes only passed moderation outcomes to ready", () => {
    expect(
      resolveReleasePostModerationAction({
        outcome: "passed",
        reason: null,
      }),
    ).toEqual({ kind: "ready" });
  });

  it("preserves quarantined moderation outcomes", () => {
    expect(
      resolveReleasePostModerationAction({
        outcome: "flagged",
        reason: null,
      }),
    ).toEqual({ kind: "quarantined" });
  });

  it("fails closed when moderation is skipped", () => {
    expect(
      resolveReleasePostModerationAction({
        outcome: "skipped",
        reason: "Moderation is unavailable.",
      }),
    ).toEqual({
      kind: "failed",
      message: "Moderation is unavailable.",
    });
  });
});

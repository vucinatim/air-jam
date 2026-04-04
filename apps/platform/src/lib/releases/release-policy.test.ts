import { describe, expect, it } from "vitest";
import { canTransitionReleaseStatus } from "./release-policy";

describe("release status transitions", () => {
  it("allows ready releases to be quarantined by ops", () => {
    expect(canTransitionReleaseStatus("ready", "quarantined")).toBe(true);
  });

  it("blocks invalid quarantine transitions", () => {
    expect(canTransitionReleaseStatus("archived", "quarantined")).toBe(false);
    expect(canTransitionReleaseStatus("failed", "quarantined")).toBe(false);
  });
});

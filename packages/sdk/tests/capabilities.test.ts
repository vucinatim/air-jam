import { describe, expect, it } from "vitest";
import { defineAirJamGameCapabilities } from "../src/capabilities";

describe("game capabilities manifest", () => {
  it("creates a narrow frozen manifest with versioned sections", () => {
    const capabilities = defineAirJamGameCapabilities({
      actions: [
        {
          key: "move",
          label: "Move",
          kind: "axis",
          audience: "controller",
        },
      ],
      state: [
        {
          key: "matchPhase",
          label: "Match Phase",
          kind: "phase",
          audience: "shared",
        },
      ],
      evaluation: [
        {
          key: "score",
          label: "Score",
          kind: "score",
          audience: "host",
        },
      ],
    });

    expect(capabilities).toEqual({
      version: 1,
      actions: [
        {
          key: "move",
          label: "Move",
          kind: "axis",
          audience: "controller",
        },
      ],
      state: [
        {
          key: "matchPhase",
          label: "Match Phase",
          kind: "phase",
          audience: "shared",
        },
      ],
      evaluation: [
        {
          key: "score",
          label: "Score",
          kind: "score",
          audience: "host",
        },
      ],
    });
    expect(Object.isFrozen(capabilities)).toBe(true);
    expect(Object.isFrozen(capabilities.actions)).toBe(true);
    expect(Object.isFrozen(capabilities.state)).toBe(true);
    expect(Object.isFrozen(capabilities.evaluation)).toBe(true);
  });
});

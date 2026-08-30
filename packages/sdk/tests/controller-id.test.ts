import { afterEach, describe, expect, it, vi } from "vitest";
import { generateControllerId } from "../src/utils/ids";

describe("controller identity", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("uses an opaque UUID when secure randomness is available", () => {
    vi.stubGlobal("crypto", {
      randomUUID: () => "123e4567-e89b-12d3-a456-426614174000",
    });

    expect(generateControllerId()).toBe(
      "C123e4567e89b12d3a456426614174000",
    );
  });

  it("keeps fallback identities unique when time and randomness repeat", () => {
    vi.stubGlobal("crypto", undefined);
    vi.spyOn(Date, "now").mockReturnValue(1_700_000_000_000);
    vi.spyOn(Math, "random").mockReturnValue(0.5);

    const identities = Array.from({ length: 64 }, () =>
      generateControllerId(),
    );

    expect(new Set(identities)).toHaveLength(identities.length);
    expect(identities.every((identity) => identity.startsWith("C"))).toBe(
      true,
    );
  });
});

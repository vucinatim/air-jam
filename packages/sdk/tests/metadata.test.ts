import { describe, expect, it } from "vitest";
import {
  defineAirJamGameMetadata,
  parseAirJamGameMetadata,
} from "../src/metadata";

const baseInput = {
  slug: "my-cool-game",
  name: "My Cool Game",
  tagline: "A short, clear pitch.",
  category: "party" as const,
  minPlayers: 2,
  maxPlayers: 6,
  inputModalities: ["buttons", "joystick"] as const,
  supportedSdkRange: "^1.0.0",
  maintainer: { name: "Creator" },
};

describe("air jam game metadata manifest", () => {
  it("defines a frozen v1 manifest with defaults applied", () => {
    const metadata = defineAirJamGameMetadata({ ...baseInput });

    expect(metadata.version).toBe(1);
    expect(metadata.slug).toBe("my-cool-game");
    expect(metadata.inputModalities).toEqual(["buttons", "joystick"]);
    expect(Object.isFrozen(metadata)).toBe(true);
  });

  it("rejects uppercase or whitespace in slug", () => {
    expect(() =>
      defineAirJamGameMetadata({ ...baseInput, slug: "My Game" }),
    ).toThrow();
    expect(() =>
      defineAirJamGameMetadata({ ...baseInput, slug: "SHOUTY" }),
    ).toThrow();
  });

  it("rejects inverted player counts", () => {
    expect(() =>
      defineAirJamGameMetadata({
        ...baseInput,
        minPlayers: 5,
        maxPlayers: 3,
      }),
    ).toThrow(/minPlayers/);
  });

  it("rejects out-of-range player counts", () => {
    expect(() =>
      defineAirJamGameMetadata({ ...baseInput, minPlayers: 0 }),
    ).toThrow();
    expect(() =>
      defineAirJamGameMetadata({ ...baseInput, maxPlayers: 99 }),
    ).toThrow();
  });

  it("requires at least one input modality", () => {
    expect(() =>
      defineAirJamGameMetadata({
        ...baseInput,
        inputModalities: [] as unknown as ["buttons"],
      }),
    ).toThrow();
  });

  it("accepts a valid semver range for supportedSdkRange", () => {
    const metadata = defineAirJamGameMetadata({
      ...baseInput,
      supportedSdkRange: ">=1.2 <2",
    });
    expect(metadata.supportedSdkRange).toBe(">=1.2 <2");
  });

  it("parseAirJamGameMetadata returns ok=false on invalid input", () => {
    const result = parseAirJamGameMetadata({ slug: "bad input!" });
    expect(result.ok).toBe(false);
  });

  it("parseAirJamGameMetadata returns ok=true on valid stored metadata", () => {
    const defined = defineAirJamGameMetadata({ ...baseInput });
    const result = parseAirJamGameMetadata(defined);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.slug).toBe("my-cool-game");
    }
  });
});

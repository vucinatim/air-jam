import { describe, expect, it } from "vitest";
import { defineAirJamAssets } from "../src/core/assets";
import { defineAirJamGame } from "../src/core/game";
import { describeAirJamGame } from "../src/core/game-description";
import { defineAirJamTheme } from "../src/core/theme";
import { defineAirJamGameMetadata } from "../src/metadata";

describe("assets and theme declarations", () => {
  it("describes the exact assets and theme without framework imports", () => {
    const assets = defineAirJamAssets({
      sounds: {
        score: { src: ["/sounds/score.wav"], surface: "host", volume: 0.6 },
      },
      images: { player: { src: "/player.png" } },
      files: { fire: { src: "/fire.json" } },
    });
    const theme = defineAirJamTheme({
      colors: { team1: "#f97316", surface: "rgba(8, 12, 24, 0.82)" },
      fonts: { display: '"Avenir Next", sans-serif' },
    });
    const game = defineAirJamGame({
      metadata: defineAirJamGameMetadata({
        slug: "fixture",
        name: "Fixture",
        tagline: "Fixture",
        category: "arcade",
        minPlayers: 1,
        maxPlayers: 4,
        inputModalities: ["buttons"],
        supportedSdkRange: "^1.0.0",
        maintainer: { name: "Air Jam" },
      }),
      assets,
      theme,
    });
    expect(describeAirJamGame(game)).toMatchObject({ assets, theme });
  });
  it.each([
    "relative.png",
    "//elsewhere/image.png",
    "/../image.png",
    "/image..png",
    "/image.png?size=2",
    "/image.png#fragment",
    "/%2e%2e/image.png",
  ])("rejects an unserved public path: %s", (src) => {
    expect(() =>
      defineAirJamAssets({
        sounds: {},
        images: { invalid: { src } },
        files: {},
      }),
    ).toThrow();
  });
  it("rejects malformed sound settings and CSS injection", () => {
    expect(() =>
      defineAirJamAssets({
        sounds: { hit: { src: [], volume: 2 } },
        images: {},
        files: {},
      }),
    ).toThrow();
    expect(() =>
      defineAirJamTheme({
        colors: { team1: "#fff;}body{color:red" },
        fonts: {},
      }),
    ).toThrow();
    expect(() =>
      defineAirJamTheme({
        colors: {},
        fonts: { display: "serif;</style><script>" },
      }),
    ).toThrow();
    expect(() =>
      defineAirJamTheme({ colors: { "team-one": "#fff" }, fonts: {} }),
    ).toThrow();
  });
});

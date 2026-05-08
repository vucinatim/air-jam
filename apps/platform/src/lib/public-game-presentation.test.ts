import { describe, expect, it } from "vitest";

import {
  getPublicGameCreators,
  getPublicGameDisplayName,
  getPublicGameOwnerName,
  selectFeaturedPublicGames,
} from "./public-game-presentation";

describe("public game presentation", () => {
  it("renames the minimal catalog entry for public display", () => {
    expect(
      getPublicGameDisplayName({
        name: "Minimal",
        slug: "minimal",
      }),
    ).toBe("Minimal Template");
  });

  it("keeps non-template names unchanged", () => {
    expect(
      getPublicGameDisplayName({
        name: "Pong",
        slug: "pong",
      }),
    ).toBe("Pong");
  });

  it("overrides curated public creator labels where needed", () => {
    expect(
      getPublicGameOwnerName({
        name: "Last Band Standing",
        slug: "last-band-standing",
        ownerName: "AirJam",
      }),
    ).toBe("AirJam + zerodays");

    expect(
      getPublicGameOwnerName({
        name: "Pong",
        slug: "pong",
        ownerName: "AirJam",
      }),
    ).toBe("AirJam");
  });

  it("returns curated creator stacks for public games", () => {
    expect(
      getPublicGameCreators({
        name: "Code Review",
        slug: "code-review",
        ownerName: "AirJam",
      }).map((creator) => creator.name),
    ).toEqual(["Tim Kalan", "Žiga Pk", "Miha Majetić"]);

    expect(
      getPublicGameCreators({
        name: "Pong",
        slug: "pong",
        ownerName: "AirJam",
      }).map((creator) => creator.name),
    ).toEqual(["Tim Vučina"]);
  });

  it("returns featured landing games in curated order", () => {
    const games = [
      { name: "Pong", slug: "pong" },
      { name: "Air Capture", slug: "air-capture" },
      { name: "The Office", slug: "the-office" },
      { name: "Last Band Standing", slug: "last-band-standing" },
      { name: "Code Review", slug: "code-review" },
    ];

    expect(selectFeaturedPublicGames(games)).toEqual([
      { name: "Air Capture", slug: "air-capture" },
      { name: "Last Band Standing", slug: "last-band-standing" },
      { name: "Code Review", slug: "code-review" },
      { name: "The Office", slug: "the-office" },
    ]);
  });
});

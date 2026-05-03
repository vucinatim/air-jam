import { describe, expect, it } from "vitest";

import {
  getPublicGameDisplayName,
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

  it("returns featured landing games in curated order", () => {
    const games = [
      { name: "Pong", slug: "pong" },
      { name: "The Office", slug: "the-office" },
      { name: "Last Band Standing", slug: "last-band-standing" },
      { name: "Code Review", slug: "code-review" },
    ];

    expect(selectFeaturedPublicGames(games)).toEqual([
      { name: "Last Band Standing", slug: "last-band-standing" },
      { name: "Code Review", slug: "code-review" },
      { name: "The Office", slug: "the-office" },
    ]);
  });
});

import { describe, expect, it } from "vitest";
import {
  getLocalReferenceArcadeGame,
  getLocalReferenceArcadeGames,
} from "./local-reference-games";

describe("local reference games", () => {
  it("defaults to air capture in development", () => {
    const games = getLocalReferenceArcadeGames({
      env: {},
      nodeEnv: "development",
    });

    expect(games).toHaveLength(1);
    expect(games[0]).toMatchObject({
      slug: "local-air-capture",
      name: "Air Capture",
      url: "http://127.0.0.1:5173",
      catalogSource: "local_dev",
      catalogBadgeLabel: "Local Dev",
    });
  });

  it("allows the default local reference game to be switched", () => {
    const games = getLocalReferenceArcadeGames({
      env: {
        NEXT_PUBLIC_AIR_JAM_LOCAL_REFERENCE_DEFAULT: "pong",
      },
      nodeEnv: "development",
    });

    expect(games).toHaveLength(1);
    expect(games[0]).toMatchObject({
      slug: "local-pong",
      name: "Pong",
      url: "http://127.0.0.1:5173",
    });
  });

  it("includes explicit URL overrides alongside the default local reference game", () => {
    const games = getLocalReferenceArcadeGames({
      env: {
        NEXT_PUBLIC_AIR_JAM_LOCAL_REFERENCE_DEFAULT: "air-capture",
        NEXT_PUBLIC_AIR_JAM_LOCAL_REFERENCE_PONG_URL: "http://127.0.0.1:4173",
      },
      nodeEnv: "development",
    });

    expect(games.map((game) => game.slug)).toEqual([
      "local-air-capture",
      "local-pong",
    ]);
    expect(games[1]?.url).toBe("http://127.0.0.1:4173");
  });

  it("does not expose local reference games in production", () => {
    expect(
      getLocalReferenceArcadeGames({
        env: {
          NEXT_PUBLIC_AIR_JAM_LOCAL_REFERENCE_PONG_URL: "http://127.0.0.1:4173",
        },
        nodeEnv: "production",
      }),
    ).toEqual([]);
  });

  it("finds a local reference game by slug or id", () => {
    const bySlug = getLocalReferenceArcadeGame("local-air-capture", {
      env: {},
      nodeEnv: "development",
    });
    const byId = getLocalReferenceArcadeGame("local-reference-air-capture", {
      env: {},
      nodeEnv: "development",
    });

    expect(bySlug?.name).toBe("Air Capture");
    expect(byId?.slug).toBe("local-air-capture");
  });
});

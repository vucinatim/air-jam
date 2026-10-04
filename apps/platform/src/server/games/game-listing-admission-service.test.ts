import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/db", () => ({
  db: { query: { gameReleases: { findFirst: vi.fn() } } },
}));
vi.mock("../operations/production-control-service", () => ({
  assertOperationalLaneAccepting: vi.fn(),
}));

import { db } from "@/db";
import { assertOperationalLaneAccepting } from "../operations/production-control-service";
import { assertGameListingAllowed } from "./game-listing-admission-service";

beforeEach(() => vi.resetAllMocks());

describe("game listing admission", () => {
  const hidden = { id: "game-1", arcadeVisibility: "hidden" as const };
  const listed = { ...hidden, arcadeVisibility: "listed" as const };

  it("checks admission only for a hidden-to-listed transition", async () => {
    vi.mocked(db.query.gameReleases.findFirst).mockResolvedValue({
      id: "live",
    } as never);
    await assertGameListingAllowed({
      game: hidden,
      arcadeVisibility: "listed",
    });
    expect(assertOperationalLaneAccepting).toHaveBeenCalledExactlyOnceWith({
      database: db,
      lane: "game_listing",
    });
    expect(db.query.gameReleases.findFirst).toHaveBeenCalledOnce();
  });

  it("propagates denial before querying the live release", async () => {
    const denied = new Error("listing denied");
    vi.mocked(assertOperationalLaneAccepting).mockRejectedValueOnce(denied);
    await expect(
      assertGameListingAllowed({ game: hidden, arcadeVisibility: "listed" }),
    ).rejects.toBe(denied);
    expect(db.query.gameReleases.findFirst).not.toHaveBeenCalled();
  });

  it.each([hidden, listed])(
    "requires a live release when explicitly listing: $arcadeVisibility",
    async (game) => {
      await expect(
        assertGameListingAllowed({ game, arcadeVisibility: "listed" }),
      ).rejects.toMatchObject({
        code: "validation_failed",
        message:
          "A game can only be listed in Arcade after a hosted release is made live.",
      });
      expect(db.query.gameReleases.findFirst).toHaveBeenCalledOnce();
      expect(assertOperationalLaneAccepting).toHaveBeenCalledTimes(
        game.arcadeVisibility === "hidden" ? 1 : 0,
      );
    },
  );

  it("allows an already-listed game without another admission", async () => {
    vi.mocked(db.query.gameReleases.findFirst).mockResolvedValue({
      id: "live",
    } as never);
    await assertGameListingAllowed({
      game: listed,
      arcadeVisibility: "listed",
    });
    expect(assertOperationalLaneAccepting).not.toHaveBeenCalled();
    expect(db.query.gameReleases.findFirst).toHaveBeenCalledOnce();
  });

  it("rejects listed creation without admission or a lookup for a nonexistent game", async () => {
    await expect(
      assertGameListingAllowed({ game: null, arcadeVisibility: "listed" }),
    ).rejects.toMatchObject({ code: "validation_failed" });
    expect(assertOperationalLaneAccepting).not.toHaveBeenCalled();
    expect(db.query.gameReleases.findFirst).not.toHaveBeenCalled();
  });

  it.each([hidden, listed, null])(
    "does not gate hidden visibility or unrelated edits: %j",
    async (game) => {
      await assertGameListingAllowed({ game, arcadeVisibility: "hidden" });
      await assertGameListingAllowed({ game });
      expect(assertOperationalLaneAccepting).not.toHaveBeenCalled();
      expect(db.query.gameReleases.findFirst).not.toHaveBeenCalled();
    },
  );
});

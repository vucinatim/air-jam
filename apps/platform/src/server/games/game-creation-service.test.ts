import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/db", () => ({ db: { transaction: vi.fn() } }));
vi.mock("../operations/production-control-service", () => ({
  assertOperationalLaneAccepting: vi.fn(),
}));

import { db } from "@/db";
import { appIds, games } from "@/db/schema";
import { assertOperationalLaneAccepting } from "../operations/production-control-service";
import { createOwnedGame } from "./game-creation-service";

beforeEach(() => vi.resetAllMocks());

const setupTransaction = (appIdError?: Error) => {
  const game = { id: "created-game", name: "New game" };
  const gameValues = vi.fn((_values: typeof games.$inferInsert) => ({
    returning: vi.fn().mockResolvedValue([game]),
  }));
  const appIdValues = vi.fn(async (_values: typeof appIds.$inferInsert) => {
    if (appIdError) throw appIdError;
  });
  const insert = vi.fn((table) => ({
    values: table === games ? gameValues : appIdValues,
  }));
  vi.mocked(db.transaction).mockImplementation(async (operation) =>
    operation({ insert } as unknown as Parameters<typeof operation>[0]),
  );
  return { game, insert, gameValues, appIdValues };
};

describe("owned game creation", () => {
  it("admits once before atomically creating the game and its App ID", async () => {
    const { game, insert, gameValues, appIdValues } = setupTransaction();
    await expect(
      createOwnedGame({ userId: "creator-1", input: { name: "New game" } }),
    ).resolves.toEqual(game);

    expect(assertOperationalLaneAccepting).toHaveBeenCalledExactlyOnceWith({
      database: db,
      lane: "game_creation",
    });
    expect(
      vi.mocked(assertOperationalLaneAccepting).mock.invocationCallOrder[0],
    ).toBeLessThan(vi.mocked(db.transaction).mock.invocationCallOrder[0]!);
    expect(db.transaction).toHaveBeenCalledOnce();
    expect(insert.mock.calls.map(([table]) => table)).toEqual([games, appIds]);
    expect(appIdValues).toHaveBeenCalledWith(
      expect.objectContaining({
        gameId: gameValues.mock.calls[0]?.[0].id,
        creatorId: "creator-1",
        key: expect.stringMatching(/^aj_app_[a-f0-9]{32}$/),
      }),
    );
  });

  it("normalizes creator metadata once for all callers and starts hidden", async () => {
    const { gameValues } = setupTransaction();
    await createOwnedGame({
      userId: "creator-1",
      input: {
        name: "  New game  ",
        slug: "  new-game  ",
        description: "  A game  ",
        url: "  https://example.invalid/game  ",
        sourceUrl: "  https://example.invalid/source  ",
        templateId: "  minimal  ",
      },
    });
    expect(gameValues).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "New game",
        slug: "new-game",
        description: "A game",
        url: "https://example.invalid/game",
        arcadeVisibility: "hidden",
        config: {
          sourceUrl: "https://example.invalid/source",
          templateId: "minimal",
        },
      }),
    );
  });

  it("stores absent metadata and empty descriptions as null", async () => {
    const { gameValues } = setupTransaction();
    await createOwnedGame({
      userId: "creator-1",
      input: { name: "Game", description: "  " },
    });
    expect(gameValues).toHaveBeenCalledWith(
      expect.objectContaining({
        slug: null,
        description: null,
        url: null,
        config: {},
      }),
    );
  });

  it.each([{ name: "   " }, { name: "Game", slug: "Invalid Slug" }])(
    "rejects invalid normalized metadata before admission or writes: %j",
    async (input) => {
      await expect(
        createOwnedGame({ userId: "creator-1", input }),
      ).rejects.toThrow();
      expect(assertOperationalLaneAccepting).not.toHaveBeenCalled();
      expect(db.transaction).not.toHaveBeenCalled();
    },
  );

  it("makes no writes when admission is denied", async () => {
    const denied = new Error("game creation paused");
    vi.mocked(assertOperationalLaneAccepting).mockRejectedValueOnce(denied);
    await expect(
      createOwnedGame({ userId: "creator-1", input: { name: "Game" } }),
    ).rejects.toBe(denied);
    expect(db.transaction).not.toHaveBeenCalled();
  });

  it("propagates App ID insertion failures out of the transaction for rollback", async () => {
    const failed = new Error("app identity insert failed");
    setupTransaction(failed);
    await expect(
      createOwnedGame({ userId: "creator-1", input: { name: "Game" } }),
    ).rejects.toBe(failed);
    expect(db.transaction).toHaveBeenCalledOnce();
  });
});

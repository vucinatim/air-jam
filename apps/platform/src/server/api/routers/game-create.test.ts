import { beforeEach, describe, expect, it, vi } from "vitest";
import type { createTRPCContext } from "../trpc";

const database = vi.hoisted(() => ({ transaction: vi.fn() }));
vi.mock("@/db", () => ({ db: database }));

import { appIds, games } from "@/db/schema";
import { gameRouter } from "./game";

type RouterContext = Awaited<ReturnType<typeof createTRPCContext>>;
const context: RouterContext = {
  headers: new Headers(),
  clientIp: "127.0.0.1",
  session: {} as NonNullable<RouterContext["session"]>,
  user: {
    id: "creator-1",
    name: "Creator",
    email: "creator@example.invalid",
    emailVerified: true,
    image: null,
    role: "creator",
    createdAt: new Date(),
    updatedAt: new Date(),
  },
};

beforeEach(() => vi.resetAllMocks());

describe("game creation transaction", () => {
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
    database.transaction.mockImplementation(async (operation) =>
      operation({ insert }),
    );
    return { game, insert, gameValues, appIdValues };
  };

  it("creates the owned game and its app identity through one transaction", async () => {
    const { game, insert, gameValues, appIdValues } = setupTransaction();
    await expect(
      gameRouter.createCaller(context).create({ name: game.name }),
    ).resolves.toEqual(game);

    expect(database.transaction).toHaveBeenCalledOnce();
    expect(insert.mock.calls.map(([table]) => table)).toEqual([games, appIds]);
    const created = gameValues.mock.calls[0]?.[0];
    expect(created).toMatchObject({
      name: game.name,
      userId: "creator-1",
      url: null,
    });
    expect(appIdValues).toHaveBeenCalledWith(
      expect.objectContaining({
        gameId: created?.id,
        creatorId: "creator-1",
        key: expect.stringMatching(/^aj_app_[a-f0-9]{32}$/),
      }),
    );
  });

  it("propagates app identity failures so the database rolls back game creation", async () => {
    setupTransaction(new Error("app identity insert failed"));
    await expect(
      gameRouter.createCaller(context).create({ name: "New game" }),
    ).rejects.toThrow("app identity insert failed");
    expect(database.transaction).toHaveBeenCalledOnce();
  });

  it("does not start a transaction for an unauthenticated caller", async () => {
    await expect(
      gameRouter
        .createCaller({ ...context, session: null, user: null })
        .create({ name: "New game" }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(database.transaction).not.toHaveBeenCalled();
  });
});

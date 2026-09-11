import { beforeEach, describe, expect, it, vi } from "vitest";
import type { createTRPCContext } from "../trpc";

const database = vi.hoisted(() => ({
  transaction: vi.fn(),
  query: {
    games: { findFirst: vi.fn() },
    gameReleases: { findFirst: vi.fn() },
  },
  update: vi.fn(),
}));
vi.mock("@/db", () => ({ db: database }));
vi.mock(
  "@/server/operations/production-control-service",
  async (importOriginal) => ({
    ...(await importOriginal<
      typeof import("@/server/operations/production-control-service")
    >()),
    assertOperationalLaneAccepting: vi.fn(),
  }),
);

import { appIds, games } from "@/db/schema";
import {
  assertOperationalLaneAccepting,
  OperationalAdmissionDeniedError,
} from "@/server/operations/production-control-service";
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
    expect(assertOperationalLaneAccepting).not.toHaveBeenCalled();
  });

  it("rejects a blank normalized name as bad input before admission", async () => {
    await expect(
      gameRouter.createCaller(context).create({ name: "   " }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(assertOperationalLaneAccepting).not.toHaveBeenCalled();
    expect(database.transaction).not.toHaveBeenCalled();
  });

  it("maps creation denial to the existing retryable tRPC error", async () => {
    vi.mocked(assertOperationalLaneAccepting).mockRejectedValueOnce(
      denial("game_creation"),
    );
    await expect(
      gameRouter.createCaller(context).create({ name: "Game" }),
    ).rejects.toMatchObject({ code: "SERVICE_UNAVAILABLE" });
    expect(database.transaction).not.toHaveBeenCalled();
  });
});

const denial = (lane: "game_creation" | "game_listing") =>
  new OperationalAdmissionDeniedError({
    contractVersion: 1,
    decisionId: "decision-1",
    lane,
    controlStatus: "available",
    mode: "paused",
    outcome: "denied",
    reason: "lane_paused",
    retryAfterSeconds: 90,
    controlRevision: 2,
  });

describe("dashboard listing admission", () => {
  beforeEach(() => {
    database.query.games.findFirst.mockResolvedValue({
      id: "game-1",
      arcadeVisibility: "hidden",
      config: {},
    });
    database.query.gameReleases.findFirst.mockResolvedValue({
      id: "live-release",
    });
    database.update.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: "game-1" }]),
        }),
      }),
    });
  });

  it("blocks hidden-to-listed with no write when listing admission is denied", async () => {
    vi.mocked(assertOperationalLaneAccepting).mockRejectedValueOnce(
      denial("game_listing"),
    );
    await expect(
      gameRouter
        .createCaller(context)
        .update({ id: "game-1", arcadeVisibility: "listed" }),
    ).rejects.toMatchObject({ code: "SERVICE_UNAVAILABLE" });
    expect(assertOperationalLaneAccepting).toHaveBeenCalledExactlyOnceWith({
      database,
      lane: "game_listing",
    });
    expect(database.update).not.toHaveBeenCalled();
  });

  it("allows admitted listing only with a live release", async () => {
    await gameRouter
      .createCaller(context)
      .update({ id: "game-1", arcadeVisibility: "listed" });
    expect(database.update).toHaveBeenCalledOnce();
    database.update.mockClear();
    database.query.gameReleases.findFirst.mockResolvedValue(null);
    await expect(
      gameRouter
        .createCaller(context)
        .update({ id: "game-1", arcadeVisibility: "listed" }),
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message:
        "A game can only be listed in Arcade after a hosted release is made live.",
    });
    expect(database.update).not.toHaveBeenCalled();
  });

  it.each([
    ["listed", { arcadeVisibility: "hidden" as const }],
    ["listed", { arcadeVisibility: "listed" as const, name: "Updated" }],
    ["listed", { name: "Updated" }],
    ["hidden", { name: "Updated" }],
  ])(
    "does not gate existing-game maintenance: %s %j",
    async (visibility, input) => {
      database.query.games.findFirst.mockResolvedValue({
        id: "game-1",
        arcadeVisibility: visibility,
        config: {},
      });
      vi.mocked(assertOperationalLaneAccepting).mockRejectedValue(
        denial("game_listing"),
      );
      await gameRouter.createCaller(context).update({ id: "game-1", ...input });
      expect(assertOperationalLaneAccepting).not.toHaveBeenCalled();
      expect(database.update).toHaveBeenCalledOnce();
    },
  );

  it("checks ownership before admission or mutation", async () => {
    database.query.games.findFirst.mockResolvedValue(null);
    await expect(
      gameRouter
        .createCaller(context)
        .update({ id: "game-1", arcadeVisibility: "listed" }),
    ).rejects.toThrow("unauthorized");
    expect(assertOperationalLaneAccepting).not.toHaveBeenCalled();
    expect(database.update).not.toHaveBeenCalled();
  });
});

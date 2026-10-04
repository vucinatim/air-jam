import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/db", () => ({
  db: {
    query: {
      games: { findFirst: vi.fn() },
      gameReleases: { findFirst: vi.fn() },
    },
    update: vi.fn(),
  },
}));
vi.mock("./game-creation-service", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./game-creation-service")>()),
  createOwnedGame: vi.fn(),
}));
vi.mock("../operations/production-control-service", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("../operations/production-control-service")
  >()),
  assertOperationalLaneAccepting: vi.fn(),
}));

import { db } from "@/db";
import { games } from "@/db/schema";
import {
  assertOperationalLaneAccepting,
  OperationalAdmissionDeniedError,
} from "../operations/production-control-service";
import { createOwnedGame } from "./game-creation-service";
import {
  createOwnedGameForMachine,
  updateOwnedGameForMachine,
} from "./machine-game";

const game: typeof games.$inferSelect = {
  id: "game-1",
  userId: "creator-1",
  name: "Game",
  slug: "game",
  description: null,
  url: null,
  config: {},
  arcadeVisibility: "hidden",
  createdAt: new Date("2026-09-11T12:00:00Z"),
  updatedAt: new Date("2026-09-11T12:00:00Z"),
};
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

beforeEach(() => vi.resetAllMocks());

describe("machine game creation", () => {
  it("delegates to the shared service and preserves the public summary", async () => {
    vi.mocked(createOwnedGame).mockResolvedValue(game);
    const input = {
      name: "Game",
      slug: "game",
      sourceUrl: "https://example.invalid/repo",
    };
    await expect(
      createOwnedGameForMachine({ userId: "creator-1", input }),
    ).resolves.toEqual({
      id: game.id,
      name: game.name,
      slug: game.slug,
      description: null,
      url: null,
      sourceUrl: null,
      templateId: null,
      arcadeVisibility: "hidden",
      createdAt: game.createdAt.toISOString(),
      updatedAt: game.updatedAt.toISOString(),
    });
    expect(createOwnedGame).toHaveBeenCalledExactlyOnceWith({
      userId: "creator-1",
      input,
    });
  });

  it("rejects an initially listed game before creating resources", async () => {
    await expect(
      createOwnedGameForMachine({
        userId: "creator-1",
        input: { name: "Game", arcadeVisibility: "listed" },
      }),
    ).rejects.toMatchObject({ status: 400, code: "validation_failed" });
    expect(createOwnedGame).not.toHaveBeenCalled();
  });

  it("preserves structured admission denial with retry guidance", async () => {
    const denied = denial("game_creation");
    vi.mocked(createOwnedGame).mockRejectedValueOnce(denied);
    await expect(
      createOwnedGameForMachine({
        userId: "creator-1",
        input: { name: "Game" },
      }),
    ).rejects.toMatchObject({
      code: "rate_limited",
      status: 503,
      retryAfterSeconds: 90,
      details: { decision: denied.decision },
    });
  });

  it("retains normalized slug-conflict errors", async () => {
    vi.mocked(createOwnedGame).mockRejectedValueOnce(
      new Error("23505 unique violation"),
    );
    await expect(
      createOwnedGameForMachine({
        userId: "creator-1",
        input: { name: "Game", slug: "  game  " },
      }),
    ).rejects.toMatchObject({
      code: "conflict",
      status: 409,
      message: 'Slug "game" is already taken.',
    });
  });
});

describe("machine listing admission", () => {
  beforeEach(() => {
    vi.mocked(db.query.games.findFirst).mockResolvedValue(game);
    vi.mocked(db.query.gameReleases.findFirst).mockResolvedValue({
      id: "live-release",
    } as never);
    vi.mocked(db.update).mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi
          .fn()
          .mockReturnValue({ returning: vi.fn().mockResolvedValue([game]) }),
      }),
    } as never);
  });

  it("blocks hidden-to-listed with structured denial before the write", async () => {
    const denied = denial("game_listing");
    vi.mocked(assertOperationalLaneAccepting).mockRejectedValueOnce(denied);
    await expect(
      updateOwnedGameForMachine({
        userId: "creator-1",
        slugOrId: "game",
        input: { arcadeVisibility: "listed" },
      }),
    ).rejects.toMatchObject({
      code: "rate_limited",
      status: 503,
      retryAfterSeconds: 90,
      details: { decision: denied.decision },
    });
    expect(assertOperationalLaneAccepting).toHaveBeenCalledExactlyOnceWith({
      database: db,
      lane: "game_listing",
    });
    expect(db.update).not.toHaveBeenCalled();
  });

  it("allows admitted listing only with a live release", async () => {
    await updateOwnedGameForMachine({
      userId: "creator-1",
      slugOrId: "game",
      input: { arcadeVisibility: "listed" },
    });
    expect(db.update).toHaveBeenCalledOnce();
    vi.mocked(db.update).mockClear();
    vi.mocked(db.query.gameReleases.findFirst).mockResolvedValue(undefined);
    await expect(
      updateOwnedGameForMachine({
        userId: "creator-1",
        slugOrId: "game",
        input: { arcadeVisibility: "listed" },
      }),
    ).rejects.toMatchObject({ code: "validation_failed", status: 400 });
    expect(db.update).not.toHaveBeenCalled();
  });

  it.each([
    ["listed", { arcadeVisibility: "hidden" as const }],
    ["listed", { arcadeVisibility: "listed" as const, name: "Updated" }],
    ["listed", { name: "Updated" }],
    ["hidden", { name: "Updated" }],
  ])(
    "does not gate existing-game maintenance: %s %j",
    async (visibility, input) => {
      vi.mocked(db.query.games.findFirst).mockResolvedValue({
        ...game,
        arcadeVisibility: visibility as "hidden" | "listed",
      });
      vi.mocked(assertOperationalLaneAccepting).mockRejectedValue(
        denial("game_listing"),
      );
      await updateOwnedGameForMachine({
        userId: "creator-1",
        slugOrId: "game",
        input,
      });
      expect(assertOperationalLaneAccepting).not.toHaveBeenCalled();
      expect(db.update).toHaveBeenCalledOnce();
    },
  );

  it("checks ownership before admission or mutation", async () => {
    vi.mocked(db.query.games.findFirst).mockResolvedValue(undefined);
    await expect(
      updateOwnedGameForMachine({
        userId: "creator-1",
        slugOrId: "game",
        input: { arcadeVisibility: "listed" },
      }),
    ).rejects.toMatchObject({ code: "not_found", status: 404 });
    expect(assertOperationalLaneAccepting).not.toHaveBeenCalled();
    expect(db.update).not.toHaveBeenCalled();
  });
});

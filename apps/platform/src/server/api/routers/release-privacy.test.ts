import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { createTRPCContext } from "../trpc";

const database = vi.hoisted(() => ({
  insert: vi.fn(),
  select: vi.fn(),
  transaction: vi.fn(),
  query: {
    games: { findFirst: vi.fn() },
    gameReleases: { findFirst: vi.fn(), findMany: vi.fn() },
    users: { findFirst: vi.fn(), findMany: vi.fn() },
  },
}));
vi.mock("@/db", () => ({ db: database }));

import { gameReleaseReports, games } from "@/db/schema";
import { __resetRateLimitState } from "../rate-limit";
import { getTRPCResponseMeta } from "../trpc";
import { releaseRouter } from "./release";

type RouterContext = Awaited<ReturnType<typeof createTRPCContext>>;
const makeContext = (role: "creator" | "ops_admin" | null): RouterContext => ({
  headers: new Headers(),
  clientIp: `privacy-test:${crypto.randomUUID()}`,
  session: role === null ? null : ({} as NonNullable<RouterContext["session"]>),
  user:
    role === null
      ? null
      : {
          id: "creator-1",
          name: "Creator",
          email: "creator@example.invalid",
          emailVerified: true,
          image: null,
          role,
          createdAt: new Date("2026-09-12T00:00:00Z"),
          updatedAt: new Date("2026-09-12T00:00:00Z"),
        },
});

const privateReport = {
  id: "80699779-f869-4167-853a-fb792af01718",
  submissionId: "82236630-4477-4cfe-9418-25a07125bc32",
  releaseId: "release-1",
  status: "open",
  source: "play_page",
  reason: "Reporter Alice found abusive content",
  details: "Contact Alice at a private address for evidence.",
  reporterEmail: "alice@example.invalid",
  createdAt: new Date("2026-09-12T00:00:00Z"),
  reviewedAt: null,
  reviewRevision: 0,
} satisfies typeof gameReleaseReports.$inferSelect;

const game = { id: "game-1", userId: "creator-1", name: "Game", slug: "game" };
const release = {
  id: "release-1",
  gameId: game.id,
  status: "live",
  candidateGenerationId: null,
  promotedGenerationId: null,
};
const creatorReport = {
  id: privateReport.id,
  releaseId: privateReport.releaseId,
  status: privateReport.status,
  source: privateReport.source,
  createdAt: privateReport.createdAt,
  reviewedAt: privateReport.reviewedAt,
};

beforeEach(() => {
  vi.resetAllMocks();
  __resetRateLimitState();
  database.query.games.findFirst.mockResolvedValue(game);
  database.query.gameReleases.findFirst.mockResolvedValue(release);
  database.query.gameReleases.findMany.mockResolvedValue([release]);
  database.query.users.findFirst.mockResolvedValue(null);
  database.query.users.findMany.mockResolvedValue([]);
  database.select.mockReturnValue({
    from: (table: unknown) => {
      const rows =
        table === gameReleaseReports
          ? [privateReport]
          : table === games
            ? [game]
            : [];
      return {
        // Drizzle queries can be awaited directly or ordered before awaiting.
        where: () =>
          Object.assign(Promise.resolve(rows), {
            orderBy: () => Promise.resolve(rows),
          }),
      };
    },
  });
});

const publicInput = {
  submissionId: privateReport.submissionId,
  releaseId: privateReport.releaseId,
  source: privateReport.source,
  reason: privateReport.reason,
  details: privateReport.details,
  reporterEmail: privateReport.reporterEmail,
};

const mockIntakeTransaction = ({
  existing = false,
  exhausted = false,
} = {}) => {
  const rows = (values: unknown[]) => {
    const query = Promise.resolve(values);
    return Object.assign(query, {
      from: () => query,
      where: () => query,
      innerJoin: () => query,
      for: () => query,
      limit: () => query,
    });
  };
  const values = vi.fn().mockResolvedValue(undefined);
  const tx = {
    execute: vi
      .fn()
      .mockResolvedValue([{ authority_now: new Date("2042-01-01T12:00:30Z") }]),
    select: vi
      .fn()
      .mockReturnValueOnce(
        rows(
          existing
            ? [{ ...privateReport, status: "dismissed", reviewRevision: 9 }]
            : [],
        ),
      )
      .mockReturnValueOnce(rows([{ id: release.id }]))
      .mockReturnValueOnce(rows([{ day: 120, minute: exhausted ? 120 : 0 }])),
    insert: vi.fn().mockReturnValue({ values }),
  };
  database.transaction.mockImplementation(async (operation) => operation(tx));
  return { tx, values };
};

describe("release reporter privacy at the router boundary", () => {
  it("returns only a public submission receipt while retaining private evidence for operations", async () => {
    const { tx, values } = mockIntakeTransaction();
    const result = await releaseRouter
      .createCaller(makeContext(null))
      .reportPublic(publicInput);
    expect(result).toEqual({
      submissionId: privateReport.submissionId,
      received: true,
    });
    expect(tx.insert).toHaveBeenCalledExactlyOnceWith(gameReleaseReports);
    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({
        releaseId: release.id,
        submissionId: privateReport.submissionId,
        reason: privateReport.reason,
        details: privateReport.details,
        reporterEmail: privateReport.reporterEmail,
      }),
    );
  });

  it("does not expose private review status through a public replay receipt", async () => {
    const { tx } = mockIntakeTransaction({ existing: true });
    expect(
      await releaseRouter
        .createCaller(makeContext(null))
        .reportPublic(publicInput),
    ).toEqual({ submissionId: privateReport.submissionId, received: true });
    expect(tx.insert).not.toHaveBeenCalled();
  });

  it("returns safe HTTP 429 retry metadata for shared intake exhaustion", async () => {
    const { tx } = mockIntakeTransaction({ exhausted: true });
    const response = await fetchRequestHandler({
      endpoint: "/api/trpc",
      req: new Request("https://airjam.test/api/trpc/reportPublic", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ json: publicInput }),
      }),
      router: releaseRouter,
      responseMeta: getTRPCResponseMeta,
      createContext: async () => makeContext(null),
    });
    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("30");
    const body = await response.json();
    expect(body).toMatchObject({
      error: {
        json: { data: { code: "TOO_MANY_REQUESTS", retryAfterSeconds: 30 } },
      },
    });
    for (const privateValue of [
      privateReport.reason,
      privateReport.details,
      privateReport.reporterEmail,
    ]) {
      expect(JSON.stringify(body)).not.toContain(privateValue);
    }
    expect(tx.insert).not.toHaveBeenCalled();
  });

  it("projects creator detail and list responses through the real application privacy boundary", async () => {
    const caller = releaseRouter.createCaller(makeContext("creator"));
    const detail = await caller.get({ releaseId: release.id });
    const listed = await caller.listByGame({ gameId: game.id });
    expect(detail.reports).toEqual([creatorReport]);
    expect(listed).toHaveLength(1);
    expect(listed[0]?.reports).toEqual([creatorReport]);
    for (const value of [
      privateReport.submissionId,
      privateReport.reason,
      privateReport.details,
      privateReport.reporterEmail,
    ]) {
      expect(JSON.stringify([detail, listed])).not.toContain(value);
    }
    // Projection must not destroy the private record operations still needs.
    expect(privateReport.reporterEmail).toBe("alice@example.invalid");
  });

  it("denies unauthenticated creator reads before consulting private records", async () => {
    const caller = releaseRouter.createCaller(makeContext(null));
    await expect(caller.get({ releaseId: release.id })).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
    await expect(caller.listByGame({ gameId: game.id })).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
    expect(database.query.gameReleases.findFirst).not.toHaveBeenCalled();
    expect(database.query.games.findFirst).not.toHaveBeenCalled();
    expect(database.select).not.toHaveBeenCalled();
  });

  it.each([
    [null, "UNAUTHORIZED"],
    ["creator", "FORBIDDEN"],
  ] as const)(
    "denies private operations reports to %s callers",
    async (role, code) => {
      await expect(
        releaseRouter.createCaller(makeContext(role)).listOps(),
      ).rejects.toMatchObject({ code });
      expect(database.query.gameReleases.findMany).not.toHaveBeenCalled();
      expect(database.select).not.toHaveBeenCalled();
    },
  );

  it("allows operations to read private report evidence through the real application service", async () => {
    const result = await releaseRouter
      .createCaller(makeContext("ops_admin"))
      .listOps();
    expect(result).toHaveLength(1);
    expect(result[0]?.reports).toEqual([privateReport]);
    expect(result[0]?.reports[0]).toMatchObject({
      reason: privateReport.reason,
      details: privateReport.details,
      reporterEmail: privateReport.reporterEmail,
    });
    expect(database.query.gameReleases.findMany).toHaveBeenCalledOnce();
  });
});

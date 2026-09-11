import * as schema from "@/db/schema";
import { appIds, games, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { createOwnedGame } from "./game-creation-service";

const databaseUrl = process.env.AIR_JAM_TEST_DATABASE_URL?.trim();
const describeWithPostgres = databaseUrl ? describe : describe.skip;

describeWithPostgres("owned game creation PostgreSQL invariants", () => {
  const client = postgres(databaseUrl!, { max: 1 });
  const database = drizzle(client, { schema });
  const userId = `game-creation-test:${crypto.randomUUID()}`;

  beforeAll(async () => {
    await database.insert(users).values({
      id: userId,
      name: "Game creation test",
      email: `${userId}@example.invalid`,
      emailVerified: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  });

  afterEach(() => vi.restoreAllMocks());

  afterAll(async () => {
    await database.delete(appIds).where(eq(appIds.creatorId, userId));
    await database.delete(games).where(eq(games.userId, userId));
    await database.delete(users).where(eq(users.id, userId));
    await client.end();
  });

  it("commits a hidden owned game and its usable App ID together", async () => {
    const game = await createOwnedGame({
      database,
      userId,
      input: {
        name: "  Created game  ",
        description: "  Created atomically  ",
      },
    });

    expect(
      await database.query.games.findFirst({ where: eq(games.id, game.id) }),
    ).toMatchObject({
      id: game.id,
      userId,
      name: "Created game",
      description: "Created atomically",
      arcadeVisibility: "hidden",
    });
    const identities = await database
      .select()
      .from(appIds)
      .where(eq(appIds.gameId, game.id));
    expect(identities).toHaveLength(1);
    expect(identities[0]).toMatchObject({
      gameId: game.id,
      creatorId: userId,
      isActive: true,
      key: expect.stringMatching(/^aj_app_[a-f0-9]{32}$/),
    });
  });

  it("rolls back the inserted game when PostgreSQL rejects the App ID", async () => {
    const existingGameId = crypto.randomUUID();
    const collisionId = crypto.randomUUID();
    await database
      .insert(games)
      .values({ id: existingGameId, userId, name: "Existing game" });
    await database.insert(appIds).values({
      id: collisionId,
      gameId: existingGameId,
      creatorId: userId,
      key: `aj_app_${crypto.randomUUID().replace(/-/g, "")}`,
    });

    // The game ID is free in games, but this App ID already exists. Only UUID
    // generation is controlled: real inserts and PostgreSQL rollback run unchanged.
    const randomUUID = vi
      .spyOn(crypto, "randomUUID")
      .mockReturnValue(collisionId);
    try {
      await expect(
        createOwnedGame({
          database,
          userId,
          input: { name: "Must roll back" },
        }),
      ).rejects.toMatchObject({
        cause: { code: "23505", constraint_name: "app_ids_pkey" },
      });
    } finally {
      randomUUID.mockRestore();
    }

    expect(
      await database.query.games.findFirst({
        where: eq(games.id, collisionId),
      }),
    ).toBeUndefined();
    expect(
      await database.query.appIds.findFirst({
        where: eq(appIds.gameId, collisionId),
      }),
    ).toBeUndefined();
    expect(
      await database.query.appIds.findFirst({
        where: eq(appIds.id, collisionId),
      }),
    ).toMatchObject({
      gameId: existingGameId,
      creatorId: userId,
    });
    expect(
      await database.query.games.findFirst({
        where: eq(games.id, existingGameId),
      }),
    ).toMatchObject({ name: "Existing game" });
  });
});

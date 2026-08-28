import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as schema from "../../db/schema";

const databaseUrl = process.env.AIR_JAM_TEST_DATABASE_URL?.trim();
const describeWithPostgres = databaseUrl ? describe : describe.skip;

describeWithPostgres("release status PostgreSQL invariants", () => {
  const client = postgres(databaseUrl!);
  const database = drizzle(client, { schema });
  const suffix = crypto.randomUUID();
  const userId = `test_user_${suffix}`;
  const gameId = `test_game_${suffix}`;
  const firstReleaseId = `test_release_a_${suffix}`;
  const secondReleaseId = `test_release_b_${suffix}`;

  beforeAll(async () => {
    await database.insert(schema.users).values({
      id: userId,
      name: "Release invariant test",
      email: `${userId}@example.invalid`,
      emailVerified: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await database.insert(schema.games).values({
      id: gameId,
      userId,
      name: "Release invariant test game",
      config: {},
    });
    await database.insert(schema.gameReleases).values([
      {
        id: firstReleaseId,
        gameId,
        sourceKind: "upload",
        status: "ready",
      },
      {
        id: secondReleaseId,
        gameId,
        sourceKind: "upload",
        status: "ready",
      },
    ]);
  });

  afterAll(async () => {
    await database.delete(schema.games).where(eq(schema.games.id, gameId));
    await database.delete(schema.users).where(eq(schema.users.id, userId));
    await client.end();
  });

  it("serializes concurrent publish commands and rejects a second live row", async () => {
    const { publishReleaseWithDatabase } =
      await import("./release-status-service");

    await Promise.all([
      publishReleaseWithDatabase({
        database,
        releaseId: firstReleaseId,
      }),
      publishReleaseWithDatabase({
        database,
        releaseId: secondReleaseId,
      }),
    ]);

    const releases = await database.query.gameReleases.findMany({
      where: (table, { eq }) => eq(table.gameId, gameId),
    });
    const liveReleases = releases.filter(
      (release) => release.status === "live",
    );

    expect(liveReleases).toHaveLength(1);
    expect(
      releases.filter((release) => release.status === "archived"),
    ).toHaveLength(1);

    const archivedRelease = releases.find(
      (release) => release.status === "archived",
    );
    expect(archivedRelease).toBeDefined();

    await expect(
      database
        .update(schema.gameReleases)
        .set({ status: "live" })
        .where(eq(schema.gameReleases.id, archivedRelease!.id)),
    ).rejects.toMatchObject({
      cause: {
        code: "23505",
        constraint_name: "game_releases_one_live_per_game_idx",
      },
    });
  });
});

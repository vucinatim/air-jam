import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as schema from "../../db/schema";

const databaseUrl = process.env.AIR_JAM_TEST_DATABASE_URL?.trim();
const describeWithPostgres = databaseUrl ? describe : describe.skip;

describeWithPostgres("managed media PostgreSQL invariants", () => {
  const client = postgres(databaseUrl!);
  const database = drizzle(client, { schema });
  const suffix = crypto.randomUUID();
  const userId = `test_user_${suffix}`;
  const gameId = `test_game_${suffix}`;
  const otherGameId = `test_other_game_${suffix}`;
  const thumbnailId = `test_thumbnail_${suffix}`;
  const coverId = `test_cover_${suffix}`;
  const concurrentId = `test_concurrent_${suffix}`;
  const otherGameAssetId = `test_other_asset_${suffix}`;

  beforeAll(async () => {
    await database.insert(schema.users).values({
      id: userId,
      name: "Media invariant test",
      email: `${userId}@example.invalid`,
      emailVerified: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await database.insert(schema.games).values([
      { id: gameId, userId, name: "Media invariant game", config: {} },
      {
        id: otherGameId,
        userId,
        name: "Other media invariant game",
        config: {},
      },
    ]);
    await database.insert(schema.gameMediaAssets).values([
      {
        id: thumbnailId,
        gameId,
        kind: "thumbnail",
        status: "ready",
        originalFilename: "thumbnail.png",
        mimeType: "image/png",
        sizeBytes: 1,
        storageKey: `tests/${thumbnailId}`,
      },
      {
        id: coverId,
        gameId,
        kind: "cover",
        status: "ready",
        originalFilename: "cover.png",
        mimeType: "image/png",
        sizeBytes: 1,
        storageKey: `tests/${coverId}`,
      },
      {
        id: concurrentId,
        gameId,
        kind: "preview_video",
        status: "ready",
        originalFilename: "preview.mp4",
        mimeType: "video/mp4",
        sizeBytes: 1,
        storageKey: `tests/${concurrentId}`,
      },
      {
        id: otherGameAssetId,
        gameId: otherGameId,
        kind: "thumbnail",
        status: "ready",
        originalFilename: "other.png",
        mimeType: "image/png",
        sizeBytes: 1,
        storageKey: `tests/${otherGameAssetId}`,
      },
    ]);
  });

  afterAll(async () => {
    await database.delete(schema.games).where(eq(schema.games.id, gameId));
    await database.delete(schema.games).where(eq(schema.games.id, otherGameId));
    await database.delete(schema.users).where(eq(schema.users.id, userId));
    await client.end();
  });

  it("enforces ownership, kind, ready status, and archive cleanup", async () => {
    const {
      archiveGameMediaAssetWithDatabase,
      assignGameMediaAssetWithDatabase,
    } = await import("./game-media-service");

    await assignGameMediaAssetWithDatabase({
      database,
      gameId,
      assetId: thumbnailId,
    });

    await expect(
      database
        .update(schema.gameMediaAssets)
        .set({ status: "archived" })
        .where(eq(schema.gameMediaAssets.id, thumbnailId)),
    ).rejects.toMatchObject({
      cause: {
        code: "23503",
        constraint_name: "game_media_assignments_asset_integrity_fk",
      },
    });

    await expect(
      assignGameMediaAssetWithDatabase({
        database,
        gameId,
        assetId: otherGameAssetId,
      }),
    ).rejects.toThrow("Media asset not found.");

    await expect(
      database.insert(schema.gameMediaAssignments).values({
        gameId,
        kind: "preview_video",
        assetId: coverId,
        assetStatus: "ready",
      }),
    ).rejects.toMatchObject({ cause: { code: "23503" } });

    await archiveGameMediaAssetWithDatabase({
      database,
      gameId,
      assetId: thumbnailId,
    });

    const [archivedAsset, assignment] = await Promise.all([
      database.query.gameMediaAssets.findFirst({
        where: (table, { eq }) => eq(table.id, thumbnailId),
      }),
      database.query.gameMediaAssignments.findFirst({
        where: (table, { and, eq }) =>
          and(eq(table.gameId, gameId), eq(table.kind, "thumbnail")),
      }),
    ]);

    expect(archivedAsset?.status).toBe("archived");
    expect(assignment).toBeUndefined();
  });

  it("keeps concurrent assign and archive outcomes internally consistent", async () => {
    const {
      archiveGameMediaAssetWithDatabase,
      assignGameMediaAssetWithDatabase,
    } = await import("./game-media-service");

    await Promise.allSettled([
      assignGameMediaAssetWithDatabase({
        database,
        gameId,
        assetId: concurrentId,
      }),
      archiveGameMediaAssetWithDatabase({
        database,
        gameId,
        assetId: concurrentId,
      }),
    ]);

    const [asset, assignments] = await Promise.all([
      database.query.gameMediaAssets.findFirst({
        where: (table, { eq }) => eq(table.id, concurrentId),
      }),
      database
        .select()
        .from(schema.gameMediaAssignments)
        .where(
          and(
            eq(schema.gameMediaAssignments.gameId, gameId),
            eq(schema.gameMediaAssignments.kind, "preview_video"),
          ),
        ),
    ]);

    expect(asset).toBeDefined();
    if (asset?.status === "archived") {
      expect(assignments).toHaveLength(0);
    } else {
      expect(asset?.status).toBe("ready");
      expect(assignments).toHaveLength(1);
      expect(assignments[0]?.assetId).toBe(concurrentId);
    }
  });
});

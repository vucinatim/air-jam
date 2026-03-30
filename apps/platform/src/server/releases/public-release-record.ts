import { db } from "@/db";
import { gameReleaseArtifacts, gameReleases } from "@/db/schema";
import { buildHostedReleaseAssetUrl } from "@/server/releases/release-public-url";
import { and, eq } from "drizzle-orm";

export const buildHostedReleaseSnapshot = ({
  gameId,
  releaseId,
  versionLabel,
  publishedAt,
  entryPath,
}: {
  gameId: string;
  releaseId: string;
  versionLabel: string | null;
  publishedAt: Date | null;
  entryPath: string;
}) => ({
  id: releaseId,
  versionLabel,
  publishedAt,
  entryPath,
  url: buildHostedReleaseAssetUrl({
    gameId,
    releaseId,
    assetPath: entryPath,
  }),
});

export const getLiveReleaseForGame = async (gameId: string) => {
  const liveReleaseRows = await db
    .select({
      releaseId: gameReleases.id,
      versionLabel: gameReleases.versionLabel,
      publishedAt: gameReleases.publishedAt,
      entryPath: gameReleaseArtifacts.entryPath,
    })
    .from(gameReleases)
    .innerJoin(
      gameReleaseArtifacts,
      eq(gameReleaseArtifacts.releaseId, gameReleases.id),
    )
    .where(and(eq(gameReleases.gameId, gameId), eq(gameReleases.status, "live")))
    .limit(1);

  const match = liveReleaseRows[0];
  if (!match) {
    return null;
  }

  return buildHostedReleaseSnapshot({
    gameId,
    releaseId: match.releaseId,
    versionLabel: match.versionLabel,
    publishedAt: match.publishedAt,
    entryPath: match.entryPath,
  });
};

export const findPublicReleaseBySlugOrId = async (slugOrId: string) => {
  let game = await db.query.games.findFirst({
    where: (table, { eq }) => eq(table.slug, slugOrId),
  });

  if (!game) {
    game = await db.query.games.findFirst({
      where: (table, { eq }) => eq(table.id, slugOrId),
    });
  }

  if (!game || game.arcadeVisibility !== "listed") {
    throw new Error("Game not found");
  }

  const liveRelease = await getLiveReleaseForGame(game.id);
  if (!liveRelease) {
    throw new Error("Game not found");
  }

  return {
    game,
    releaseId: liveRelease.id,
    liveRelease,
  };
};

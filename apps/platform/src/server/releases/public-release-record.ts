import { db } from "@/db";
import { gameReleaseGenerations, gameReleases } from "@/db/schema";
import {
  HOSTED_RELEASE_CONTROLLER_PATH,
  HOSTED_RELEASE_HOST_PATH,
} from "@/lib/releases/hosted-release-artifact";
import { buildHostedReleaseAssetUrl } from "@/server/releases/release-public-url";
import { and, desc, eq } from "drizzle-orm";

export const buildHostedReleaseSnapshot = ({
  gameId,
  releaseId,
  generationId,
  versionLabel,
  publishedAt,
}: {
  gameId: string;
  releaseId: string;
  generationId: string;
  versionLabel: string | null;
  publishedAt: Date | null;
}) => ({
  id: releaseId,
  versionLabel,
  publishedAt,
  hostPath: HOSTED_RELEASE_HOST_PATH,
  controllerPath: HOSTED_RELEASE_CONTROLLER_PATH,
  url: buildHostedReleaseAssetUrl({
    gameId,
    releaseId,
    generationId,
    assetPath: HOSTED_RELEASE_HOST_PATH,
  }),
  controllerUrl: buildHostedReleaseAssetUrl({
    gameId,
    releaseId,
    generationId,
    assetPath: HOSTED_RELEASE_CONTROLLER_PATH,
  }),
});

export const getLiveReleaseForGame = async (gameId: string) => {
  const liveReleaseRows = await db
    .select({
      releaseId: gameReleases.id,
      generationId: gameReleaseGenerations.id,
      versionLabel: gameReleases.versionLabel,
      publishedAt: gameReleases.publishedAt,
    })
    .from(gameReleases)
    .innerJoin(
      gameReleaseGenerations,
      and(
        eq(gameReleaseGenerations.id, gameReleases.promotedGenerationId),
        eq(gameReleaseGenerations.releaseId, gameReleases.id),
        eq(gameReleaseGenerations.status, "ready"),
      ),
    )
    .where(
      and(eq(gameReleases.gameId, gameId), eq(gameReleases.status, "live")),
    )
    .orderBy(
      desc(gameReleases.publishedAt),
      desc(gameReleases.createdAt),
      desc(gameReleases.id),
    )
    .limit(1);

  const match = liveReleaseRows[0];
  if (!match) {
    return null;
  }

  return buildHostedReleaseSnapshot({
    gameId,
    releaseId: match.releaseId,
    generationId: match.generationId,
    versionLabel: match.versionLabel,
    publishedAt: match.publishedAt,
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

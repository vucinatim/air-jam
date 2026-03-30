import { db } from "@/db";
import { gameReleaseChecks, gameReleaseReports } from "@/db/schema";
import { desc, eq } from "drizzle-orm";

export const assertOwnedRelease = async (releaseId: string, userId: string) => {
  const release = await db.query.gameReleases.findFirst({
    where: (gameReleases, { eq }) => eq(gameReleases.id, releaseId),
  });

  if (!release) {
    throw new Error("Release not found or unauthorized");
  }

  const game = await db.query.games.findFirst({
    where: (games, { and, eq }) =>
      and(eq(games.id, release.gameId), eq(games.userId, userId)),
  });

  if (!game) {
    throw new Error("Release not found or unauthorized");
  }

  const [artifact, checks, reports] = await Promise.all([
    db.query.gameReleaseArtifacts.findFirst({
      where: (gameReleaseArtifacts, { eq }) =>
        eq(gameReleaseArtifacts.releaseId, releaseId),
    }),
    db
      .select()
      .from(gameReleaseChecks)
      .where(eq(gameReleaseChecks.releaseId, releaseId))
      .orderBy(desc(gameReleaseChecks.createdAt)),
    db
      .select()
      .from(gameReleaseReports)
      .where(eq(gameReleaseReports.releaseId, releaseId))
      .orderBy(desc(gameReleaseReports.createdAt)),
  ]);

  return {
    ...release,
    game,
    artifact: artifact ?? null,
    checks,
    reports,
  };
};

import { db } from "@/db";
import { gameReleaseChecks, gameReleaseReports, users } from "@/db/schema";
import { desc, eq } from "drizzle-orm";

export const getReleaseDetails = async (releaseId: string) => {
  const release = await db.query.gameReleases.findFirst({
    where: (gameReleases, { eq }) => eq(gameReleases.id, releaseId),
  });

  if (!release) {
    return null;
  }

  const [game, artifact, checks, reports] = await Promise.all([
    db.query.games.findFirst({
      where: (games, { eq }) => eq(games.id, release.gameId),
    }),
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

  if (!game) {
    throw new Error("Release game is missing.");
  }

  const owner = await db.query.users.findFirst({
    where: eq(users.id, game.userId),
  });

  return {
    ...release,
    game,
    owner:
      owner === undefined
        ? null
        : {
            id: owner.id,
            name: owner.name,
            email: owner.email,
            role: owner.role,
          },
    artifact: artifact ?? null,
    checks,
    reports,
  };
};

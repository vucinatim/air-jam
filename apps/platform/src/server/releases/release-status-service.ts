import { db } from "@/db";
import { gameReleases, games } from "@/db/schema";
import { canTransitionReleaseStatus } from "@/lib/releases/release-policy";
import { eq } from "drizzle-orm";

export const quarantineRelease = async ({
  releaseId,
  checkedAt,
}: {
  releaseId: string;
  checkedAt?: Date;
}) => {
  return db.transaction(async (tx) => {
    const release = await tx.query.gameReleases.findFirst({
      where: (gameReleases, { eq }) => eq(gameReleases.id, releaseId),
    });

    if (!release) {
      throw new Error("Release not found.");
    }

    if (release.status === "quarantined") {
      return release;
    }

    if (!canTransitionReleaseStatus(release.status, "quarantined")) {
      throw new Error(
        `Illegal release status transition: ${release.status} -> quarantined`,
      );
    }

    const now = checkedAt ?? new Date();
    const [quarantinedRelease] = await tx
      .update(gameReleases)
      .set({
        status: "quarantined",
        checkedAt: checkedAt ?? release.checkedAt,
        quarantinedAt: now,
      })
      .where(eq(gameReleases.id, releaseId))
      .returning();

    if (release.status === "live") {
      await tx
        .update(games)
        .set({
          arcadeVisibility: "hidden",
          updatedAt: now,
        })
        .where(eq(games.id, release.gameId));
    }

    return quarantinedRelease;
  });
};

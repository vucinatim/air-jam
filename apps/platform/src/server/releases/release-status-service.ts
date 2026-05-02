import { db } from "@/db";
import { gameReleases, games } from "@/db/schema";
import { canTransitionReleaseStatus } from "@/lib/releases/release-policy";
import { and, eq, inArray } from "drizzle-orm";

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

export const publishRelease = async ({ releaseId }: { releaseId: string }) => {
  return db.transaction(async (tx) => {
    const release = await tx.query.gameReleases.findFirst({
      where: (table, { eq }) => eq(table.id, releaseId),
    });

    if (!release) {
      throw new Error("Release not found.");
    }

    if (release.status !== "ready") {
      throw new Error("Only ready releases can be published.");
    }

    const now = new Date();
    const existingLiveReleases = await tx
      .select({ id: gameReleases.id })
      .from(gameReleases)
      .where(
        and(
          eq(gameReleases.gameId, release.gameId),
          eq(gameReleases.status, "live"),
        ),
      );

    const existingLiveReleaseIds = existingLiveReleases.map((item) => item.id);
    if (existingLiveReleaseIds.length > 0) {
      await tx
        .update(gameReleases)
        .set({
          status: "archived",
          archivedAt: now,
        })
        .where(inArray(gameReleases.id, existingLiveReleaseIds));
    }

    const [publishedRelease] = await tx
      .update(gameReleases)
      .set({
        status: "live",
        publishedAt: now,
        archivedAt: null,
        quarantinedAt: null,
      })
      .where(eq(gameReleases.id, releaseId))
      .returning();

    return publishedRelease;
  });
};

export const archiveRelease = async ({ releaseId }: { releaseId: string }) => {
  return db.transaction(async (tx) => {
    const release = await tx.query.gameReleases.findFirst({
      where: (table, { eq }) => eq(table.id, releaseId),
    });

    if (!release) {
      throw new Error("Release not found.");
    }

    if (release.status === "archived") {
      return release;
    }

    const now = new Date();
    const [archivedRelease] = await tx
      .update(gameReleases)
      .set({
        status: "archived",
        archivedAt: now,
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

    return archivedRelease;
  });
};

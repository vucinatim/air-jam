import { db } from "@/db";
import {
  gameReleaseArtifacts,
  gameReleaseChecks,
  gameReleaseReports,
  gameReleases,
  games,
} from "@/db/schema";
import { PlatformApplicationError } from "@/server/application-error";
import type {
  AuthenticatedPlatformActor,
  OperationsPlatformActor,
} from "@/server/auth/application-actor";
import { assertOperationsActor } from "@/server/auth/application-actor";
import {
  resolveOwnedGame,
  type OwnedGameReference,
} from "@/server/games/owned-game-access";
import { assertOperationalLaneAccepting } from "@/server/operations/production-control-service";
import { desc, inArray } from "drizzle-orm";
import { assertOwnedRelease } from "./assert-owned-release";
import { assertReleaseExists } from "./assert-release-exists";
import { listReleaseDetailsByGame } from "./get-release-details";
import {
  finalizeReleaseUpload,
  requestReleaseUploadTarget,
} from "./release-artifact-service";
import { runReleaseModeration } from "./release-moderation-service";
import {
  archiveRelease,
  publishRelease,
  quarantineRelease,
} from "./release-status-service";

const reloadOwnedRelease = async ({
  actor,
  releaseId,
}: {
  actor: AuthenticatedPlatformActor;
  releaseId: string;
}) => {
  try {
    return await assertOwnedRelease(releaseId, actor.userId);
  } catch {
    throw new PlatformApplicationError({
      code: "not_found",
      message: "Release not found or unauthorized.",
    });
  }
};

export const listOwnedGameReleases = async ({
  actor,
  gameReference,
}: {
  actor: AuthenticatedPlatformActor;
  gameReference: OwnedGameReference;
}) => {
  const game = await resolveOwnedGame({ actor, reference: gameReference });
  const releases = await listReleaseDetailsByGame(game);

  return { game, releases };
};

export const getOwnedRelease = reloadOwnedRelease;

export const createOwnedDraftRelease = async ({
  actor,
  gameReference,
  versionLabel,
}: {
  actor: AuthenticatedPlatformActor;
  gameReference: OwnedGameReference;
  versionLabel?: string;
}) => {
  const game = await resolveOwnedGame({ actor, reference: gameReference });
  await assertOperationalLaneAccepting({ lane: "release_submission" });
  const [release] = await db
    .insert(gameReleases)
    .values({
      id: crypto.randomUUID(),
      gameId: game.id,
      sourceKind: "upload",
      status: "draft",
      versionLabel: versionLabel?.trim() || null,
    })
    .returning();

  if (!release) {
    throw new Error("Draft release could not be created.");
  }

  return reloadOwnedRelease({ actor, releaseId: release.id });
};

export const requestOwnedReleaseUploadTarget = async ({
  actor,
  releaseId,
  originalFilename,
  sizeBytes,
}: {
  actor: AuthenticatedPlatformActor;
  releaseId: string;
  originalFilename: string;
  sizeBytes: number;
}) => {
  const release = await reloadOwnedRelease({ actor, releaseId });
  await assertOperationalLaneAccepting({ lane: "artifact_ingestion" });
  const result = await requestReleaseUploadTarget({
    release,
    originalFilename,
    sizeBytes,
  });

  return {
    release: await reloadOwnedRelease({ actor, releaseId: result.release.id }),
    upload: result.upload,
  };
};

export const finalizeOwnedReleaseUpload = async ({
  actor,
  releaseId,
}: {
  actor: AuthenticatedPlatformActor;
  releaseId: string;
}) => {
  const release = await reloadOwnedRelease({ actor, releaseId });
  await assertOperationalLaneAccepting({ lane: "release_processing" });

  try {
    await finalizeReleaseUpload({ release });
  } catch (error) {
    const updatedRelease = await reloadOwnedRelease({ actor, releaseId });
    if (
      updatedRelease.status === "ready" ||
      updatedRelease.status === "quarantined" ||
      updatedRelease.status === "failed"
    ) {
      return updatedRelease;
    }

    throw error;
  }

  return reloadOwnedRelease({ actor, releaseId });
};

export const publishOwnedRelease = async ({
  actor,
  releaseId,
}: {
  actor: AuthenticatedPlatformActor;
  releaseId: string;
}) => {
  await reloadOwnedRelease({ actor, releaseId });
  await publishRelease({ releaseId });
  return reloadOwnedRelease({ actor, releaseId });
};

export const archiveOwnedRelease = async ({
  actor,
  releaseId,
}: {
  actor: AuthenticatedPlatformActor;
  releaseId: string;
}) => {
  await reloadOwnedRelease({ actor, releaseId });
  await archiveRelease({ releaseId });
  return reloadOwnedRelease({ actor, releaseId });
};

export const listReleasesForOperations = async ({
  actor,
}: {
  actor: OperationsPlatformActor;
}) => {
  assertOperationsActor(actor);
  const releases = await db.query.gameReleases.findMany({
    where: (table, { notInArray }) => notInArray(table.status, ["draft"]),
    orderBy: (table, { desc }) => [desc(table.createdAt)],
    limit: 100,
  });

  if (releases.length === 0) {
    return [];
  }

  const releaseIds = releases.map((release) => release.id);
  const [artifacts, checks, reports, releaseGames] = await Promise.all([
    db
      .select()
      .from(gameReleaseArtifacts)
      .where(inArray(gameReleaseArtifacts.releaseId, releaseIds)),
    db
      .select()
      .from(gameReleaseChecks)
      .where(inArray(gameReleaseChecks.releaseId, releaseIds))
      .orderBy(desc(gameReleaseChecks.createdAt)),
    db
      .select()
      .from(gameReleaseReports)
      .where(inArray(gameReleaseReports.releaseId, releaseIds))
      .orderBy(desc(gameReleaseReports.createdAt)),
    db
      .select({
        id: games.id,
        name: games.name,
        slug: games.slug,
        userId: games.userId,
      })
      .from(games)
      .where(
        inArray(
          games.id,
          releases.map((release) => release.gameId),
        ),
      ),
  ]);

  const ownerIds = Array.from(new Set(releaseGames.map((game) => game.userId)));
  const releaseOwners =
    ownerIds.length === 0
      ? []
      : await db.query.users.findMany({
          where: (table, { inArray }) => inArray(table.id, ownerIds),
        });

  const artifactByReleaseId = new Map(
    artifacts.map((artifact) => [artifact.releaseId, artifact]),
  );
  const checksByReleaseId = new Map<string, (typeof checks)[number][]>();
  const reportsByReleaseId = new Map<string, (typeof reports)[number][]>();
  const gameById = new Map(releaseGames.map((game) => [game.id, game]));
  const ownerById = new Map(
    releaseOwners.map((owner) => [
      owner.id,
      {
        id: owner.id,
        name: owner.name,
        email: owner.email,
        role: owner.role,
      },
    ]),
  );

  for (const check of checks) {
    const releaseChecks = checksByReleaseId.get(check.releaseId) ?? [];
    releaseChecks.push(check);
    checksByReleaseId.set(check.releaseId, releaseChecks);
  }

  for (const report of reports) {
    const releaseReports = reportsByReleaseId.get(report.releaseId) ?? [];
    releaseReports.push(report);
    reportsByReleaseId.set(report.releaseId, releaseReports);
  }

  return releases.map((release) => {
    const game = gameById.get(release.gameId);
    return {
      ...release,
      game: game
        ? { ...game, owner: ownerById.get(game.userId) ?? null }
        : null,
      artifact: artifactByReleaseId.get(release.id) ?? null,
      checks: checksByReleaseId.get(release.id) ?? [],
      reports: reportsByReleaseId.get(release.id) ?? [],
    };
  });
};

export const quarantineReleaseForOperations = async ({
  actor,
  releaseId,
}: {
  actor: OperationsPlatformActor;
  releaseId: string;
}) => {
  assertOperationsActor(actor);
  await assertReleaseExists(releaseId);
  await quarantineRelease({ releaseId });
  return assertReleaseExists(releaseId);
};

export const moderateReleaseForOperations = async ({
  actor,
  releaseId,
}: {
  actor: OperationsPlatformActor;
  releaseId: string;
}) => {
  assertOperationsActor(actor);
  await assertReleaseExists(releaseId);
  await runReleaseModeration({ releaseId });
  return assertReleaseExists(releaseId);
};

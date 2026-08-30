import { db } from "@/db";
import {
  gameReleaseChecks,
  gameReleaseGenerations,
  gameReleaseReports,
  gameReleases,
  games,
  users,
} from "@/db/schema";
import { desc, eq, inArray } from "drizzle-orm";

type GameRecord = typeof games.$inferSelect;
type ReleaseRecord = typeof gameReleases.$inferSelect;
type ReleaseGenerationRecord = typeof gameReleaseGenerations.$inferSelect;
type ReleaseCheckRecord = typeof gameReleaseChecks.$inferSelect;

export const projectReleaseGeneration = (
  generation: ReleaseGenerationRecord,
) => ({
  id: generation.id,
  releaseId: generation.releaseId,
  sequence: generation.sequence,
  status: generation.status,
  originalFilename: generation.originalFilename,
  contentType: generation.contentType,
  declaredSizeBytes: generation.declaredSizeBytes,
  observedSizeBytes: generation.observedSizeBytes,
  observedContentType: generation.observedContentType,
  observedEtag: generation.observedEtag,
  observedLastModifiedAt: generation.observedLastModifiedAt,
  extractedSizeBytes: generation.extractedSizeBytes,
  fileCount: generation.fileCount,
  entryPath: generation.entryPath,
  contentHash: generation.contentHash,
  createdAt: generation.createdAt,
  uploadObservedAt: generation.uploadObservedAt,
  processingStartedAt: generation.processingStartedAt,
  readyAt: generation.readyAt,
  failedAt: generation.failedAt,
  abandonedAt: generation.abandonedAt,
});

export const projectReleaseCheck = (check: ReleaseCheckRecord) => ({
  id: check.id,
  releaseId: check.releaseId,
  generationId: check.generationId,
  jobId: check.jobId,
  jobAttempt: check.jobAttempt,
  kind: check.kind,
  status: check.status,
  summary: check.summary,
  createdAt: check.createdAt,
});

const loadReleaseDetails = async ({
  game,
  releases,
}: {
  game: GameRecord;
  releases: ReleaseRecord[];
}) => {
  if (releases.length === 0) {
    return [];
  }

  const releaseIds = releases.map((release) => release.id);
  const [owner, generations, checks, reports] = await Promise.all([
    db.query.users.findFirst({ where: eq(users.id, game.userId) }),
    db
      .select()
      .from(gameReleaseGenerations)
      .where(inArray(gameReleaseGenerations.releaseId, releaseIds))
      .orderBy(desc(gameReleaseGenerations.sequence)),
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
  ]);

  const generationsByReleaseId = new Map<
    string,
    ReturnType<typeof projectReleaseGeneration>[]
  >();
  const checksByReleaseId = new Map<string, (typeof checks)[number][]>();
  const reportsByReleaseId = new Map<string, (typeof reports)[number][]>();

  for (const generation of generations) {
    const releaseGenerations =
      generationsByReleaseId.get(generation.releaseId) ?? [];
    releaseGenerations.push(projectReleaseGeneration(generation));
    generationsByReleaseId.set(generation.releaseId, releaseGenerations);
  }

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

  const ownerProjection = owner
    ? {
        id: owner.id,
        name: owner.name,
        email: owner.email,
        role: owner.role,
      }
    : null;

  return releases.map((release) => {
    const releaseGenerations = generationsByReleaseId.get(release.id) ?? [];
    const generationById = new Map(
      releaseGenerations.map((generation) => [generation.id, generation]),
    );

    return {
      ...release,
      game,
      owner: ownerProjection,
      generations: releaseGenerations,
      candidateGeneration: release.candidateGenerationId
        ? (generationById.get(release.candidateGenerationId) ?? null)
        : null,
      promotedGeneration: release.promotedGenerationId
        ? (generationById.get(release.promotedGenerationId) ?? null)
        : null,
      checks: (checksByReleaseId.get(release.id) ?? []).map(
        projectReleaseCheck,
      ),
      reports: reportsByReleaseId.get(release.id) ?? [],
    };
  });
};

export const listReleaseDetailsByGame = async (game: GameRecord) => {
  const releases = await db.query.gameReleases.findMany({
    where: (table, { eq }) => eq(table.gameId, game.id),
    orderBy: (table, { desc }) => [desc(table.createdAt)],
  });

  return loadReleaseDetails({ game, releases });
};

export const getReleaseDetails = async (releaseId: string) => {
  const release = await db.query.gameReleases.findFirst({
    where: (table, { eq }) => eq(table.id, releaseId),
  });

  if (!release) {
    return null;
  }

  const game = await db.query.games.findFirst({
    where: (table, { eq }) => eq(table.id, release.gameId),
  });

  if (!game) {
    throw new Error("Release game is missing.");
  }

  const [details] = await loadReleaseDetails({ game, releases: [release] });
  return details ?? null;
};

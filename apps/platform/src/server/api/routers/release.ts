import { db } from "@/db";
import {
  gameReleaseArtifacts,
  gameReleaseChecks,
  gameReleaseReports,
  gameReleases,
  games,
} from "@/db/schema";
import {
  gameReleaseStatusSchema,
  gameReleaseStatusValues,
  releaseReportSourceSchema,
} from "@/lib/releases/release-contract";
import {
  MAX_RELEASE_ZIP_BYTES,
  canTransitionReleaseStatus,
} from "@/lib/releases/release-policy";
import { assertOwnedGame } from "@/server/games/assert-owned-game";
import {
  finalizeReleaseUpload,
  requestReleaseUploadTarget,
} from "@/server/releases/release-artifact-service";
import { assertOwnedRelease } from "@/server/releases/assert-owned-release";
import { runReleaseModeration } from "@/server/releases/release-moderation-service";
import { findPublicReleaseBySlugOrId } from "@/server/releases/public-release-record";
import { and, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "../trpc";

const createDraftReleaseInput = z.object({
  gameId: z.string(),
  versionLabel: z.string().trim().min(1).max(100).optional(),
});

const releaseStatusMutationInput = z.object({
  releaseId: z.string(),
});

const requestUploadTargetInput = z.object({
  releaseId: z.string(),
  originalFilename: z.string().trim().min(1).max(255),
  sizeBytes: z.number().int().positive().max(MAX_RELEASE_ZIP_BYTES),
});

const reportPublicReleaseInput = z.object({
  slugOrId: z.string().trim().min(1),
  source: releaseReportSourceSchema,
  reason: z.string().trim().min(3).max(120),
  details: z.string().trim().max(2000).optional(),
  reporterEmail: z.string().trim().email().max(320).optional(),
});

export const releaseRouter = createTRPCRouter({
  listByGame: protectedProcedure
    .input(z.object({ gameId: z.string() }))
    .query(async ({ input, ctx }) => {
      await assertOwnedGame(input.gameId, ctx.user.id);

      const releases = await db.query.gameReleases.findMany({
        where: (gameReleases, { eq }) => eq(gameReleases.gameId, input.gameId),
        orderBy: (gameReleases, { desc }) => [desc(gameReleases.createdAt)],
      });

      const releaseIds = releases.map((release) => release.id);
      if (releaseIds.length === 0) {
        return [];
      }

      const [artifacts, checks, reports] = await Promise.all([
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
      ]);

      const artifactByReleaseId = new Map(
        artifacts.map((artifact) => [artifact.releaseId, artifact]),
      );
      const checksByReleaseId = new Map<string, (typeof checks)[number][]>();
      const reportsByReleaseId = new Map<string, (typeof reports)[number][]>();

      for (const check of checks) {
        const existingChecks = checksByReleaseId.get(check.releaseId) ?? [];
        existingChecks.push(check);
        checksByReleaseId.set(check.releaseId, existingChecks);
      }

      for (const report of reports) {
        const existingReports = reportsByReleaseId.get(report.releaseId) ?? [];
        existingReports.push(report);
        reportsByReleaseId.set(report.releaseId, existingReports);
      }

      return releases.map((release) => ({
        ...release,
        artifact: artifactByReleaseId.get(release.id) ?? null,
        checks: checksByReleaseId.get(release.id) ?? [],
        reports: reportsByReleaseId.get(release.id) ?? [],
      }));
    }),

  get: protectedProcedure
    .input(z.object({ releaseId: z.string() }))
    .query(async ({ input, ctx }) => {
      return assertOwnedRelease(input.releaseId, ctx.user.id);
    }),

  createDraft: protectedProcedure
    .input(createDraftReleaseInput)
    .mutation(async ({ input, ctx }) => {
      await assertOwnedGame(input.gameId, ctx.user.id);

      const [release] = await db
        .insert(gameReleases)
        .values({
          id: crypto.randomUUID(),
          gameId: input.gameId,
          sourceKind: "upload",
          status: "draft",
          versionLabel: input.versionLabel?.trim() || null,
        })
        .returning();

      return release;
    }),

  listStatuses: protectedProcedure.query(async () => {
    return gameReleaseStatusValues;
  }),

  requestUploadTarget: protectedProcedure
    .input(requestUploadTargetInput)
    .mutation(async ({ input, ctx }) => {
      const release = await assertOwnedRelease(input.releaseId, ctx.user.id);

      return requestReleaseUploadTarget({
        release,
        originalFilename: input.originalFilename,
        sizeBytes: input.sizeBytes,
      });
    }),

  finalizeUpload: protectedProcedure
    .input(releaseStatusMutationInput)
    .mutation(async ({ input, ctx }) => {
      const release = await assertOwnedRelease(input.releaseId, ctx.user.id);
      await finalizeReleaseUpload({
        release,
      });

      return assertOwnedRelease(input.releaseId, ctx.user.id);
    }),

  publish: protectedProcedure
    .input(releaseStatusMutationInput)
    .mutation(async ({ input, ctx }) => {
      const release = await assertOwnedRelease(input.releaseId, ctx.user.id);
      if (release.status !== "ready") {
        throw new Error("Only ready releases can be published.");
      }

      await runReleaseModeration({
        releaseId: release.id,
      });

      const now = new Date();
      return db.transaction(async (tx) => {
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
          .where(eq(gameReleases.id, input.releaseId))
          .returning();

        return publishedRelease;
      });
    }),

  archive: protectedProcedure
    .input(releaseStatusMutationInput)
    .mutation(async ({ input, ctx }) => {
      const release = await assertOwnedRelease(input.releaseId, ctx.user.id);
      if (release.status === "archived") {
        return release;
      }

      return db.transaction(async (tx) => {
        const [archivedRelease] = await tx
          .update(gameReleases)
          .set({
            status: "archived",
            archivedAt: new Date(),
          })
          .where(eq(gameReleases.id, input.releaseId))
          .returning();

        if (release.status === "live") {
          await tx
            .update(games)
            .set({
              arcadeVisibility: "hidden",
              updatedAt: new Date(),
            })
            .where(eq(games.id, release.gameId));
        }

        return archivedRelease;
      });
    }),

  quarantine: protectedProcedure
    .input(releaseStatusMutationInput)
    .mutation(async ({ input, ctx }) => {
      const release = await assertOwnedRelease(input.releaseId, ctx.user.id);
      if (release.status === "quarantined") {
        return release;
      }

      return db.transaction(async (tx) => {
        const [quarantinedRelease] = await tx
          .update(gameReleases)
          .set({
            status: "quarantined",
            quarantinedAt: new Date(),
          })
          .where(eq(gameReleases.id, input.releaseId))
          .returning();

        if (release.status === "live") {
          await tx
            .update(games)
            .set({
              arcadeVisibility: "hidden",
              updatedAt: new Date(),
            })
            .where(eq(games.id, release.gameId));
        }

        return quarantinedRelease;
      });
    }),

  runModeration: protectedProcedure
    .input(releaseStatusMutationInput)
    .mutation(async ({ input, ctx }) => {
      const release = await assertOwnedRelease(input.releaseId, ctx.user.id);
      await runReleaseModeration({
        releaseId: release.id,
      });

      return assertOwnedRelease(input.releaseId, ctx.user.id);
    }),

  reportPublic: publicProcedure
    .input(reportPublicReleaseInput)
    .mutation(async ({ input }) => {
      const publicRelease = await findPublicReleaseBySlugOrId(input.slugOrId);

      const [report] = await db
        .insert(gameReleaseReports)
        .values({
          id: crypto.randomUUID(),
          releaseId: publicRelease.releaseId,
          status: "open",
          source: input.source,
          reason: input.reason.trim(),
          details: input.details?.trim() || null,
          reporterEmail: input.reporterEmail?.trim() || null,
        })
        .returning();

      return report;
    }),

  updateStatus: protectedProcedure
    .input(
      z.object({
        releaseId: z.string(),
        status: gameReleaseStatusSchema,
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const release = await assertOwnedRelease(input.releaseId, ctx.user.id);
      if (release.status === input.status) {
        return release;
      }
      if (input.status === "live") {
        throw new Error("Use publish() to promote a release to live.");
      }
      if (!canTransitionReleaseStatus(release.status, input.status)) {
        throw new Error(
          `Illegal release status transition: ${release.status} -> ${input.status}`,
        );
      }

      const now = new Date();
      const statusTimestamps = {
        checkedAt: input.status === "ready" ? now : release.checkedAt,
        publishedAt: release.publishedAt,
        quarantinedAt:
          input.status === "quarantined" ? now : release.quarantinedAt,
        archivedAt: input.status === "archived" ? now : release.archivedAt,
      };

      return db.transaction(async (tx) => {
        const [updatedRelease] = await tx
          .update(gameReleases)
          .set({
            status: input.status,
            ...statusTimestamps,
          })
          .where(eq(gameReleases.id, input.releaseId))
          .returning();

        if (release.status === "live") {
          await tx
            .update(games)
            .set({
              arcadeVisibility: "hidden",
              updatedAt: new Date(),
            })
            .where(eq(games.id, release.gameId));
        }

        return updatedRelease;
      });
    }),
});

import { db } from "@/db";
import { operationalJobAttempts, operationalJobs } from "@/db/schema";
import {
  getReleaseStorage,
  type ReleaseStorage,
} from "@/server/releases/release-storage";
import { and, asc, eq, inArray, isNotNull, isNull } from "drizzle-orm";
import { resolveDatabaseAuthorityNow } from "../operations/database-authority";
import {
  insertOperationalJobEvent,
  normalizeRequiredJobText,
  type JobDatabase,
} from "./operational-job-internals";

const orphanAttemptStatuses = ["failed", "canceled", "lease_expired"] as const;

export const listReleaseJobOrphanOutputs = async ({
  database = db,
  limit = 100,
}: {
  database?: JobDatabase;
  limit?: number;
} = {}) => {
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 500) {
    throw new Error("Cleanup limit must be between 1 and 500.");
  }
  const attempts = await database
    .select({
      id: operationalJobAttempts.id,
      jobId: operationalJobAttempts.jobId,
      attempt: operationalJobAttempts.attempt,
      status: operationalJobAttempts.status,
      outputRootKey: operationalJobAttempts.outputRootKey,
      finishedAt: operationalJobAttempts.finishedAt,
    })
    .from(operationalJobAttempts)
    .where(
      and(
        inArray(operationalJobAttempts.status, [...orphanAttemptStatuses]),
        isNotNull(operationalJobAttempts.outputRootKey),
        isNull(operationalJobAttempts.outputCleanedAt),
      ),
    )
    .orderBy(asc(operationalJobAttempts.finishedAt))
    .limit(limit);
  return attempts.map((attempt) => ({
    ...attempt,
    outputRootKey: attempt.outputRootKey!,
    finishedAt: attempt.finishedAt?.toISOString() ?? null,
  }));
};

export const cleanupReleaseJobOrphanOutputs = async ({
  database = db,
  storage,
  actor: rawActor,
  reason: rawReason,
  limit = 100,
}: {
  database?: JobDatabase;
  storage?: ReleaseStorage;
  actor: string;
  reason: string;
  limit?: number;
}) => {
  const actor = normalizeRequiredJobText(rawActor, "Actor");
  const reason = normalizeRequiredJobText(rawReason, "Reason");
  const candidates = await listReleaseJobOrphanOutputs({ database, limit });
  if (candidates.length === 0) {
    return { candidates, cleaned: [] } as const;
  }
  const releaseStorage = storage ?? getReleaseStorage();
  const cleaned: Array<{
    attemptId: string;
    jobId: string;
    attempt: number;
    outputCleanedAt: string;
  }> = [];

  for (const candidate of candidates) {
    await releaseStorage.deletePrefix(candidate.outputRootKey);
    const result = await database.transaction(async (tx) => {
      const [attempt] = await tx
        .select()
        .from(operationalJobAttempts)
        .where(eq(operationalJobAttempts.id, candidate.id))
        .for("update");
      if (
        !attempt ||
        !orphanAttemptStatuses.includes(
          attempt.status as (typeof orphanAttemptStatuses)[number],
        ) ||
        !attempt.outputRootKey ||
        attempt.outputCleanedAt
      ) {
        return null;
      }
      const [job] = await tx
        .select()
        .from(operationalJobs)
        .where(eq(operationalJobs.id, attempt.jobId))
        .for("update");
      if (!job) return null;
      const now = await resolveDatabaseAuthorityNow(tx);
      const [updatedAttempt] = await tx
        .update(operationalJobAttempts)
        .set({ outputCleanedAt: now, updatedAt: now })
        .where(
          and(
            eq(operationalJobAttempts.id, attempt.id),
            isNull(operationalJobAttempts.outputCleanedAt),
          ),
        )
        .returning();
      if (!updatedAttempt) return null;
      const nextRevision = job.revision + 1;
      const [updatedJob] = await tx
        .update(operationalJobs)
        .set({ revision: nextRevision, updatedAt: now })
        .where(
          and(
            eq(operationalJobs.id, job.id),
            eq(operationalJobs.revision, job.revision),
          ),
        )
        .returning();
      if (!updatedJob) throw new Error("Output cleanup lost its job fence.");
      await insertOperationalJobEvent({
        tx,
        job: updatedJob,
        kind: "output_cleaned",
        expectedRevision: job.revision,
        nextRevision,
        fromStatus: job.status,
        toStatus: job.status,
        actor,
        reason,
        details: {
          attemptId: attempt.id,
          attempt: attempt.attempt,
          outputRootKey: attempt.outputRootKey,
        },
      });
      return {
        attemptId: attempt.id,
        jobId: job.id,
        attempt: attempt.attempt,
        outputCleanedAt: now.toISOString(),
      };
    });
    if (result) cleaned.push(result);
  }

  return { candidates, cleaned } as const;
};

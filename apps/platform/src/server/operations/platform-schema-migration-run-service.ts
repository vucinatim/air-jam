import { db } from "@/db";
import {
  platformSchemaMigrationRuns,
  type PlatformSchemaMigrationRunStatus,
} from "@/db/schema";
import { and, eq, inArray } from "drizzle-orm";

export const PLATFORM_SCHEMA_MIGRATION_RUN_CONTRACT_VERSION = 1 as const;

type MigrationRunDatabase = typeof db;
type MigrationRun = typeof platformSchemaMigrationRuns.$inferSelect;

export class PlatformSchemaMigrationRunConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PlatformSchemaMigrationRunConflictError";
  }
}

export const getPlatformSchemaMigrationRun = async ({
  database = db,
  planDigest,
}: {
  database?: MigrationRunDatabase;
  planDigest: string;
}): Promise<MigrationRun | null> =>
  (await database.query.platformSchemaMigrationRuns.findFirst({
    where: (table, { eq }) => eq(table.planDigest, planDigest),
  })) ?? null;

export const beginPlatformSchemaMigrationRun = async ({
  database = db,
  input,
}: {
  database?: MigrationRunDatabase;
  input: {
    id: string;
    planDigest: string;
    idempotencyKey: string;
    targetFingerprint: string;
    sourceCommit: string;
    sourceHeadTag: string;
    sourceHeadCreatedAt: number;
    sourceHeadHash: string;
    actor: string;
    reason: string;
    plan: Record<string, unknown>;
    backupEvidence: Record<string, unknown>;
    drainEvidence: Record<string, unknown>;
  };
}): Promise<MigrationRun> => {
  const existing = await database.query.platformSchemaMigrationRuns.findFirst({
    where: (table, { or, eq }) =>
      or(
        eq(table.planDigest, input.planDigest),
        eq(table.idempotencyKey, input.idempotencyKey),
      ),
  });
  if (existing) {
    if (
      existing.planDigest !== input.planDigest ||
      existing.idempotencyKey !== input.idempotencyKey
    ) {
      throw new PlatformSchemaMigrationRunConflictError(
        "Migration run idempotency conflicts with an existing run.",
      );
    }
    return existing;
  }

  try {
    const [created] = await database
      .insert(platformSchemaMigrationRuns)
      .values({
        ...input,
        contractVersion: PLATFORM_SCHEMA_MIGRATION_RUN_CONTRACT_VERSION,
        status: "applying",
      })
      .returning();
    if (!created) {
      throw new PlatformSchemaMigrationRunConflictError(
        "Migration run was not created.",
      );
    }
    return created;
  } catch (error) {
    const replay = await database.query.platformSchemaMigrationRuns.findFirst({
      where: (table, { or, eq }) =>
        or(
          eq(table.planDigest, input.planDigest),
          eq(table.idempotencyKey, input.idempotencyKey),
        ),
    });
    if (
      replay?.planDigest === input.planDigest &&
      replay.idempotencyKey === input.idempotencyKey
    ) {
      return replay;
    }
    throw error;
  }
};

const transitionPlatformSchemaMigrationRun = async ({
  database,
  planDigest,
  from,
  values,
}: {
  database: MigrationRunDatabase;
  planDigest: string;
  from: PlatformSchemaMigrationRunStatus[];
  values: Partial<typeof platformSchemaMigrationRuns.$inferInsert>;
}): Promise<MigrationRun> => {
  const [updated] = await database
    .update(platformSchemaMigrationRuns)
    .set({ ...values, updatedAt: new Date() })
    .where(
      and(
        eq(platformSchemaMigrationRuns.planDigest, planDigest),
        inArray(platformSchemaMigrationRuns.status, from),
      ),
    )
    .returning();
  if (!updated) {
    const current = await getPlatformSchemaMigrationRun({
      database,
      planDigest,
    });
    throw new PlatformSchemaMigrationRunConflictError(
      `Migration run cannot transition from ${current?.status ?? "missing"}; expected ${from.join(" or ")}.`,
    );
  }
  return updated;
};

export const restartFailedPlatformSchemaMigrationRun = ({
  database = db,
  planDigest,
}: {
  database?: MigrationRunDatabase;
  planDigest: string;
}) =>
  transitionPlatformSchemaMigrationRun({
    database,
    planDigest,
    from: ["apply_failed"],
    values: {
      status: "applying",
      completedAt: null,
      verification: null,
    },
  });

export const markPlatformSchemaMigrationApplied = ({
  database = db,
  planDigest,
  appliedAt = new Date(),
}: {
  database?: MigrationRunDatabase;
  planDigest: string;
  appliedAt?: Date;
}) =>
  transitionPlatformSchemaMigrationRun({
    database,
    planDigest,
    from: ["applying", "apply_failed", "verification_failed"],
    values: {
      status: "applied",
      appliedAt,
      completedAt: null,
      verification: null,
    },
  });

export const markPlatformSchemaMigrationApplyFailed = ({
  database = db,
  planDigest,
  verification,
}: {
  database?: MigrationRunDatabase;
  planDigest: string;
  verification: Record<string, unknown>;
}) =>
  transitionPlatformSchemaMigrationRun({
    database,
    planDigest,
    from: ["applying"],
    values: {
      status: "apply_failed",
      completedAt: new Date(),
      verification,
    },
  });

export const markPlatformSchemaMigrationVerificationFailed = ({
  database = db,
  planDigest,
  verification,
  appliedAt,
}: {
  database?: MigrationRunDatabase;
  planDigest: string;
  verification: Record<string, unknown>;
  appliedAt?: Date;
}) =>
  transitionPlatformSchemaMigrationRun({
    database,
    planDigest,
    from: ["applying", "applied", "verification_failed"],
    values: {
      status: "verification_failed",
      appliedAt: appliedAt ?? new Date(),
      completedAt: new Date(),
      verification,
    },
  });

export const markPlatformSchemaMigrationVerified = ({
  database = db,
  planDigest,
  verification,
}: {
  database?: MigrationRunDatabase;
  planDigest: string;
  verification: Record<string, unknown>;
}) =>
  transitionPlatformSchemaMigrationRun({
    database,
    planDigest,
    from: ["applied", "verification_failed"],
    values: {
      status: "verified",
      completedAt: new Date(),
      verification,
    },
  });

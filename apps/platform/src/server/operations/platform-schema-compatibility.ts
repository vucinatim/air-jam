import { db } from "@/db";
import { platformSchemaHead } from "@/db/platform-schema-head.generated";
import { sql } from "drizzle-orm";

export const PLATFORM_SCHEMA_COMPATIBILITY_CONTRACT_VERSION = 1 as const;

export type PlatformSchemaCompatibilityStatus =
  | "ready"
  | "missing_journal"
  | "behind"
  | "ahead"
  | "drifted"
  | "unavailable";

export type PlatformSchemaCompatibility = {
  contractVersion: typeof PLATFORM_SCHEMA_COMPATIBILITY_CONTRACT_VERSION;
  status: PlatformSchemaCompatibilityStatus;
  compatible: boolean;
  expected: typeof platformSchemaHead;
  observed: {
    createdAt: number;
    hash: string;
  } | null;
  reason:
    | null
    | "migration_journal_missing"
    | "database_schema_behind"
    | "database_schema_ahead"
    | "migration_hash_mismatch"
    | "migration_journal_corrupt"
    | "database_authority_unavailable";
};

type SchemaCompatibilityDatabase = Pick<typeof db, "execute">;

const buildCompatibility = ({
  status,
  observed,
  reason,
}: {
  status: PlatformSchemaCompatibilityStatus;
  observed: PlatformSchemaCompatibility["observed"];
  reason: PlatformSchemaCompatibility["reason"];
}): PlatformSchemaCompatibility => ({
  contractVersion: PLATFORM_SCHEMA_COMPATIBILITY_CONTRACT_VERSION,
  status,
  compatible: status === "ready",
  expected: platformSchemaHead,
  observed,
  reason,
});

export const classifyPlatformSchemaHead = (
  observed: PlatformSchemaCompatibility["observed"],
): PlatformSchemaCompatibility => {
  if (!observed) {
    return buildCompatibility({
      status: "missing_journal",
      observed: null,
      reason: "migration_journal_missing",
    });
  }
  if (observed.createdAt < platformSchemaHead.createdAt) {
    return buildCompatibility({
      status: "behind",
      observed,
      reason: "database_schema_behind",
    });
  }
  if (observed.createdAt > platformSchemaHead.createdAt) {
    return buildCompatibility({
      status: "ahead",
      observed,
      reason: "database_schema_ahead",
    });
  }
  if (observed.hash !== platformSchemaHead.hash) {
    return buildCompatibility({
      status: "drifted",
      observed,
      reason: "migration_hash_mismatch",
    });
  }
  return buildCompatibility({ status: "ready", observed, reason: null });
};

export const readPlatformSchemaCompatibility = async ({
  database = db,
}: {
  database?: SchemaCompatibilityDatabase;
} = {}): Promise<PlatformSchemaCompatibility> => {
  let relationRows: Awaited<ReturnType<SchemaCompatibilityDatabase["execute"]>>;
  try {
    relationRows = await database.execute(
      sql`select to_regclass('drizzle.__drizzle_migrations') as relation`,
    );
  } catch {
    return buildCompatibility({
      status: "unavailable",
      observed: null,
      reason: "database_authority_unavailable",
    });
  }
  const relation = (relationRows[0] as { relation?: string | null } | undefined)
    ?.relation;
  if (!relation) return classifyPlatformSchemaHead(null);

  let headRows: Awaited<ReturnType<SchemaCompatibilityDatabase["execute"]>>;
  try {
    headRows = await database.execute(sql`
      select hash, created_at
      from drizzle.__drizzle_migrations
      order by created_at desc
      limit 1
    `);
  } catch {
    return buildCompatibility({
      status: "unavailable",
      observed: null,
      reason: "database_authority_unavailable",
    });
  }
  const row = headRows[0] as
    | { hash?: string; created_at?: number | string }
    | undefined;
  if (!row) return classifyPlatformSchemaHead(null);
  const createdAt = Number(row.created_at);
  if (!row.hash || !Number.isSafeInteger(createdAt)) {
    return buildCompatibility({
      status: "drifted",
      observed: null,
      reason: "migration_journal_corrupt",
    });
  }
  return classifyPlatformSchemaHead({ createdAt, hash: row.hash });
};

export class PlatformSchemaIncompatibleError extends Error {
  readonly compatibility: PlatformSchemaCompatibility;

  constructor(compatibility: PlatformSchemaCompatibility) {
    super(
      `Platform schema is incompatible: ${compatibility.reason ?? compatibility.status}.`,
    );
    this.name = "PlatformSchemaIncompatibleError";
    this.compatibility = compatibility;
  }
}

export const assertPlatformSchemaCompatible = async ({
  database = db,
}: {
  database?: SchemaCompatibilityDatabase;
} = {}): Promise<PlatformSchemaCompatibility> => {
  const compatibility = await readPlatformSchemaCompatibility({ database });
  if (!compatibility.compatible) {
    throw new PlatformSchemaIncompatibleError(compatibility);
  }
  return compatibility;
};

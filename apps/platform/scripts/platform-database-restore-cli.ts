import {
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";
import {
  canonicalJson,
  digestCanonicalJson,
  readPlatformMigrationCatalog,
} from "../../../scripts/platform/lib/platform-migration-catalog.mjs";
import {
  assertPlatformDatabaseRestoreTarget,
  platformBackupContractVersion,
  platformRecoverySnapshotDigest,
  readPlatformDatabaseIdentity,
  readPlatformDatabaseRowCounts,
  readPlatformSchemaHead,
  restorePlatformDatabaseDump,
  sha256,
  sha256File,
  type PlatformBackupEvidence,
  type PlatformDatabaseIdentity,
  type PlatformDatabaseTarget,
  type PlatformSchemaHead,
} from "./lib/platform-postgres-tooling";

const contractVersion = 1 as const;
const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
);
const migrationsRoot = path.join(repoRoot, "apps/platform/drizzle");
const operationsRoot = path.join(
  repoRoot,
  ".airjam/operations/database-restores",
);

type TargetInspection = {
  identity: PlatformDatabaseIdentity;
  schemaHead: PlatformSchemaHead;
  rowCounts: Record<string, number>;
  snapshotDigest: string;
};
type RestorePlan = {
  contractVersion: 1;
  command: "platform.database.restore";
  createdAt: string;
  source: {
    manifestPath: string;
    manifestSha256: string;
    backup: PlatformBackupEvidence;
  };
  target: TargetInspection["identity"];
  before: {
    schemaHead: PlatformSchemaHead;
    rowCounts: Record<string, number>;
    snapshotDigest: string;
  };
  verification: {
    expectedSchemaHead: PlatformSchemaHead;
    expectedRowCounts: Record<string, number>;
    expectedSnapshotDigest: string;
  };
  digest: string;
};
type Operation = {
  command: "plan" | "apply" | "verify";
  target: PlatformDatabaseTarget;
  json?: boolean;
  backupManifest?: string;
  output?: string;
  plan?: string;
  planDigest?: string;
  actor?: string;
  reason?: string;
  idempotencyKey?: string;
  apply?: boolean;
  attestIsolatedLoopback?: boolean;
};

const requireText = (value: string | undefined, label: string) => {
  const normalized = value?.trim();
  if (!normalized) throw new Error(`${label} is required.`);
  return normalized;
};
const resolveRepoPath = (value: string) => path.resolve(repoRoot, value);

const inspectTarget = async (
  client: ReturnType<typeof postgres>,
  target: PlatformDatabaseTarget,
): Promise<TargetInspection> => {
  const identity = await readPlatformDatabaseIdentity(client, target);
  const schemaHead = await readPlatformSchemaHead(client);
  const rowCounts = await readPlatformDatabaseRowCounts(client);
  return {
    identity,
    schemaHead,
    rowCounts,
    snapshotDigest: platformRecoverySnapshotDigest({ schemaHead, rowCounts }),
  };
};

const readBackup = async (manifestCandidate: string) => {
  const manifestPath = resolveRepoPath(manifestCandidate);
  if (!existsSync(manifestPath))
    throw new Error("Backup manifest does not exist.");
  const manifestBytes = readFileSync(manifestPath);
  const backup = JSON.parse(
    manifestBytes.toString("utf8"),
  ) as PlatformBackupEvidence;
  if (
    backup?.contractVersion !== platformBackupContractVersion ||
    backup.artifact?.format !== "postgres-custom" ||
    !backup.sourceDatabase?.serverVersion ||
    !backup.recoverySnapshot?.digest
  ) {
    throw new Error(
      "Backup manifest must use the recovery-capable contract version 2.",
    );
  }
  const artifactPath = resolveRepoPath(backup.artifact.path);
  if (!existsSync(artifactPath))
    throw new Error("Backup artifact does not exist.");
  if (statSync(artifactPath).size !== backup.artifact.sizeBytes) {
    throw new Error("Backup artifact size changed after capture.");
  }
  if ((await sha256File(artifactPath)) !== backup.artifact.sha256) {
    throw new Error("Backup artifact digest changed after capture.");
  }
  const expectedSnapshotDigest = platformRecoverySnapshotDigest({
    schemaHead: backup.schemaHead,
    rowCounts: backup.recoverySnapshot.rowCounts,
  });
  if (backup.recoverySnapshot.digest !== expectedSnapshotDigest) {
    throw new Error("Backup recovery snapshot digest is invalid.");
  }
  return {
    backup,
    manifestPath,
    manifestSha256: await sha256File(manifestPath),
    artifactPath,
  };
};

const readPlan = (candidate: string) => {
  const absolutePath = resolveRepoPath(candidate);
  const plan = JSON.parse(readFileSync(absolutePath, "utf8")) as RestorePlan;
  if (plan?.command !== "platform.database.restore" || !plan.digest) {
    throw new Error("Restore plan document has an unsupported shape.");
  }
  const { digest, ...unsigned } = plan;
  const calculated = digestCanonicalJson(unsigned);
  if (digest !== calculated) throw new Error("Restore plan digest is invalid.");
  return { plan, absolutePath, digest: calculated };
};

const writePlan = async ({
  operation,
  inspection,
  expectedSchemaHead,
}: {
  operation: Operation;
  inspection: TargetInspection;
  expectedSchemaHead: PlatformSchemaHead;
}) => {
  const source = await readBackup(
    requireText(operation.backupManifest, "Backup manifest"),
  );
  assertPlatformDatabaseRestoreTarget({
    target: operation.target,
    sourceTarget: source.backup.sourceDatabase.target,
    attestIsolatedLoopback: operation.attestIsolatedLoopback,
  });
  if (source.backup.targetFingerprint === inspection.identity.fingerprint) {
    throw new Error("Restore source and target fingerprints must differ.");
  }
  const sourceMajor = Math.floor(
    Number(source.backup.sourceDatabase.serverVersion) / 10_000,
  );
  const targetMajor = Math.floor(
    Number(inspection.identity.serverVersion) / 10_000,
  );
  if (!Number.isInteger(sourceMajor) || !Number.isInteger(targetMajor)) {
    throw new Error("Backup or target PostgreSQL server version is invalid.");
  }
  if (targetMajor < sourceMajor) {
    throw new Error(
      `Restore target PostgreSQL ${targetMajor} is older than backup source PostgreSQL ${sourceMajor}.`,
    );
  }
  if (
    canonicalJson(source.backup.schemaHead) !==
    canonicalJson(expectedSchemaHead)
  ) {
    throw new Error(
      "Backup schema head does not match the current source migration catalog.",
    );
  }
  const unsigned = {
    contractVersion,
    command: "platform.database.restore" as const,
    createdAt: new Date().toISOString(),
    source: {
      manifestPath: path.relative(repoRoot, source.manifestPath),
      manifestSha256: source.manifestSha256,
      backup: source.backup,
    },
    target: inspection.identity,
    before: {
      schemaHead: inspection.schemaHead,
      rowCounts: inspection.rowCounts,
      snapshotDigest: inspection.snapshotDigest,
    },
    verification: {
      expectedSchemaHead: source.backup.schemaHead,
      expectedRowCounts: source.backup.recoverySnapshot.rowCounts,
      expectedSnapshotDigest: source.backup.recoverySnapshot.digest,
    },
  };
  const digest = digestCanonicalJson(unsigned);
  const plan: RestorePlan = { ...unsigned, digest };
  mkdirSync(operationsRoot, { recursive: true, mode: 0o700 });
  const output = resolveRepoPath(
    operation.output ??
      path.join(
        ".airjam/operations/database-restores",
        `plan-${digest.slice(0, 12)}.json`,
      ),
  );
  mkdirSync(path.dirname(output), { recursive: true, mode: 0o700 });
  writeFileSync(output, `${canonicalJson(plan)}\n`, {
    flag: "wx",
    mode: 0o600,
  });
  return {
    contractVersion,
    status: "restore_planned",
    applied: false,
    planPath: path.relative(repoRoot, output),
    planDigest: digest,
    plan,
  };
};

const assertPlanTarget = ({
  plan,
  inspection,
  operation,
  digest,
}: {
  plan: RestorePlan;
  inspection: TargetInspection;
  operation: Operation;
  digest: string;
}) => {
  assertPlatformDatabaseRestoreTarget({
    target: operation.target,
    sourceTarget: plan.source.backup.sourceDatabase.target,
    attestIsolatedLoopback: operation.attestIsolatedLoopback,
  });
  if (operation.planDigest !== digest) {
    throw new Error("--plan-digest must exactly match the restore plan.");
  }
  if (canonicalJson(operation.target) !== canonicalJson(plan.target.target)) {
    throw new Error("Restore target identity changed after planning.");
  }
  if (inspection.identity.fingerprint !== plan.target.fingerprint) {
    throw new Error("Restore target fingerprint changed after planning.");
  }
};

const verifyInspection = (plan: RestorePlan, inspection: TargetInspection) => {
  const checks = [
    {
      id: "database.schema-head",
      passed:
        canonicalJson(inspection.schemaHead) ===
        canonicalJson(plan.verification.expectedSchemaHead),
      expected: plan.verification.expectedSchemaHead,
      observed: inspection.schemaHead,
    },
    {
      id: "database.row-counts",
      passed:
        canonicalJson(inspection.rowCounts) ===
        canonicalJson(plan.verification.expectedRowCounts),
      expectedDigest: plan.verification.expectedSnapshotDigest,
      observedDigest: inspection.snapshotDigest,
    },
  ];
  return { checks, verified: checks.every((check) => check.passed) };
};

const applyRestore = async ({
  operation,
  client,
  inspection,
}: {
  operation: Operation;
  client: ReturnType<typeof postgres>;
  inspection: TargetInspection;
}) => {
  if (!operation.apply) throw new Error("Restore apply requires --apply.");
  const actor = requireText(operation.actor, "Actor");
  const reason = requireText(operation.reason, "Reason");
  const idempotencyKey = requireText(
    operation.idempotencyKey,
    "Idempotency key",
  );
  const { plan, digest } = readPlan(requireText(operation.plan, "Plan path"));
  assertPlanTarget({ plan, inspection, operation, digest });
  const source = await readBackup(plan.source.manifestPath);
  if (source.manifestSha256 !== plan.source.manifestSha256) {
    throw new Error("Backup manifest changed after restore planning.");
  }
  const runPath = path.join(
    operationsRoot,
    `run-${sha256(idempotencyKey).slice(0, 24)}.json`,
  );
  if (existsSync(runPath)) {
    const previous = JSON.parse(readFileSync(runPath, "utf8"));
    if (previous.planDigest !== digest) {
      throw new Error(
        "Idempotency key already belongs to another restore plan.",
      );
    }
    return {
      ...previous,
      replayed: true,
      evidencePath: path.relative(repoRoot, runPath),
    };
  }
  if (
    inspection.snapshotDigest !== plan.before.snapshotDigest &&
    inspection.snapshotDigest !== plan.verification.expectedSnapshotDigest
  ) {
    throw new Error("Isolated restore target changed after planning.");
  }
  const alreadyRestored =
    inspection.snapshotDigest === plan.verification.expectedSnapshotDigest;
  const startedAt = new Date();
  if (!alreadyRestored) {
    restorePlatformDatabaseDump({
      databaseUrl: process.env.DATABASE_URL!,
      artifactPath: source.artifactPath,
    });
  }
  const after = await inspectTarget(client, operation.target);
  const verification = verifyInspection(plan, after);
  const verifiedAt = new Date();
  const result = {
    contractVersion,
    status: verification.verified ? "verified" : "verification_failed",
    applied: !alreadyRestored,
    replayed: false,
    planDigest: digest,
    actor,
    reason,
    idempotencyKey,
    startedAt: startedAt.toISOString(),
    verifiedAt: verifiedAt.toISOString(),
    recoveryPoint: plan.source.backup.recoverySnapshot.capturedAt,
    recoveryPointAgeMs:
      startedAt.getTime() -
      new Date(plan.source.backup.recoverySnapshot.capturedAt).getTime(),
    recoveryTimeMs: verifiedAt.getTime() - startedAt.getTime(),
    target: plan.target,
    checks: verification.checks,
  };
  const persisted = verification.verified
    ? result
    : {
        ...result,
        escalationBundle: {
          kind: "isolated_restore_verification_failed",
          planDigest: digest,
          target: plan.target,
          checks: verification.checks,
          nextActions: [
            "Preserve the isolated target and restore artifact for diagnosis.",
            "Do not mutate production or promote this target.",
            "Inspect pg_restore output and the exact schema/count mismatch before creating a new plan.",
          ],
        },
      };
  mkdirSync(operationsRoot, { recursive: true, mode: 0o700 });
  writeFileSync(runPath, `${canonicalJson(persisted)}\n`, {
    flag: "wx",
    mode: 0o600,
  });
  return { ...persisted, evidencePath: path.relative(repoRoot, runPath) };
};

const verifyRestore = async ({
  operation,
  inspection,
}: {
  operation: Operation;
  inspection: TargetInspection;
}) => {
  const { plan, digest } = readPlan(requireText(operation.plan, "Plan path"));
  assertPlanTarget({ plan, inspection, operation, digest });
  const verification = verifyInspection(plan, inspection);
  return {
    contractVersion,
    status: verification.verified ? "verified" : "verification_failed",
    applied: false,
    planDigest: digest,
    verifiedAt: new Date().toISOString(),
    target: plan.target,
    checks: verification.checks,
    ...(verification.verified
      ? {}
      : {
          escalationBundle: {
            kind: "isolated_restore_verification_failed",
            planDigest: digest,
            target: plan.target,
            checks: verification.checks,
          },
        }),
  };
};

const print = (result: Record<string, unknown>, json: boolean) => {
  if (json) console.log(JSON.stringify(result, null, 2));
  else {
    console.log(`Platform database restore: ${result.status}`);
    if (result.planPath) console.log(`Plan: ${result.planPath}`);
    if (result.planDigest) console.log(`Digest: ${result.planDigest}`);
    if (result.recoveryTimeMs !== undefined) {
      console.log(`Recovery time: ${result.recoveryTimeMs} ms`);
    }
    if (result.evidencePath) console.log(`Evidence: ${result.evidencePath}`);
  }
};

const main = async () => {
  const operation = JSON.parse(process.argv[2] ?? "{}") as Operation;
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required.");
  if (!operation.command || !operation.target)
    throw new Error("Invalid operation.");
  const catalog = readPlatformMigrationCatalog({ migrationsRoot });
  const client = postgres(process.env.DATABASE_URL, {
    max: 1,
    onnotice: () => undefined,
  });
  try {
    const inspection = await inspectTarget(client, operation.target);
    let result: Record<string, unknown>;
    if (operation.command === "plan") {
      result = await writePlan({
        operation,
        inspection,
        expectedSchemaHead: {
          createdAt: catalog.head.createdAt,
          hash: catalog.head.hash,
        },
      });
    } else if (operation.command === "apply") {
      result = await applyRestore({ operation, client, inspection });
    } else {
      result = await verifyRestore({ operation, inspection });
    }
    print(result, Boolean(operation.json));
    if (result.status === "verification_failed") process.exitCode = 1;
  } finally {
    await client.end();
  }
};

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  const operation = JSON.parse(process.argv[2] ?? "{}") as Partial<Operation>;
  const result = {
    contractVersion,
    status: "failed",
    error: { message },
    escalationBundle: {
      kind: "isolated_restore_failed",
      plan: operation.plan ?? null,
      planDigest: operation.planDigest ?? null,
      target: operation.target ?? null,
      nextActions: [
        "Preserve the isolated target, plan, manifest, and dump artifact.",
        "Do not mutate production or retry with a broader target.",
        "Inspect the exact failure and create a new plan only if target state changed.",
      ],
    },
  };
  if (operation.json) console.log(JSON.stringify(result, null, 2));
  else console.error(message);
  process.exitCode = 1;
});

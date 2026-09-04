import { spawnSync, type SpawnSyncReturns } from "node:child_process";
import { createHash } from "node:crypto";
import { createReadStream, existsSync } from "node:fs";
import path from "node:path";
import type postgres from "postgres";
import { canonicalJson } from "../../../../scripts/platform/lib/platform-migration-catalog.mjs";

export type PlatformSchemaHead = {
  createdAt: number;
  hash: string;
} | null;

export const platformBackupContractVersion = 2 as const;

export type PlatformDatabaseTarget = {
  kind: "local" | "railway" | "unclassified";
  projectId: string | null;
  environmentId: string | null;
  environmentName: string | null;
  databaseServiceId: string | null;
  databaseServiceName: string | null;
};

export type PlatformDatabaseIdentity = {
  target: PlatformDatabaseTarget;
  databaseName: string;
  serverVersion: string;
  fingerprint: string;
};

export type PlatformDatabaseRecoverySnapshot = {
  capturedAt: string;
  databaseSizeBytes: number;
  rowCounts: Record<string, number>;
  digest: string;
};

export type PlatformBackupEvidence = {
  contractVersion: typeof platformBackupContractVersion;
  createdAt: string;
  targetFingerprint: string;
  sourceDatabase: PlatformDatabaseIdentity;
  schemaHead: PlatformSchemaHead;
  recoverySnapshot: PlatformDatabaseRecoverySnapshot;
  artifact: {
    path: string;
    sha256: string;
    sizeBytes: number;
    format: "postgres-custom";
  };
};

export const assertPlatformDatabaseRestoreTarget = ({
  target,
  sourceTarget,
  attestIsolatedLoopback = false,
}: {
  target: PlatformDatabaseTarget;
  sourceTarget?: PlatformDatabaseTarget;
  attestIsolatedLoopback?: boolean;
}) => {
  if (target.kind === "local") {
    if (target.environmentName === "local" && attestIsolatedLoopback) return;
    throw new Error(
      "A loopback restore target cannot be provider-attested; pass --attest-isolated-loopback only after verifying it is a disposable local database and not a tunnel.",
    );
  }
  const attestedEnvironmentName = target.environmentName?.trim() ?? "";
  if (
    target.kind === "railway" &&
    attestedEnvironmentName.length > 0 &&
    attestedEnvironmentName.toLowerCase() !== "production" &&
    Boolean(target.environmentId) &&
    Boolean(target.databaseServiceId) &&
    Boolean(sourceTarget?.environmentId) &&
    Boolean(sourceTarget?.databaseServiceId) &&
    target.environmentId !== sourceTarget?.environmentId &&
    target.databaseServiceId !== sourceTarget?.databaseServiceId
  ) {
    return;
  }
  throw new Error(
    "Database restore requires an explicitly attested isolated loopback target or a provider-attested non-production Railway database with environment and service identities distinct from the backup source; production, unattested, and unclassified targets are forbidden.",
  );
};

export const sha256 = (value: string | Buffer) =>
  createHash("sha256").update(value).digest("hex");

export const sha256File = (filePath: string) =>
  new Promise<string>((resolve, reject) => {
    const hash = createHash("sha256");
    const stream = createReadStream(filePath);
    stream.on("error", reject);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", () => resolve(hash.digest("hex")));
  });

export const platformRecoverySnapshotDigest = ({
  schemaHead,
  rowCounts,
}: {
  schemaHead: PlatformSchemaHead;
  rowCounts: Record<string, number>;
}) => sha256(canonicalJson({ schemaHead, rowCounts }));

export const readPlatformSchemaHead = async (
  client: ReturnType<typeof postgres>,
): Promise<PlatformSchemaHead> => {
  const [relation] = await client<{ relation: string | null }[]>`
    select to_regclass('drizzle.__drizzle_migrations')::text as relation
  `;
  if (!relation?.relation) return null;
  const [row] = await client<{ hash: string; created_at: string }[]>`
    select hash, created_at::text
    from drizzle.__drizzle_migrations
    order by created_at desc, id desc
    limit 1
  `;
  return row ? { createdAt: Number(row.created_at), hash: row.hash } : null;
};

export const readPlatformDatabaseIdentity = async (
  client: ReturnType<typeof postgres>,
  target: PlatformDatabaseTarget,
): Promise<PlatformDatabaseIdentity> => {
  const [row] = await client<
    { database_name: string; server_version: string }[]
  >`select current_database() as database_name,
           current_setting('server_version_num') as server_version`;
  const publicIdentity = {
    target,
    databaseName: row.database_name,
    serverVersion: row.server_version,
  };
  return {
    ...publicIdentity,
    fingerprint: sha256(canonicalJson(publicIdentity)),
  };
};

const quoteIdentifier = (value: string) => `"${value.replaceAll('"', '""')}"`;

export const postgresConnectionEnvironment = (
  databaseUrl: string,
  { docker = false }: { docker?: boolean } = {},
) => {
  const parsed = new URL(databaseUrl);
  if (!["postgres:", "postgresql:"].includes(parsed.protocol)) {
    throw new Error("DATABASE_URL must use the postgres protocol.");
  }
  const hostname =
    docker &&
    ["localhost", "127.0.0.1", "::1", "[::1]"].includes(parsed.hostname)
      ? "host.docker.internal"
      : parsed.hostname;
  const environment: Record<string, string> = {
    PGHOST: hostname,
    PGPORT: parsed.port || "5432",
    PGDATABASE: decodeURIComponent(parsed.pathname.replace(/^\//u, "")),
  };
  if (parsed.username) environment.PGUSER = decodeURIComponent(parsed.username);
  if (parsed.password) {
    environment.PGPASSWORD = decodeURIComponent(parsed.password);
  }
  const parameterEnvironmentNames: Record<string, string> = {
    application_name: "PGAPPNAME",
    channel_binding: "PGCHANNELBINDING",
    connect_timeout: "PGCONNECT_TIMEOUT",
    options: "PGOPTIONS",
    sslcert: "PGSSLCERT",
    sslkey: "PGSSLKEY",
    sslmode: "PGSSLMODE",
    sslrootcert: "PGSSLROOTCERT",
    target_session_attrs: "PGTARGETSESSIONATTRS",
  };
  for (const [name, value] of parsed.searchParams) {
    const environmentName = parameterEnvironmentNames[name];
    if (!environmentName) {
      throw new Error(
        `DATABASE_URL uses unsupported PostgreSQL parameter ${name}.`,
      );
    }
    environment[environmentName] = value;
  }
  return environment;
};

export const readPlatformDatabaseRowCounts = async (
  client: ReturnType<typeof postgres>,
) => {
  const tables = await client<{ table_schema: string; table_name: string }[]>`
    select table_schema, table_name
    from information_schema.tables
    where table_type = 'BASE TABLE'
      and table_schema in ('public', 'drizzle')
    order by table_schema, table_name
  `;
  const rowCounts: Record<string, number> = {};
  for (const table of tables) {
    const relation = `${quoteIdentifier(table.table_schema)}.${quoteIdentifier(table.table_name)}`;
    const [row] = await client.unsafe<{ count: string }[]>(
      `select count(*)::text as count from ${relation}`,
    );
    rowCounts[`${table.table_schema}.${table.table_name}`] = Number(row.count);
  }
  return rowCounts;
};

const readRecoverySnapshot = async (
  client: ReturnType<typeof postgres>,
  schemaHead: PlatformSchemaHead,
): Promise<PlatformDatabaseRecoverySnapshot> => {
  const [clock] = await client<
    { captured_at: string; database_size_bytes: string }[]
  >`select transaction_timestamp()::text as captured_at,
           pg_database_size(current_database())::text as database_size_bytes`;
  const rowCounts = await readPlatformDatabaseRowCounts(client);
  return {
    capturedAt: new Date(clock.captured_at).toISOString(),
    databaseSizeBytes: Number(clock.database_size_bytes),
    rowCounts,
    digest: platformRecoverySnapshotDigest({ schemaHead, rowCounts }),
  };
};

const executePostgresTool = ({
  command,
  args,
  databaseUrl,
  artifactPath,
  unsupportedPattern,
}: {
  command: "pg_dump" | "pg_restore";
  args: string[];
  databaseUrl: string;
  artifactPath: string;
  unsupportedPattern: RegExp;
}) => {
  const connectionEnvironment = postgresConnectionEnvironment(databaseUrl);
  const configuredRoot = process.env.AIRJAM_POSTGRES_BIN?.trim();
  const localCandidates = [
    command,
    ...(configuredRoot ? [path.join(configuredRoot, command)] : []),
    `/opt/homebrew/opt/libpq/bin/${command}`,
    `/usr/local/opt/libpq/bin/${command}`,
  ].filter(
    (candidate, index, values) =>
      values.indexOf(candidate) === index &&
      (candidate === command || existsSync(candidate)),
  );
  let result: SpawnSyncReturns<string> | null = null;
  for (const candidate of localCandidates) {
    result = spawnSync(candidate, args, {
      encoding: "utf8",
      env: { ...process.env, ...connectionEnvironment },
      stdio: ["ignore", "pipe", "pipe"],
    });
    if (result.status === 0) return;
    const canTryAnother =
      (result.error as NodeJS.ErrnoException | undefined)?.code === "ENOENT" ||
      unsupportedPattern.test(result.stderr ?? "");
    if (!canTryAnother) break;
  }
  const localFailure =
    result?.stderr?.trim() || result?.error?.message || `${command} failed.`;
  const shouldUseDocker =
    (result?.error as NodeJS.ErrnoException | undefined)?.code === "ENOENT" ||
    unsupportedPattern.test(result?.stderr ?? "");
  if (result?.status !== 0 && shouldUseDocker) {
    const dockerEnvironment = postgresConnectionEnvironment(databaseUrl, {
      docker: true,
    });
    const artifactArgumentIndex = args.findIndex(
      (argument) => argument === artifactPath,
    );
    const dockerArgs = [...args];
    if (artifactArgumentIndex >= 0) {
      dockerArgs[artifactArgumentIndex] =
        `/backup/${path.basename(artifactPath)}`;
    }
    result = spawnSync(
      "docker",
      [
        "run",
        "--rm",
        "--add-host",
        "host.docker.internal:host-gateway",
        ...Object.keys(dockerEnvironment).flatMap((name) => ["-e", name]),
        "-v",
        `${path.dirname(artifactPath)}:/backup${command === "pg_restore" ? ":ro" : ""}`,
        "postgres:17",
        command,
        ...dockerArgs,
      ],
      {
        encoding: "utf8",
        env: { ...process.env, ...dockerEnvironment },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
  }
  if (result?.error) {
    throw new Error(
      `${command} failed locally (${localFailure}) and the Docker fallback could not start: ${result.error.message}`,
    );
  }
  if (result?.status !== 0) {
    throw new Error(
      result?.stderr?.trim() || `${command} failed locally: ${localFailure}`,
    );
  }
};

export const createPlatformDatabaseDump = async ({
  client,
  databaseUrl,
  dumpPath,
  schemaHead,
}: {
  client: ReturnType<typeof postgres>;
  databaseUrl: string;
  dumpPath: string;
  schemaHead: PlatformSchemaHead;
}) =>
  client.begin(
    "isolation level repeatable read read only",
    async (transaction) => {
      const [snapshot] = await transaction<
        { snapshot_id: string }[]
      >`select pg_export_snapshot() as snapshot_id`;
      const recoverySnapshot = await readRecoverySnapshot(
        transaction as ReturnType<typeof postgres>,
        schemaHead,
      );
      executePostgresTool({
        command: "pg_dump",
        args: [
          "--format=custom",
          "--no-owner",
          "--no-privileges",
          `--snapshot=${snapshot.snapshot_id}`,
          "--file",
          dumpPath,
        ],
        databaseUrl,
        artifactPath: dumpPath,
        unsupportedPattern: /server version mismatch/u,
      });
      return recoverySnapshot;
    },
  );

export const restorePlatformDatabaseDump = ({
  databaseUrl,
  artifactPath,
}: {
  databaseUrl: string;
  artifactPath: string;
}) => {
  const connectionEnvironment = postgresConnectionEnvironment(databaseUrl);
  executePostgresTool({
    command: "pg_restore",
    args: [
      "--clean",
      "--if-exists",
      "--no-owner",
      "--no-privileges",
      "--single-transaction",
      "--exit-on-error",
      "--dbname",
      connectionEnvironment.PGDATABASE,
      artifactPath,
    ],
    databaseUrl,
    artifactPath,
    unsupportedPattern: /unsupported version/u,
  });
};

const LOCAL_DATABASE_HOSTS = new Set([
  "127.0.0.1",
  "::1",
  "host.docker.internal",
  "localhost",
  "postgres",
]);

const trimToUndefined = (value: unknown): string | undefined => {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
};

const normalizeHostname = (value: string): string =>
  value
    .trim()
    .replace(/^\[|\]$/g, "")
    .toLowerCase();

const isLocalDatabaseHostname = (hostname: string): boolean =>
  LOCAL_DATABASE_HOSTS.has(normalizeHostname(hostname));

const resolveNodeEnv = (env: ServerDatabasePolicyEnv): string =>
  trimToUndefined(env.NODE_ENV) ?? "development";

export interface ServerDatabasePolicyEnv extends Record<
  string,
  string | undefined
> {
  AIR_JAM_ALLOW_REMOTE_DATABASE?: string;
  DATABASE_URL?: string;
  NODE_ENV?: string;
}

export interface ResolvedServerRuntimeDatabaseUrl {
  databaseUrl?: string;
  remoteDatabaseBlocked: boolean;
}

export const REMOTE_DATABASE_BLOCKED_MESSAGE =
  "Non-local DATABASE_URL is blocked outside production unless AIR_JAM_ALLOW_REMOTE_DATABASE=enabled.";

export const isLocalDatabaseUrl = (databaseUrl: string): boolean => {
  try {
    const parsed = new URL(databaseUrl);
    if (!parsed.hostname) {
      return true;
    }

    return isLocalDatabaseHostname(parsed.hostname);
  } catch {
    return false;
  }
};

export const resolveServerRuntimeDatabaseUrl = (
  env: ServerDatabasePolicyEnv,
): ResolvedServerRuntimeDatabaseUrl => {
  const databaseUrl = trimToUndefined(env.DATABASE_URL);
  if (!databaseUrl) {
    return { remoteDatabaseBlocked: false };
  }

  const nodeEnv = resolveNodeEnv(env);
  const allowRemoteDatabase =
    nodeEnv === "production" ||
    trimToUndefined(env.AIR_JAM_ALLOW_REMOTE_DATABASE) === "enabled";

  if (allowRemoteDatabase || isLocalDatabaseUrl(databaseUrl)) {
    return {
      databaseUrl,
      remoteDatabaseBlocked: false,
    };
  }

  return {
    remoteDatabaseBlocked: true,
  };
};

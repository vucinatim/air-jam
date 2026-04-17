import { validateEnv } from "@air-jam/env";
import { z } from "zod";
import {
  REMOTE_DATABASE_BLOCKED_MESSAGE,
  resolveServerRuntimeDatabaseUrl,
} from "./database-url-policy.js";

export type AuthMode = "disabled" | "required";
export type ProxyHeaderTrustMode = "auto" | "enabled" | "disabled";

export interface ServerEnvConfig {
  nodeEnv: string;
  port: number;
  rateLimitWindowMs: number;
  hostRegistrationRateLimitMax: number;
  controllerJoinRateLimitMax: number;
  staticAppRateLimitMax: number;
  allowedOrigins: string[] | "*";
  devLogCollectorEnabled: boolean;
  devLogDir?: string;
  authMode: AuthMode;
  proxyHeaderTrustMode: ProxyHeaderTrustMode;
  remoteDatabaseBlocked: boolean;
  maintenanceMode: boolean;
  masterKey?: string;
  hostGrantSecret?: string;
  databaseUrl?: string;
  logLevel?: string;
}

const trimToUndefined = (value: unknown): string | undefined => {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
};

const createPositiveIntegerSchema = (envKey: string, fallback: number) =>
  z
    .preprocess(trimToUndefined, z.string().optional())
    .transform((value, context) => {
      if (!value) {
        return fallback;
      }

      const parsed = Number.parseInt(value, 10);
      if (!Number.isInteger(parsed) || parsed <= 0) {
        context.addIssue({
          code: "custom",
          message: `${envKey} must be a positive integer.`,
        });
        return z.NEVER;
      }

      return parsed;
    });

const normalizeAllowedOrigins = (
  rawAllowedOrigins: string | undefined,
): string[] | "*" => {
  if (!rawAllowedOrigins) {
    return "*";
  }

  const parsed = rawAllowedOrigins
    .split(",")
    .map((origin) => origin.trim().replace(/^['"]|['"]$/g, ""))
    .filter(Boolean);

  if (parsed.length === 0 || parsed.includes("*")) {
    return "*";
  }

  return parsed;
};

const resolveAuthMode = ({
  configuredAuthMode,
  nodeEnv,
}: {
  configuredAuthMode?: AuthMode;
  nodeEnv: string;
}): AuthMode => {
  if (configuredAuthMode) {
    return configuredAuthMode;
  }

  return nodeEnv === "production" ? "required" : "disabled";
};

const rawServerEnvSchema = z
  .object({
    NODE_ENV: z.preprocess(trimToUndefined, z.string().optional()),
    PORT: createPositiveIntegerSchema("PORT", 4000),
    AIR_JAM_RATE_LIMIT_WINDOW_MS: createPositiveIntegerSchema(
      "AIR_JAM_RATE_LIMIT_WINDOW_MS",
      60_000,
    ),
    AIR_JAM_HOST_REGISTRATION_RATE_LIMIT_MAX: createPositiveIntegerSchema(
      "AIR_JAM_HOST_REGISTRATION_RATE_LIMIT_MAX",
      30,
    ),
    AIR_JAM_CONTROLLER_JOIN_RATE_LIMIT_MAX: createPositiveIntegerSchema(
      "AIR_JAM_CONTROLLER_JOIN_RATE_LIMIT_MAX",
      120,
    ),
    AIR_JAM_STATIC_APP_RATE_LIMIT_MAX: createPositiveIntegerSchema(
      "AIR_JAM_STATIC_APP_RATE_LIMIT_MAX",
      120,
    ),
    AIR_JAM_ALLOWED_ORIGINS: z.preprocess(trimToUndefined, z.string().optional()),
    AIR_JAM_DEV_LOG_COLLECTOR: z
      .preprocess(trimToUndefined, z.enum(["enabled", "disabled"]).optional()),
    AIR_JAM_DEV_LOG_DIR: z.preprocess(trimToUndefined, z.string().optional()),
    AIR_JAM_AUTH_MODE: z
      .preprocess(trimToUndefined, z.enum(["disabled", "required"]).optional()),
    AIR_JAM_TRUST_PROXY_HEADERS: z.preprocess(
      trimToUndefined,
      z.enum(["auto", "enabled", "disabled"]).optional(),
    ),
    AIR_JAM_ALLOW_REMOTE_DATABASE: z.preprocess(
      trimToUndefined,
      z.enum(["enabled", "disabled"]).optional(),
    ),
    AIR_JAM_MASTER_KEY: z.preprocess(trimToUndefined, z.string().optional()),
    AIR_JAM_HOST_GRANT_SECRET: z.preprocess(trimToUndefined, z.string().optional()),
    DATABASE_URL: z.preprocess(trimToUndefined, z.string().optional()),
    AIR_JAM_LOG_LEVEL: z.preprocess(trimToUndefined, z.string().optional()),
    AIR_JAM_MAINTENANCE_MODE: z.preprocess(
      trimToUndefined,
      z.enum(["enabled", "disabled"]).optional(),
    ),
  })
  .superRefine((value, context) => {
    const nodeEnv = value.NODE_ENV ?? "development";
    const authMode = resolveAuthMode({
      configuredAuthMode: value.AIR_JAM_AUTH_MODE,
      nodeEnv,
    });
    const databasePolicy = resolveServerRuntimeDatabaseUrl({
      NODE_ENV: nodeEnv,
      DATABASE_URL: value.DATABASE_URL,
      AIR_JAM_ALLOW_REMOTE_DATABASE: value.AIR_JAM_ALLOW_REMOTE_DATABASE,
    });

    if (
      authMode === "required" &&
      !value.AIR_JAM_MASTER_KEY &&
      !databasePolicy.databaseUrl &&
      !value.AIR_JAM_HOST_GRANT_SECRET
    ) {
      context.addIssue({
        code: "custom",
        path: databasePolicy.remoteDatabaseBlocked
          ? ["DATABASE_URL"]
          : ["AIR_JAM_AUTH_MODE"],
        message: databasePolicy.remoteDatabaseBlocked
          ? [
              REMOTE_DATABASE_BLOCKED_MESSAGE,
              "Required auth cannot rely on that blocked database URL without AIR_JAM_ALLOW_REMOTE_DATABASE=enabled.",
            ].join(" ")
          : "AIR_JAM_AUTH_MODE=required requires at least one auth backend: AIR_JAM_MASTER_KEY, DATABASE_URL, or AIR_JAM_HOST_GRANT_SECRET.",
      });
    }
  });

export const loadServerEnv = (
  env: Record<string, string | undefined> = process.env,
): ServerEnvConfig => {
  const parsed = validateEnv({
    boundary: "air-jam-server",
    schema: rawServerEnvSchema,
    env,
    docsHint:
      "Set AIR_JAM_* values in .env.local (repo root) or packages/server/.env and retry.",
    keyHints: {
      AIR_JAM_AUTH_MODE:
        "Choose disabled/required. If required, configure AIR_JAM_MASTER_KEY, DATABASE_URL, or AIR_JAM_HOST_GRANT_SECRET.",
      AIR_JAM_ALLOW_REMOTE_DATABASE:
        "Choose enabled only when local or test server workflows intentionally need a non-local DATABASE_URL.",
      AIR_JAM_TRUST_PROXY_HEADERS:
        "Choose auto/enabled/disabled. Use auto to trust proxy headers only when the socket peer looks like a local/private proxy hop.",
      AIR_JAM_ALLOWED_ORIGINS:
        "Use a comma-separated list of origins, or '*' to allow all origins.",
      PORT: "Set a positive integer port (for example: PORT=4000).",
    },
  });

  const nodeEnv = parsed.NODE_ENV ?? "development";
  const authMode = resolveAuthMode({
    configuredAuthMode: parsed.AIR_JAM_AUTH_MODE,
    nodeEnv,
  });
  const databasePolicy = resolveServerRuntimeDatabaseUrl({
    NODE_ENV: nodeEnv,
    DATABASE_URL: parsed.DATABASE_URL,
    AIR_JAM_ALLOW_REMOTE_DATABASE: parsed.AIR_JAM_ALLOW_REMOTE_DATABASE,
  });

  return {
    nodeEnv,
    port: parsed.PORT,
    rateLimitWindowMs: parsed.AIR_JAM_RATE_LIMIT_WINDOW_MS,
    hostRegistrationRateLimitMax:
      parsed.AIR_JAM_HOST_REGISTRATION_RATE_LIMIT_MAX,
    controllerJoinRateLimitMax: parsed.AIR_JAM_CONTROLLER_JOIN_RATE_LIMIT_MAX,
    staticAppRateLimitMax: parsed.AIR_JAM_STATIC_APP_RATE_LIMIT_MAX,
    allowedOrigins: normalizeAllowedOrigins(parsed.AIR_JAM_ALLOWED_ORIGINS),
    devLogCollectorEnabled: parsed.AIR_JAM_DEV_LOG_COLLECTOR
      ? parsed.AIR_JAM_DEV_LOG_COLLECTOR === "enabled"
      : nodeEnv !== "production",
    devLogDir: parsed.AIR_JAM_DEV_LOG_DIR,
    authMode,
    proxyHeaderTrustMode: parsed.AIR_JAM_TRUST_PROXY_HEADERS ?? "auto",
    remoteDatabaseBlocked: databasePolicy.remoteDatabaseBlocked,
    masterKey: parsed.AIR_JAM_MASTER_KEY,
    hostGrantSecret: parsed.AIR_JAM_HOST_GRANT_SECRET,
    databaseUrl: databasePolicy.databaseUrl,
    logLevel: parsed.AIR_JAM_LOG_LEVEL,
    maintenanceMode: parsed.AIR_JAM_MAINTENANCE_MODE === "enabled",
  };
};

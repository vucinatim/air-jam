import { validateEnv } from "@air-jam/env";
import { z } from "zod";

export type AuthMode = "disabled" | "required";
export type ProxyHeaderTrustMode = "auto" | "enabled" | "disabled";

const trimToUndefined = (value: unknown): string | undefined => {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
};

const optionalEnvString = z
  .string()
  .optional()
  .transform((value) => trimToUndefined(value));

const createOptionalEnumSchema = <
  const TValues extends readonly [string, ...string[]],
>(
  envKey: string,
  values: TValues,
) =>
  optionalEnvString.transform((value, context) => {
    if (!value) {
      return undefined;
    }

    if (!values.includes(value)) {
      context.addIssue({
        code: "custom",
        message: `${envKey} must be one of: ${values.join(", ")}.`,
      });
      return z.NEVER;
    }

    return value as TValues[number];
  });

const createPositiveIntegerSchema = (envKey: string, fallback: number) =>
  optionalEnvString.transform((value, context) => {
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

const rawServerEnvSchema = z.object({
  NODE_ENV: optionalEnvString,
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
  AIR_JAM_RUNTIME_ERROR_REPORT_RATE_LIMIT_MAX: createPositiveIntegerSchema(
    "AIR_JAM_RUNTIME_ERROR_REPORT_RATE_LIMIT_MAX",
    30,
  ),
  AIR_JAM_ALLOWED_ORIGINS: optionalEnvString,
  AIR_JAM_DEV_LOG_COLLECTOR: createOptionalEnumSchema(
    "AIR_JAM_DEV_LOG_COLLECTOR",
    ["enabled", "disabled"],
  ),
  AIR_JAM_DEV_LOG_DIR: optionalEnvString,
  AIR_JAM_AUTH_MODE: createOptionalEnumSchema("AIR_JAM_AUTH_MODE", [
    "disabled",
    "required",
  ]),
  AIR_JAM_TRUST_PROXY_HEADERS: createOptionalEnumSchema(
    "AIR_JAM_TRUST_PROXY_HEADERS",
    ["auto", "enabled", "disabled"],
  ),
  AIR_JAM_MASTER_KEY: optionalEnvString,
  AIR_JAM_LOG_LEVEL: optionalEnvString,
  AIR_JAM_MAINTENANCE_MODE: createOptionalEnumSchema(
    "AIR_JAM_MAINTENANCE_MODE",
    ["enabled", "disabled"],
  ),
});

export const loadServerEnv = (
  env: Record<string, string | undefined> = process.env,
) => {
  const parsed = validateEnv({
    boundary: "air-jam-server",
    schema: rawServerEnvSchema,
    env,
    docsHint:
      "Set AIR_JAM_* values in .env.local or packages/server/.env and retry.",
  });
  const nodeEnv = parsed.NODE_ENV ?? "development";
  const authMode: AuthMode =
    parsed.AIR_JAM_AUTH_MODE ??
    (nodeEnv === "production" ? "required" : "disabled");
  const proxyHeaderTrustMode: ProxyHeaderTrustMode =
    parsed.AIR_JAM_TRUST_PROXY_HEADERS ?? "auto";
  return {
    nodeEnv,
    port: parsed.PORT,
    rateLimitWindowMs: parsed.AIR_JAM_RATE_LIMIT_WINDOW_MS,
    hostRegistrationRateLimitMax:
      parsed.AIR_JAM_HOST_REGISTRATION_RATE_LIMIT_MAX,
    controllerJoinRateLimitMax: parsed.AIR_JAM_CONTROLLER_JOIN_RATE_LIMIT_MAX,
    staticAppRateLimitMax: parsed.AIR_JAM_STATIC_APP_RATE_LIMIT_MAX,
    runtimeErrorReportRateLimitMax:
      parsed.AIR_JAM_RUNTIME_ERROR_REPORT_RATE_LIMIT_MAX,
    allowedOrigins: normalizeAllowedOrigins(parsed.AIR_JAM_ALLOWED_ORIGINS),
    devLogCollectorEnabled: parsed.AIR_JAM_DEV_LOG_COLLECTOR
      ? parsed.AIR_JAM_DEV_LOG_COLLECTOR === "enabled"
      : nodeEnv !== "production",
    devLogDir: parsed.AIR_JAM_DEV_LOG_DIR,
    authMode,
    proxyHeaderTrustMode,
    masterKey: nodeEnv === "production" ? undefined : parsed.AIR_JAM_MASTER_KEY,
    logLevel: parsed.AIR_JAM_LOG_LEVEL,
    maintenanceMode: parsed.AIR_JAM_MAINTENANCE_MODE === "enabled",
  };
};

export type ServerEnvConfig = ReturnType<typeof loadServerEnv>;

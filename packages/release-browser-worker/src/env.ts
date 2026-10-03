import { isEnvValidationError, validateEnv } from "@air-jam/env";
import { z } from "zod";

const trimToUndefined = (value: unknown): string | undefined => {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
};

const optionalEnvValue = z.preprocess(trimToUndefined, z.string().optional());

const booleanFromEnv = (envKey: string, fallback: boolean) =>
  optionalEnvValue.transform((value, context) => {
    if (!value) {
      return fallback;
    }

    if (value === "true") {
      return true;
    }

    if (value === "false") {
      return false;
    }

    context.addIssue({
      code: "custom",
      message: `${envKey} must be either 'true' or 'false'.`,
    });
    return z.NEVER;
  });

const workerEnvSchema = z
  .object({
    PORT: optionalEnvValue,
    AIRJAM_BROWSER_WORKER_PORT: optionalEnvValue,
    AIRJAM_BROWSER_WORKER_HOST: optionalEnvValue.transform(
      (value) => value ?? "0.0.0.0",
    ),
    AIRJAM_BROWSER_WORKER_HEADLESS: booleanFromEnv(
      "AIRJAM_BROWSER_WORKER_HEADLESS",
      true,
    ),
    AIRJAM_BROWSER_WORKER_CHROMIUM_SANDBOX: booleanFromEnv(
      "AIRJAM_BROWSER_WORKER_CHROMIUM_SANDBOX",
      true,
    ).refine(
      (enabled) => enabled,
      "Chromium sandboxing is required; disabling it is not supported.",
    ),
    AIRJAM_BROWSER_WORKER_EXECUTABLE_PATH: optionalEnvValue,
    AIRJAM_BROWSER_WORKER_ACCESS_TOKEN: z
      .string()
      .min(32)
      .max(512)
      .regex(
        /^[\x21-\x7e]+$/,
        "Access token must contain printable ASCII without whitespace.",
      ),
  })
  .superRefine((value, context) => {
    const portSource = value.PORT ?? value.AIRJAM_BROWSER_WORKER_PORT;
    if (!portSource) {
      return;
    }

    const parsed = Number(portSource);
    if (
      !/^\d+$/.test(portSource) ||
      !Number.isInteger(parsed) ||
      parsed < 1 ||
      parsed > 65535
    ) {
      context.addIssue({
        code: "custom",
        path: value.PORT ? ["PORT"] : ["AIRJAM_BROWSER_WORKER_PORT"],
        message: "Port must be a whole integer from 1 through 65535.",
      });
    }
  })
  .transform((value) => {
    const portSource = value.PORT ?? value.AIRJAM_BROWSER_WORKER_PORT;
    const parsedPort = portSource ? Number(portSource) : 8080;

    return {
      host: value.AIRJAM_BROWSER_WORKER_HOST,
      port: parsedPort,
      headless: value.AIRJAM_BROWSER_WORKER_HEADLESS,
      chromiumSandbox: value.AIRJAM_BROWSER_WORKER_CHROMIUM_SANDBOX,
      executablePath: value.AIRJAM_BROWSER_WORKER_EXECUTABLE_PATH ?? null,
      accessToken: value.AIRJAM_BROWSER_WORKER_ACCESS_TOKEN,
    };
  });

export type BrowserWorkerEnv = z.output<typeof workerEnvSchema>;

export const loadBrowserWorkerEnv = (
  env: Record<string, string | undefined> = process.env,
): BrowserWorkerEnv => {
  try {
    return validateEnv({
      boundary: "release-browser-worker",
      schema: workerEnvSchema,
      env,
      docsHint:
        "Set AIRJAM_BROWSER_WORKER_* variables for the dedicated release browser worker.",
      keyHints: {
        PORT: "Railway typically injects PORT automatically.",
        AIRJAM_BROWSER_WORKER_PORT:
          "Use a whole integer port from 1 through 65535 when running outside managed hosts.",
        AIRJAM_BROWSER_WORKER_HEADLESS:
          "Set to 'true' or 'false'. Production should normally stay headless.",
        AIRJAM_BROWSER_WORKER_CHROMIUM_SANDBOX:
          "Defaults to 'true'. The runtime must support Chromium sandboxing; 'false' is rejected.",
        AIRJAM_BROWSER_WORKER_ACCESS_TOKEN:
          "Required in every environment: use a randomly generated secret of 32–512 printable ASCII characters without whitespace.",
      },
    });
  } catch (error) {
    if (isEnvValidationError(error)) {
      for (const issue of error.issues) {
        if (
          issue.envKey === "AIRJAM_BROWSER_WORKER_ACCESS_TOKEN" &&
          issue.received !== undefined
        )
          issue.received = "[redacted]";
      }
    }
    throw error;
  }
};

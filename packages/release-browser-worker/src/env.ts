import { validateEnv } from "@air-jam/env";
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
      false,
    ),
    AIRJAM_BROWSER_WORKER_EXECUTABLE_PATH: optionalEnvValue,
  })
  .superRefine((value, context) => {
    const portSource = value.PORT ?? value.AIRJAM_BROWSER_WORKER_PORT;
    if (!portSource) {
      return;
    }

    const parsed = Number.parseInt(portSource, 10);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      context.addIssue({
        code: "custom",
        path: value.PORT ? ["PORT"] : ["AIRJAM_BROWSER_WORKER_PORT"],
        message: "Port must be a positive integer.",
      });
    }
  })
  .transform((value) => {
    const portSource = value.PORT ?? value.AIRJAM_BROWSER_WORKER_PORT;
    const parsedPort = portSource ? Number.parseInt(portSource, 10) : 8080;

    return {
      host: value.AIRJAM_BROWSER_WORKER_HOST,
      port: parsedPort,
      headless: value.AIRJAM_BROWSER_WORKER_HEADLESS,
      chromiumSandbox: value.AIRJAM_BROWSER_WORKER_CHROMIUM_SANDBOX,
      executablePath: value.AIRJAM_BROWSER_WORKER_EXECUTABLE_PATH ?? null,
    };
  });

export type BrowserWorkerEnv = z.output<typeof workerEnvSchema>;

export const loadBrowserWorkerEnv = (
  env: Record<string, string | undefined> = process.env,
): BrowserWorkerEnv =>
  validateEnv({
    boundary: "release-browser-worker",
    schema: workerEnvSchema,
    env,
    docsHint:
      "Set AIRJAM_BROWSER_WORKER_* variables for the dedicated release browser worker.",
    keyHints: {
      PORT: "Railway typically injects PORT automatically.",
      AIRJAM_BROWSER_WORKER_PORT:
        "Use a positive integer port when running outside managed hosts.",
      AIRJAM_BROWSER_WORKER_HEADLESS:
        "Set to 'true' or 'false'. Production should normally stay headless.",
      AIRJAM_BROWSER_WORKER_CHROMIUM_SANDBOX:
        "Set to 'true' only when the target runtime supports Chromium sandboxing cleanly.",
    },
  });

import {
  type PlatformMachineErrorCode,
  platformMachineApiErrorSchema,
  platformMachineDevicePollResultSchema,
  platformMachineDeviceStartResultSchema,
  platformMachineLogoutResultSchema,
  platformMachineMeResultSchema,
} from "@air-jam/sdk/platform-machine";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { z } from "zod";
import type {
  AirJamPlatformMachineSessionStore,
  GetPlatformMachineProfileOptions,
  LoginPlatformWithDeviceFlowOptions,
  LogoutPlatformMachineSessionOptions,
  PollPlatformDeviceAuthorizationOptions,
  StartPlatformDeviceAuthorizationOptions,
} from "./types.js";

const PLATFORM_AUTH_DIR = path.join(os.homedir(), ".airjam", "auth");
const PLATFORM_AUTH_FILE = path.join(
  PLATFORM_AUTH_DIR,
  "platform-session.json",
);
const LOCAL_PLATFORM_FALLBACK = "http://localhost:3000";

const storedPlatformSessionSchema = z.object({
  version: z.literal(1),
  platformBaseUrl: z.string().url(),
  clientName: z.string().nullable(),
  storedAt: z.string().min(1),
  user: z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    email: z.string().email(),
    role: z.enum(["creator", "ops_admin"]),
  }),
  session: z.object({
    id: z.string().min(1),
    token: z.string().min(1),
    expiresAt: z.string().min(1),
    createdAt: z.string().min(1),
    userAgent: z.string().min(1),
  }),
});

export class AirJamPlatformApiError extends Error {
  readonly code: PlatformMachineErrorCode;
  readonly status: number;

  constructor({
    code,
    message,
    status,
  }: {
    code: PlatformMachineErrorCode;
    message: string;
    status: number;
  }) {
    super(message);
    this.name = "AirJamPlatformApiError";
    this.code = code;
    this.status = status;
  }
}

const normalizeUrl = (rawUrl: string): string => {
  const trimmed = rawUrl.trim();
  if (!trimmed) {
    return LOCAL_PLATFORM_FALLBACK;
  }

  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }

  return `https://${trimmed}`;
};

export const resolvePlatformBaseUrl = (
  value: string | undefined = process.env.AIRJAM_PLATFORM_URL,
): string => {
  const candidate =
    value ||
    process.env.AIR_JAM_PLATFORM_URL ||
    process.env.NEXT_PUBLIC_AIR_JAM_PUBLIC_HOST ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.VERCEL_URL ||
    LOCAL_PLATFORM_FALLBACK;

  try {
    return new URL(normalizeUrl(candidate)).toString().replace(/\/$/, "");
  } catch {
    return LOCAL_PLATFORM_FALLBACK;
  }
};

const sleep = async (durationMs: number) =>
  new Promise((resolve) => setTimeout(resolve, durationMs));

export const requestPlatformMachineApi = async <T>({
  baseUrl,
  pathname,
  method = "GET",
  body,
  token,
  schema,
}: {
  baseUrl: string;
  pathname: string;
  method?: "GET" | "POST";
  body?: unknown;
  token?: string;
  schema: { parse: (value: unknown) => T };
}): Promise<T> => {
  const response = await fetch(new URL(pathname, baseUrl), {
    method,
    headers: {
      ...(body === undefined ? {} : { "content-type": "application/json" }),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const payload = (await response.json().catch(() => null)) as unknown;

  if (!response.ok) {
    const parsedError = platformMachineApiErrorSchema.safeParse(payload);
    if (parsedError.success) {
      throw new AirJamPlatformApiError({
        code: parsedError.data.error,
        message: parsedError.data.message,
        status: response.status,
      });
    }

    throw new AirJamPlatformApiError({
      code: "invalid_request",
      message: `Platform machine API request failed: ${response.status}`,
      status: response.status,
    });
  }

  return schema.parse(payload);
};

export const readStoredPlatformMachineSession =
  async (): Promise<AirJamPlatformMachineSessionStore | null> => {
    try {
      return storedPlatformSessionSchema.parse(
        JSON.parse(await readFile(PLATFORM_AUTH_FILE, "utf8")) as unknown,
      );
    } catch (error) {
      if ((error as NodeJS.ErrnoException)?.code === "ENOENT") {
        return null;
      }

      throw error;
    }
  };

export const writeStoredPlatformMachineSession = async (
  value: AirJamPlatformMachineSessionStore,
): Promise<void> => {
  await mkdir(PLATFORM_AUTH_DIR, { recursive: true });
  await writeFile(
    PLATFORM_AUTH_FILE,
    `${JSON.stringify(storedPlatformSessionSchema.parse(value), null, 2)}\n`,
    "utf8",
  );
};

export const clearStoredPlatformMachineSession = async (): Promise<void> => {
  await rm(PLATFORM_AUTH_FILE, { force: true });
};

export const startPlatformDeviceAuthorization = async ({
  platformUrl,
  clientName,
}: StartPlatformDeviceAuthorizationOptions = {}) =>
  requestPlatformMachineApi({
    baseUrl: resolvePlatformBaseUrl(platformUrl),
    pathname: "/api/cli/auth/device/start",
    method: "POST",
    body: {
      ...(clientName?.trim() ? { clientName: clientName.trim() } : {}),
    },
    schema: platformMachineDeviceStartResultSchema,
  });

export const pollPlatformDeviceAuthorization = async ({
  platformUrl,
  deviceCode,
}: PollPlatformDeviceAuthorizationOptions) =>
  requestPlatformMachineApi({
    baseUrl: resolvePlatformBaseUrl(platformUrl),
    pathname: "/api/cli/auth/device/poll",
    method: "POST",
    body: {
      deviceCode,
    },
    schema: platformMachineDevicePollResultSchema,
  });

export const loginPlatformWithDeviceFlow = async ({
  platformUrl,
  clientName,
  onPrompt,
}: LoginPlatformWithDeviceFlowOptions = {}) => {
  const baseUrl = resolvePlatformBaseUrl(platformUrl);
  const authorization = await startPlatformDeviceAuthorization({
    platformUrl: baseUrl,
    clientName,
  });

  await onPrompt?.(authorization);

  const expiresAtMs = Date.parse(authorization.expiresAt);
  while (Date.now() < expiresAtMs) {
    await sleep(authorization.intervalSeconds * 1000);

    try {
      const authenticated = await pollPlatformDeviceAuthorization({
        platformUrl: baseUrl,
        deviceCode: authorization.deviceCode,
      });

      const storedSession: AirJamPlatformMachineSessionStore = {
        version: 1,
        platformBaseUrl: authenticated.platformBaseUrl,
        clientName: clientName?.trim() || null,
        storedAt: new Date().toISOString(),
        user: authenticated.user,
        session: authenticated.session,
      };

      await writeStoredPlatformMachineSession(storedSession);

      return {
        authorization,
        authenticated,
        storedSession,
      };
    } catch (error) {
      if (
        error instanceof AirJamPlatformApiError &&
        error.code === "authorization_pending"
      ) {
        continue;
      }

      throw error;
    }
  }

  throw new AirJamPlatformApiError({
    code: "expired_token",
    message: "The Air Jam CLI login expired before it was approved.",
    status: 410,
  });
};

export const resolvePlatformMachineAuth = async ({
  platformUrl,
  token,
}: {
  platformUrl?: string;
  token?: string;
}) => {
  if (token?.trim()) {
    return {
      baseUrl: resolvePlatformBaseUrl(platformUrl),
      token: token.trim(),
    };
  }

  const stored = await readStoredPlatformMachineSession();
  if (!stored) {
    throw new Error("No stored Air Jam platform session was found.");
  }

  return {
    baseUrl: resolvePlatformBaseUrl(platformUrl || stored.platformBaseUrl),
    token: stored.session.token,
  };
};

export const getPlatformMachineProfile = async ({
  platformUrl,
  token,
}: GetPlatformMachineProfileOptions = {}) => {
  const resolved = await resolvePlatformMachineAuth({ platformUrl, token });
  return requestPlatformMachineApi({
    baseUrl: resolved.baseUrl,
    pathname: "/api/cli/auth/me",
    token: resolved.token,
    schema: platformMachineMeResultSchema,
  });
};

export const logoutPlatformMachineSession = async ({
  platformUrl,
  token,
}: LogoutPlatformMachineSessionOptions = {}) => {
  const resolved = await resolvePlatformMachineAuth({ platformUrl, token });
  const result = await requestPlatformMachineApi({
    baseUrl: resolved.baseUrl,
    pathname: "/api/cli/auth/logout",
    method: "POST",
    token: resolved.token,
    schema: platformMachineLogoutResultSchema,
  });
  await clearStoredPlatformMachineSession();
  return result;
};

export const getPlatformAuthStoragePath = () => PLATFORM_AUTH_FILE;

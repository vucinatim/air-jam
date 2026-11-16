import {
  type PlatformMachineErrorCode,
  platformMachineApiErrorSchema,
  platformMachineDevicePollResultSchema,
  platformMachineDeviceStartResultSchema,
  platformMachineLogoutResultSchema,
  platformMachineMeResultSchema,
  platformMachineProfileInputSchema,
  platformMachineRevokeSessionInputSchema,
  platformMachineSessionSchema,
  platformMachineSessionsResultSchema,
  platformMachineUserSchema,
} from "@air-jam/sdk/platform-machine";
import { randomUUID } from "node:crypto";
import {
  chmod,
  mkdir,
  readFile,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import { isIP } from "node:net";
import os from "node:os";
import path from "node:path";
import lockfile from "proper-lockfile";
import { z } from "zod";
import type {
  AirJamPlatformAuthStatus,
  AirJamPlatformMachineSessionStore,
  GetPlatformMachineProfileOptions,
  LoginPlatformWithDeviceFlowOptions,
  LogoutPlatformMachineSessionOptions,
  PollPlatformDeviceAuthorizationOptions,
  StartPlatformDeviceAuthorizationOptions,
} from "./types.js";

export type {
  AirJamPlatformAuthStatus,
  AirJamPlatformMachineSessionStore,
  GetPlatformMachineProfileOptions,
  LoginPlatformWithDeviceFlowOptions,
  LogoutPlatformMachineSessionOptions,
  PollPlatformDeviceAuthorizationOptions,
  StartPlatformDeviceAuthorizationOptions,
} from "./types.js";

const LOCAL_PLATFORM_FALLBACK = "http://localhost:3000";

export const resolveAirJamStateDirectory = (): string => {
  const configured = process.env.AIRJAM_STATE_DIR?.trim();
  if (!configured) return path.join(os.homedir(), ".airjam");
  if (!path.isAbsolute(configured)) {
    throw new Error("AIRJAM_STATE_DIR must be an absolute path.");
  }
  return path.normalize(configured);
};

const resolvePlatformAuthDirectory = () =>
  path.join(resolveAirJamStateDirectory(), "auth");

const resolvePlatformAuthFile = () =>
  path.join(resolvePlatformAuthDirectory(), "platform-session.json");

const storedPlatformSessionFields = z.object({
  platformBaseUrl: z.string().url(),
  clientName: z.string().nullable(),
  storedAt: z.string().min(1),
  user: platformMachineUserSchema,
});

export const storedPlatformSessionSchema = storedPlatformSessionFields.extend({
  version: z.literal(2),
  session: platformMachineSessionSchema,
});

// Read the former credential only to exchange it through the refresh endpoint.
const legacyStoredPlatformSessionSchema = storedPlatformSessionFields.extend({
  version: z.literal(1),
  session: platformMachineSessionSchema.omit({
    refreshToken: true,
    refreshExpiresAt: true,
  }),
});

const readableStoredPlatformSessionSchema = z.discriminatedUnion("version", [
  storedPlatformSessionSchema,
  legacyStoredPlatformSessionSchema,
]);

const withPlatformSessionLock = async <T>(
  operation: () => Promise<T>,
): Promise<T> => {
  await mkdir(resolvePlatformAuthDirectory(), { recursive: true, mode: 0o700 });
  const release = await lockfile.lock(resolvePlatformAuthFile(), {
    realpath: false,
    retries: { retries: 10, minTimeout: 50, maxTimeout: 1000 },
  });
  try {
    return await operation();
  } finally {
    await release();
  }
};

export class AirJamPlatformApiError extends Error {
  readonly code: PlatformMachineErrorCode;
  readonly status: number;
  readonly details: Record<string, unknown> | undefined;
  readonly retryAfterSeconds: number | null;

  constructor({
    code,
    message,
    status,
    details,
    retryAfterSeconds = null,
  }: {
    code: PlatformMachineErrorCode;
    message: string;
    status: number;
    details?: Record<string, unknown>;
    retryAfterSeconds?: number | null;
  }) {
    super(message);
    this.name = "AirJamPlatformApiError";
    this.code = code;
    this.status = status;
    this.details = details;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export class AirJamStoredPlatformSessionError extends Error {
  readonly storagePath: string;

  constructor(storagePath: string, cause: unknown) {
    super(`The stored Air Jam platform session is unreadable: ${storagePath}`, {
      cause,
    });
    this.name = "AirJamStoredPlatformSessionError";
    this.storagePath = storagePath;
  }
}

const parsePlatformUrl = (rawUrl: string): URL => {
  const trimmed = rawUrl.trim();
  let url: URL;
  try {
    if (!trimmed) throw new Error("Empty URL");
    const hasScheme = /^[a-z][a-z\d+.-]*:/iu.test(trimmed);
    const hasHostPort = /^[^/?#]+:\d+(?:[/?#]|$)/u.test(trimmed);
    if (
      hasScheme &&
      !hasHostPort &&
      !/^[a-z][a-z\d+.-]*:\/\//iu.test(trimmed)
    ) {
      throw new Error("Invalid URL scheme");
    }
    url = new URL(hasScheme && !hasHostPort ? trimmed : `https://${trimmed}`);
  } catch {
    throw new Error("Invalid Air Jam platform URL.");
  }

  const loopback =
    url.hostname === "localhost" ||
    url.hostname === "[::1]" ||
    (isIP(url.hostname) === 4 && url.hostname.startsWith("127."));
  if (
    (url.protocol !== "https:" && !(url.protocol === "http:" && loopback)) ||
    url.username ||
    url.password
  ) {
    throw new Error(
      "Air Jam platform URLs require HTTPS, except HTTP on loopback, and must not contain credentials.",
    );
  }
  return url;
};

export const resolvePlatformBaseUrl = (
  value: string | undefined = process.env.AIRJAM_PLATFORM_URL,
): string => {
  const candidate =
    value ??
    process.env.AIR_JAM_PLATFORM_URL ??
    process.env.NEXT_PUBLIC_AIR_JAM_PUBLIC_HOST ??
    process.env.NEXT_PUBLIC_APP_URL ??
    LOCAL_PLATFORM_FALLBACK;

  return parsePlatformUrl(candidate).toString().replace(/\/$/, "");
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
  method?: "GET" | "POST" | "PATCH";
  body?: unknown;
  token?: string;
  schema: { parse: (value: unknown) => T };
}): Promise<T> => {
  const platformUrl = parsePlatformUrl(baseUrl);
  const requestUrl = new URL(pathname, platformUrl);
  if (
    requestUrl.origin !== platformUrl.origin ||
    requestUrl.username ||
    requestUrl.password
  ) {
    throw new Error(
      "Platform agent API requests must stay on the platform origin.",
    );
  }
  const response = await fetch(requestUrl, {
    method,
    // Redirects can replay device codes or credentials, even on the same origin.
    redirect: "error",
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
        message:
          parsedError.data.error === "invalid_token"
            ? `${parsedError.data.message} Run airjam auth login to sign in again.`
            : parsedError.data.message,
        status: response.status,
        details: parsedError.data.details,
        retryAfterSeconds: parsedError.data.retryAfterSeconds,
      });
    }

    throw new AirJamPlatformApiError({
      code: "invalid_request",
      message: `Platform agent API request failed: ${response.status}`,
      status: response.status,
    });
  }

  return schema.parse(payload);
};

export const readStoredPlatformMachineSession = async () => {
  const storagePath = resolvePlatformAuthFile();
  let source: string;
  try {
    source = await readFile(storagePath, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code === "ENOENT") {
      return null;
    }
    throw error;
  }

  try {
    return readableStoredPlatformSessionSchema.parse(
      JSON.parse(source) as unknown,
    );
  } catch (error) {
    throw new AirJamStoredPlatformSessionError(storagePath, error);
  }
};

export const writeStoredPlatformMachineSession = async (
  value: AirJamPlatformMachineSessionStore,
): Promise<void> => {
  const authDirectory = resolvePlatformAuthDirectory();
  const storagePath = resolvePlatformAuthFile();
  const temporaryPath = `${storagePath}.tmp-${process.pid}-${randomUUID()}`;
  await mkdir(authDirectory, { recursive: true, mode: 0o700 });
  await chmod(authDirectory, 0o700);
  try {
    await writeFile(
      temporaryPath,
      `${JSON.stringify(storedPlatformSessionSchema.parse(value), null, 2)}\n`,
      { encoding: "utf8", flag: "wx", mode: 0o600 },
    );
    await rename(temporaryPath, storagePath);
    await chmod(storagePath, 0o600);
  } finally {
    await rm(temporaryPath, { force: true });
  }
};

export const clearStoredPlatformMachineSession = async (): Promise<void> => {
  await rm(resolvePlatformAuthFile(), { force: true });
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
  let intervalSeconds = authorization.intervalSeconds;
  while (Date.now() < expiresAtMs) {
    await sleep(intervalSeconds * 1000);
    if (Date.now() >= expiresAtMs) break;

    try {
      const authenticated = await pollPlatformDeviceAuthorization({
        platformUrl: baseUrl,
        deviceCode: authorization.deviceCode,
      });

      if (
        parsePlatformUrl(authenticated.platformBaseUrl).origin !==
        parsePlatformUrl(baseUrl).origin
      ) {
        throw new Error(
          "The login response does not match the requested platform origin.",
        );
      }
      const storedSession: AirJamPlatformMachineSessionStore = {
        version: 2,
        platformBaseUrl: baseUrl,
        clientName: clientName?.trim() || null,
        storedAt: new Date().toISOString(),
        user: authenticated.user,
        session: authenticated.session,
      };

      await withPlatformSessionLock(() =>
        writeStoredPlatformMachineSession(storedSession),
      );

      return {
        authorization,
        authenticated,
        storedSession,
      };
    } catch (error) {
      if (error instanceof AirJamPlatformApiError) {
        if (error.code === "slow_down") {
          intervalSeconds += 5;
          continue;
        }
        if (error.code === "authorization_pending") continue;
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

const resolvePlatformMachineAuthUnlocked = async ({
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

  let stored = await readStoredPlatformMachineSession();
  if (!stored) {
    throw new Error(
      "No stored Air Jam platform session was found. Run airjam auth login to sign in.",
    );
  }
  const baseUrl = resolvePlatformBaseUrl(platformUrl ?? stored.platformBaseUrl);
  if (
    parsePlatformUrl(baseUrl).origin !==
    parsePlatformUrl(stored.platformBaseUrl).origin
  ) {
    throw new Error(
      "The stored Air Jam session belongs to a different platform origin. Log in to that platform or supply an explicit token.",
    );
  }
  if (
    stored.version === 1 ||
    Date.parse(stored.session.expiresAt) <= Date.now() + 30_000
  ) {
    const authenticated = await requestPlatformMachineApi({
      baseUrl,
      pathname: "/api/cli/auth/refresh",
      method: "POST",
      body: {
        refreshToken:
          stored.version === 1
            ? stored.session.token
            : stored.session.refreshToken,
      },
      schema: platformMachineDevicePollResultSchema,
    });
    if (
      parsePlatformUrl(authenticated.platformBaseUrl).origin !==
      parsePlatformUrl(baseUrl).origin
    ) {
      throw new Error(
        "The refresh response does not match the requested platform origin.",
      );
    }
    stored = {
      ...stored,
      version: 2,
      user: authenticated.user,
      session: authenticated.session,
      storedAt: new Date().toISOString(),
    };
    await writeStoredPlatformMachineSession(stored);
  }
  return { baseUrl, token: stored.session.token };
};

export const resolvePlatformMachineAuth = async (options: {
  platformUrl?: string;
  token?: string;
}) =>
  options.token?.trim()
    ? resolvePlatformMachineAuthUnlocked(options)
    : withPlatformSessionLock(() =>
        resolvePlatformMachineAuthUnlocked(options),
      );

export const listPlatformMachineSessions = async (
  options: GetPlatformMachineProfileOptions = {},
) => {
  const resolved = await resolvePlatformMachineAuth(options);
  return requestPlatformMachineApi({
    baseUrl: resolved.baseUrl,
    pathname: "/api/cli/auth/sessions",
    token: resolved.token,
    schema: platformMachineSessionsResultSchema,
  });
};

export const revokePlatformMachineSession = async (
  options: GetPlatformMachineProfileOptions & { id: string },
) => {
  const resolved = await resolvePlatformMachineAuth(options);
  return requestPlatformMachineApi({
    baseUrl: resolved.baseUrl,
    pathname: "/api/cli/auth/sessions/revoke",
    method: "POST",
    token: resolved.token,
    body: platformMachineRevokeSessionInputSchema.parse(options),
    schema: platformMachineLogoutResultSchema,
  });
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

export const updatePlatformMachineProfile = async ({
  platformUrl,
  token,
  displayName,
}: GetPlatformMachineProfileOptions & { displayName: string }) => {
  const input = platformMachineProfileInputSchema.parse({ displayName });
  const resolved = await resolvePlatformMachineAuth({ platformUrl, token });
  return requestPlatformMachineApi({
    baseUrl: resolved.baseUrl,
    pathname: "/api/cli/auth/profile",
    method: "POST",
    token: resolved.token,
    body: input,
    schema: platformMachineUserSchema,
  });
};

export const logoutPlatformMachineSession = async ({
  platformUrl,
  token,
}: LogoutPlatformMachineSessionOptions = {}) => {
  return withPlatformSessionLock(async () => {
    const resolved = await resolvePlatformMachineAuthUnlocked({
      platformUrl,
      token,
    });
    const result = await requestPlatformMachineApi({
      baseUrl: resolved.baseUrl,
      pathname: "/api/cli/auth/logout",
      method: "POST",
      token: resolved.token,
      schema: platformMachineLogoutResultSchema,
    });
    if (!token) await clearStoredPlatformMachineSession();
    return result;
  });
};

export const getPlatformMachineAuthStatus =
  async (): Promise<AirJamPlatformAuthStatus> => {
    const stored = await readStoredPlatformMachineSession();

    if (!stored) {
      return {
        authenticated: false,
        storagePath: resolvePlatformAuthFile(),
        platformBaseUrl: null,
        clientName: null,
        storedAt: null,
        user: null,
        session: null,
      };
    }

    return {
      authenticated: true,
      storagePath: resolvePlatformAuthFile(),
      platformBaseUrl: stored.platformBaseUrl,
      clientName: stored.clientName,
      storedAt: stored.storedAt,
      user: stored.user,
      session: {
        id: stored.session.id,
        expiresAt: stored.session.expiresAt,
        refreshExpiresAt:
          stored.version === 1
            ? stored.session.expiresAt
            : stored.session.refreshExpiresAt,
        createdAt: stored.session.createdAt,
        userAgent: stored.session.userAgent,
      },
    };
  };

export const getPlatformAuthStoragePath = () => resolvePlatformAuthFile();

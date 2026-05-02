import { db } from "@/db";
import { machineAuthDeviceGrants } from "@/db/schema";
import { resolvePlatformPublicUrl } from "@/lib/platform-public-url";
import type { PlatformMachineDeviceStartResult } from "@air-jam/sdk/platform-machine";
import { eq } from "drizzle-orm";
import { PlatformMachineAuthError } from "./machine-auth-errors";
import {
  createMachineSession,
  readMachineSessionByToken,
  toMachinePollResult,
} from "./machine-session";

const DEVICE_GRANT_TTL_MS = 1000 * 60 * 10;
const DEVICE_GRANT_POLL_INTERVAL_SECONDS = 3;
const USER_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const USER_CODE_LENGTH = 8;

const normalizeMachineUserCode = (value: string): string =>
  value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();

const formatMachineUserCode = (value: string): string => {
  const normalized = normalizeMachineUserCode(value);
  if (normalized.length <= 4) {
    return normalized;
  }

  return `${normalized.slice(0, 4)}-${normalized.slice(4)}`;
};

const createMachineUserCode = (): string => {
  const random = crypto.getRandomValues(new Uint8Array(USER_CODE_LENGTH));

  return Array.from(
    random,
    (value) => USER_CODE_ALPHABET[value % USER_CODE_ALPHABET.length],
  ).join("");
};

const createUniqueUserCode = async (): Promise<string> => {
  while (true) {
    const userCode = createMachineUserCode();
    const existing = await db.query.machineAuthDeviceGrants.findFirst({
      where: (table, { eq }) => eq(table.userCode, userCode),
    });
    if (!existing) {
      return userCode;
    }
  }
};

const buildVerificationUrl = (userCode: string): string => {
  const url = new URL("/dashboard/cli-auth", resolvePlatformPublicUrl());
  url.searchParams.set("userCode", formatMachineUserCode(userCode));
  return url.toString();
};

export const startMachineDeviceGrant = async ({
  clientName,
  now = new Date(),
}: {
  clientName?: string;
  now?: Date;
}): Promise<PlatformMachineDeviceStartResult> => {
  const userCode = await createUniqueUserCode();
  const deviceCode = crypto.randomUUID();
  const expiresAt = new Date(now.getTime() + DEVICE_GRANT_TTL_MS);
  const verificationUrl = buildVerificationUrl(userCode);

  await db.insert(machineAuthDeviceGrants).values({
    id: crypto.randomUUID(),
    deviceCode,
    userCode,
    clientName: clientName?.trim() || null,
    status: "pending",
    userId: null,
    sessionToken: null,
    expiresAt,
    approvedAt: null,
    createdAt: now,
    updatedAt: now,
  });

  return {
    deviceCode,
    userCode: formatMachineUserCode(userCode),
    verificationUrl,
    verificationUriComplete: verificationUrl,
    expiresAt: expiresAt.toISOString(),
    intervalSeconds: DEVICE_GRANT_POLL_INTERVAL_SECONDS,
  };
};

export const approveMachineDeviceGrant = async ({
  userCode,
  userId,
  now = new Date(),
}: {
  userCode: string;
  userId: string;
  now?: Date;
}) => {
  const normalizedUserCode = normalizeMachineUserCode(userCode);
  if (!normalizedUserCode) {
    throw new PlatformMachineAuthError({
      code: "invalid_request",
      message: "A device approval code is required.",
      status: 400,
    });
  }

  const grant = await db.query.machineAuthDeviceGrants.findFirst({
    where: (table, { eq }) => eq(table.userCode, normalizedUserCode),
  });

  if (!grant) {
    throw new PlatformMachineAuthError({
      code: "not_found",
      message: "The device approval code was not found.",
      status: 404,
    });
  }

  if (grant.expiresAt <= now) {
    throw new PlatformMachineAuthError({
      code: "expired_token",
      message: "The device approval code has expired. Start login again.",
      status: 410,
    });
  }

  if (grant.status !== "pending" && grant.userId !== userId) {
    throw new PlatformMachineAuthError({
      code: "conflict",
      message: "This device approval code was already claimed by another user.",
      status: 409,
    });
  }

  const [updatedGrant] = await db
    .update(machineAuthDeviceGrants)
    .set({
      status: grant.sessionToken ? "completed" : "approved",
      userId,
      approvedAt: grant.approvedAt ?? now,
      updatedAt: now,
    })
    .where(eq(machineAuthDeviceGrants.id, grant.id))
    .returning();

  return updatedGrant;
};

export const pollMachineDeviceGrant = async ({
  deviceCode,
  ipAddress,
  now = new Date(),
}: {
  deviceCode: string;
  ipAddress?: string | null;
  now?: Date;
}) => {
  const normalizedDeviceCode = deviceCode.trim();
  if (!normalizedDeviceCode) {
    throw new PlatformMachineAuthError({
      code: "invalid_request",
      message: "A device code is required.",
      status: 400,
    });
  }

  const grant = await db.query.machineAuthDeviceGrants.findFirst({
    where: (table, { eq }) => eq(table.deviceCode, normalizedDeviceCode),
  });

  if (!grant) {
    throw new PlatformMachineAuthError({
      code: "invalid_token",
      message: "The device code was not found.",
      status: 401,
    });
  }

  if (grant.expiresAt <= now) {
    throw new PlatformMachineAuthError({
      code: "expired_token",
      message: "The device login request expired before it was approved.",
      status: 410,
    });
  }

  if (grant.status === "pending") {
    throw new PlatformMachineAuthError({
      code: "authorization_pending",
      message: "Waiting for device approval in the Air Jam dashboard.",
      status: 428,
    });
  }

  if (!grant.userId) {
    throw new PlatformMachineAuthError({
      code: "access_denied",
      message: "The device login request was not approved.",
      status: 403,
    });
  }

  const existingSession =
    grant.sessionToken === null
      ? null
      : await readMachineSessionByToken({
          token: grant.sessionToken,
          now,
        });

  const auth =
    existingSession ??
    (await createMachineSession({
      userId: grant.userId,
      clientName: grant.clientName,
      ipAddress,
      now,
    }));

  if (
    grant.sessionToken !== auth.session.token ||
    grant.status !== "completed"
  ) {
    await db
      .update(machineAuthDeviceGrants)
      .set({
        status: "completed",
        sessionToken: auth.session.token,
        updatedAt: now,
      })
      .where(eq(machineAuthDeviceGrants.id, grant.id));
  }

  return toMachinePollResult(auth);
};

export {
  DEVICE_GRANT_POLL_INTERVAL_SECONDS,
  formatMachineUserCode,
  normalizeMachineUserCode,
};

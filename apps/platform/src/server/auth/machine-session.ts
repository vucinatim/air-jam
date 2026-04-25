import { db } from "@/db";
import { sessions, users } from "@/db/schema";
import { resolvePlatformPublicUrl } from "@/lib/platform-public-url";
import type {
  PlatformMachineDevicePollResult,
  PlatformMachineMeResult,
  PlatformMachineSession,
  PlatformMachineUser,
} from "@air-jam/sdk/platform-machine";
import { eq } from "drizzle-orm";
import { PlatformMachineAuthError } from "./machine-auth-errors";

const MACHINE_SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30;
const MACHINE_USER_AGENT_PREFIX = "airjam-cli";

const toMachineUser = (user: {
  id: string;
  name: string;
  email: string;
  role: "creator" | "ops_admin";
}): PlatformMachineUser => ({
  id: user.id,
  name: user.name,
  email: user.email,
  role: user.role,
});

const toMachineSession = (session: {
  id: string;
  token: string;
  expiresAt: Date;
  createdAt: Date;
  userAgent: string | null;
}): PlatformMachineSession => ({
  id: session.id,
  token: session.token,
  expiresAt: session.expiresAt.toISOString(),
  createdAt: session.createdAt.toISOString(),
  userAgent: session.userAgent ?? MACHINE_USER_AGENT_PREFIX,
});

const resolveMachineUserAgent = (clientName?: string | null): string => {
  const normalizedClientName = clientName?.trim();
  if (!normalizedClientName) {
    return MACHINE_USER_AGENT_PREFIX;
  }

  return `${MACHINE_USER_AGENT_PREFIX}/${normalizedClientName.replace(/\s+/g, "-")}`;
};

export const parseMachineBearerToken = (
  authorizationHeader: string | null,
): string | null => {
  if (!authorizationHeader) {
    return null;
  }

  const match = authorizationHeader.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
};

export const createMachineSession = async ({
  userId,
  clientName,
  ipAddress,
  now = new Date(),
}: {
  userId: string;
  clientName?: string | null;
  ipAddress?: string | null;
  now?: Date;
}): Promise<{
  user: PlatformMachineUser;
  session: PlatformMachineSession;
}> => {
  const user = await db.query.users.findFirst({
    where: (table, { eq }) => eq(table.id, userId),
  });

  if (!user) {
    throw new PlatformMachineAuthError({
      code: "unauthorized",
      message: "The device grant user could not be resolved.",
      status: 401,
    });
  }

  const [session] = await db
    .insert(sessions)
    .values({
      id: crypto.randomUUID(),
      userId,
      token: crypto.randomUUID(),
      expiresAt: new Date(now.getTime() + MACHINE_SESSION_TTL_MS),
      ipAddress: ipAddress ?? null,
      userAgent: resolveMachineUserAgent(clientName),
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  return {
    user: toMachineUser(user),
    session: toMachineSession(session),
  };
};

export const readMachineSessionByToken = async ({
  token,
  now = new Date(),
}: {
  token: string;
  now?: Date;
}): Promise<{
  user: PlatformMachineUser;
  session: PlatformMachineSession;
} | null> => {
  const session = await db.query.sessions.findFirst({
    where: (table, { and, eq, gt }) =>
      and(eq(table.token, token), gt(table.expiresAt, now)),
  });

  if (!session) {
    return null;
  }

  const user = await db.query.users.findFirst({
    where: eq(users.id, session.userId),
  });

  if (!user) {
    return null;
  }

  return {
    user: toMachineUser(user),
    session: toMachineSession(session),
  };
};

export const revokeMachineSessionByToken = async ({
  token,
}: {
  token: string;
}): Promise<void> => {
  await db.delete(sessions).where(eq(sessions.token, token));
};

export const requireMachineSessionFromRequest = async ({
  request,
  now = new Date(),
}: {
  request: Request;
  now?: Date;
}): Promise<{
  token: string;
  user: PlatformMachineUser;
  session: PlatformMachineSession;
}> => {
  const token = parseMachineBearerToken(request.headers.get("authorization"));

  if (!token) {
    throw new PlatformMachineAuthError({
      code: "unauthorized",
      message: "Missing bearer token.",
      status: 401,
    });
  }

  const auth = await readMachineSessionByToken({ token, now });
  if (!auth) {
    throw new PlatformMachineAuthError({
      code: "invalid_token",
      message: "The stored Air Jam machine session is missing or expired.",
      status: 401,
    });
  }

  return {
    token,
    ...auth,
  };
};

export const toMachinePollResult = ({
  user,
  session,
}: {
  user: PlatformMachineUser;
  session: PlatformMachineSession;
}): PlatformMachineDevicePollResult => ({
  platformBaseUrl: resolvePlatformPublicUrl(process.env),
  user,
  session,
});

export const toMachineMeResult = ({
  user,
  session,
}: {
  user: PlatformMachineUser;
  session: PlatformMachineSession;
}): PlatformMachineMeResult => ({
  platformBaseUrl: resolvePlatformPublicUrl(process.env),
  user,
  session: {
    id: session.id,
    expiresAt: session.expiresAt,
    createdAt: session.createdAt,
    userAgent: session.userAgent,
  },
});

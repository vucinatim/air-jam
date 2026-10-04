import {
  createSignedEnvelope,
  verifySignedEnvelope,
  type SignedEnvelopeContract,
} from "@air-jam/sdk/protocol";
import { z } from "zod";

export const AIR_JAM_LAUNCH_SESSION_COOKIE_NAME =
  "__Host-airjam-launch-session";
export const AIR_JAM_LAUNCH_SESSION_TTL_SECONDS = 24 * 60 * 60;

const LAUNCH_SESSION_TYPE = "airjam.launch_session.v1";
const LAUNCH_SESSION_SIGNING_DOMAIN = "airjam:launch-session-capability:v1";

const airJamLaunchSessionClaimsSchema = z
  .object({
    typ: z.literal(LAUNCH_SESSION_TYPE),
    jti: z.string().uuid(),
    iat: z.number().int().positive(),
    exp: z.number().int().positive(),
  })
  .strict();

export type AirJamLaunchSessionClaims = z.infer<
  typeof airJamLaunchSessionClaimsSchema
>;

const launchSessionEnvelopeContract: SignedEnvelopeContract<AirJamLaunchSessionClaims> =
  {
    signingDomain: LAUNCH_SESSION_SIGNING_DOMAIN,
    claimsSchema: airJamLaunchSessionClaimsSchema,
  };

export interface CreateAirJamLaunchSessionInput {
  secret: string;
  now?: number;
  createId?: () => string;
}

export interface VerifyAirJamLaunchSessionResult {
  ok: boolean;
  claims?: AirJamLaunchSessionClaims;
  error?: string;
}

export const createAirJamLaunchSession = async ({
  secret,
  now = Math.floor(Date.now() / 1_000),
  createId = () => globalThis.crypto.randomUUID(),
}: CreateAirJamLaunchSessionInput): Promise<{
  token: string;
  claims: AirJamLaunchSessionClaims;
}> => {
  if (!secret.trim()) {
    throw new Error("Launch-session signing secret is required");
  }

  const claims: AirJamLaunchSessionClaims = {
    typ: LAUNCH_SESSION_TYPE,
    jti: createId(),
    iat: now,
    exp: now + AIR_JAM_LAUNCH_SESSION_TTL_SECONDS,
  };
  return createSignedEnvelope({
    secret,
    claims,
    contract: launchSessionEnvelopeContract,
  });
};

export const verifyAirJamLaunchSession = async ({
  secret,
  token,
  now = Math.floor(Date.now() / 1_000),
}: {
  secret: string;
  token: string;
  now?: number;
}): Promise<VerifyAirJamLaunchSessionResult> => {
  if (!secret.trim()) {
    return { ok: false, error: "Launch-session signing is not configured" };
  }

  const verified = await verifySignedEnvelope({
    secret,
    token,
    contract: launchSessionEnvelopeContract,
  });
  if (!verified.ok) {
    if (verified.error === "invalid_signature") {
      return { ok: false, error: "Invalid launch-session signature" };
    }
    if (verified.error === "invalid_payload") {
      return { ok: false, error: "Invalid launch-session payload" };
    }
    return { ok: false, error: "Malformed launch session" };
  }

  const claims = verified.claims;
  if (claims.exp - claims.iat !== AIR_JAM_LAUNCH_SESSION_TTL_SECONDS) {
    return { ok: false, error: "Invalid launch-session lifetime" };
  }
  if (claims.exp <= now) {
    return { ok: false, error: "Launch session expired" };
  }
  if (claims.iat > now + 60) {
    return { ok: false, error: "Launch session issued in the future" };
  }

  return { ok: true, claims };
};

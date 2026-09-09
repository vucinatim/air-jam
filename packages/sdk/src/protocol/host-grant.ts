import { z } from "zod";
import { hostSessionKindSchema } from "./host";
import {
  createSignedEnvelope,
  verifySignedEnvelope,
  type SignedEnvelopeContract,
} from "./signed-envelope";

export const hostGrantAudienceSchema = z.literal("airjam:realtime");

export const hostGrantClaimsSchema = z
  .object({
    typ: z.literal("airjam.host_grant.v3"),
    jti: z.string().uuid(),
    aud: hostGrantAudienceSchema,
    appId: z.string().min(1),
    gameId: z.string().min(1),
    creatorId: z.string().min(1),
    iat: z.number().int().positive(),
    exp: z.number().int().positive(),
    origins: z.array(z.string().url()).min(1),
    sessionKind: hostSessionKindSchema,
  })
  .strict();

export type HostGrantClaims = z.infer<typeof hostGrantClaimsSchema>;

export const HOST_GRANT_SIGNING_DOMAIN = "airjam:host-grant:v3";

const hostGrantEnvelopeContract: SignedEnvelopeContract<HostGrantClaims> = {
  signingDomain: HOST_GRANT_SIGNING_DOMAIN,
  claimsSchema: hostGrantClaimsSchema,
};

export interface CreateHostGrantInput {
  secret: string;
  claims: Omit<HostGrantClaims, "typ"> & Partial<Pick<HostGrantClaims, "typ">>;
}

export const createHostGrant = async ({
  secret,
  claims,
}: CreateHostGrantInput): Promise<string> => {
  const normalizedClaims = hostGrantClaimsSchema.parse({
    typ: "airjam.host_grant.v3",
    ...claims,
  });
  return (
    await createSignedEnvelope({
      secret,
      claims: normalizedClaims,
      contract: hostGrantEnvelopeContract,
    })
  ).token;
};

export interface VerifyHostGrantInput {
  secret: string;
  token: string;
  now?: number;
}

export interface VerifyHostGrantResult {
  ok: boolean;
  claims?: HostGrantClaims;
  error?: string;
}

export const verifyHostGrant = async ({
  secret,
  token,
  now = Math.floor(Date.now() / 1000),
}: VerifyHostGrantInput): Promise<VerifyHostGrantResult> => {
  const verified = await verifySignedEnvelope({
    secret,
    token,
    contract: hostGrantEnvelopeContract,
  });
  if (!verified.ok) {
    if (verified.error === "invalid_signature") {
      return { ok: false, error: "Invalid host grant signature" };
    }
    if (verified.error === "invalid_payload") {
      return { ok: false, error: "Invalid host grant payload" };
    }
    return { ok: false, error: "Malformed host grant" };
  }

  const claims = verified.claims;
  if (claims.exp <= now) {
    return { ok: false, error: "Host grant expired" };
  }

  if (
    claims.iat > now + 30 ||
    claims.exp <= claims.iat ||
    claims.exp - claims.iat > 120
  ) {
    return { ok: false, error: "Invalid host grant lifetime" };
  }

  return { ok: true, claims };
};

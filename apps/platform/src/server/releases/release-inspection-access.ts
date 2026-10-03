import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";

export const RELEASE_INSPECTION_ACCESS_HEADER = "x-airjam-release-access-token";

const RELEASE_INSPECTION_TOKEN_VERSION = "v2";
const MAX_RELEASE_INSPECTION_TOKEN_LENGTH = 4096;

const releaseInspectionAccessPayloadSchema = z
  .object({
    v: z.literal(RELEASE_INSPECTION_TOKEN_VERSION),
    gameId: z.string().min(1).max(256),
    releaseId: z.string().min(1).max(256),
    generationId: z.string().min(1).max(256),
    exp: z.number().int().positive(),
  })
  .strict();

type ReleaseInspectionAccessPayload = z.infer<
  typeof releaseInspectionAccessPayloadSchema
>;

const encodeBase64Url = (value: string): string =>
  Buffer.from(value, "utf8").toString("base64url");

const decodeBase64Url = (value: string): string =>
  Buffer.from(value, "base64url").toString("utf8");

const signReleaseInspectionPayload = ({
  encodedPayload,
  secret,
}: {
  encodedPayload: string;
  secret: string;
}): string =>
  createHmac("sha256", secret).update(encodedPayload).digest("base64url");

const parseReleaseInspectionPayload = (
  encodedPayload: string,
): ReleaseInspectionAccessPayload | null => {
  try {
    const parsed = releaseInspectionAccessPayloadSchema.safeParse(
      JSON.parse(decodeBase64Url(encodedPayload)),
    );
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
};

const isSignatureMatch = ({
  signature,
  expectedSignature,
}: {
  signature: string;
  expectedSignature: string;
}): boolean => {
  const actualBuffer = Buffer.from(signature, "utf8");
  const expectedBuffer = Buffer.from(expectedSignature, "utf8");

  if (actualBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return timingSafeEqual(actualBuffer, expectedBuffer);
};

export const createReleaseInspectionAccessToken = ({
  gameId,
  releaseId,
  generationId,
  secret,
  expiresAtMs,
}: {
  gameId: string;
  releaseId: string;
  generationId: string;
  secret: string;
  expiresAtMs: number;
}): string => {
  const encodedPayload = encodeBase64Url(
    JSON.stringify(
      releaseInspectionAccessPayloadSchema.parse({
        v: RELEASE_INSPECTION_TOKEN_VERSION,
        gameId,
        releaseId,
        generationId,
        exp: expiresAtMs,
      }),
    ),
  );
  const signature = signReleaseInspectionPayload({
    encodedPayload,
    secret,
  });

  return [RELEASE_INSPECTION_TOKEN_VERSION, encodedPayload, signature].join(
    ".",
  );
};

export const verifyReleaseInspectionAccessToken = ({
  token,
  gameId,
  releaseId,
  generationId,
  secret,
  nowMs = Date.now(),
}: {
  token: string | null;
  gameId: string;
  releaseId: string;
  generationId: string;
  secret: string | null;
  nowMs?: number;
}): boolean => {
  if (
    !token ||
    !secret ||
    token.length > MAX_RELEASE_INSPECTION_TOKEN_LENGTH ||
    !Number.isFinite(nowMs)
  ) {
    return false;
  }

  const segments = token.split(".");
  const [version, encodedPayload, signature] = segments;
  if (
    segments.length !== 3 ||
    version !== RELEASE_INSPECTION_TOKEN_VERSION ||
    !encodedPayload ||
    !signature ||
    !/^[A-Za-z0-9_-]+$/.test(encodedPayload) ||
    !/^[A-Za-z0-9_-]{43}$/.test(signature)
  ) {
    return false;
  }

  const expectedSignature = signReleaseInspectionPayload({
    encodedPayload,
    secret,
  });
  if (!isSignatureMatch({ signature, expectedSignature })) {
    return false;
  }

  const payload = parseReleaseInspectionPayload(encodedPayload);
  if (!payload) {
    return false;
  }

  if (payload.exp <= nowMs) {
    return false;
  }

  return (
    payload.gameId === gameId &&
    payload.releaseId === releaseId &&
    payload.generationId === generationId
  );
};

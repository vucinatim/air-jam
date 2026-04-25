import { createHmac, timingSafeEqual } from "node:crypto";

export const RELEASE_INSPECTION_ACCESS_HEADER = "x-airjam-release-access-token";

const RELEASE_INSPECTION_TOKEN_VERSION = "v1";

type ReleaseInspectionAccessPayload = {
  v: typeof RELEASE_INSPECTION_TOKEN_VERSION;
  gameId: string;
  releaseId: string;
  exp: number;
};

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
    const parsed = JSON.parse(
      decodeBase64Url(encodedPayload),
    ) as Partial<ReleaseInspectionAccessPayload>;

    if (
      parsed.v !== RELEASE_INSPECTION_TOKEN_VERSION ||
      typeof parsed.gameId !== "string" ||
      parsed.gameId.length === 0 ||
      typeof parsed.releaseId !== "string" ||
      parsed.releaseId.length === 0 ||
      typeof parsed.exp !== "number" ||
      !Number.isFinite(parsed.exp)
    ) {
      return null;
    }

    return {
      v: RELEASE_INSPECTION_TOKEN_VERSION,
      gameId: parsed.gameId,
      releaseId: parsed.releaseId,
      exp: parsed.exp,
    };
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
  secret,
  expiresAtMs,
}: {
  gameId: string;
  releaseId: string;
  secret: string;
  expiresAtMs: number;
}): string => {
  const encodedPayload = encodeBase64Url(
    JSON.stringify({
      v: RELEASE_INSPECTION_TOKEN_VERSION,
      gameId,
      releaseId,
      exp: expiresAtMs,
    } satisfies ReleaseInspectionAccessPayload),
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
  secret,
  nowMs = Date.now(),
}: {
  token: string | null;
  gameId: string;
  releaseId: string;
  secret: string | null;
  nowMs?: number;
}): boolean => {
  if (!token || !secret) {
    return false;
  }

  const [version, encodedPayload, signature] = token.split(".");
  if (
    version !== RELEASE_INSPECTION_TOKEN_VERSION ||
    !encodedPayload ||
    !signature
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

  return payload.gameId === gameId && payload.releaseId === releaseId;
};

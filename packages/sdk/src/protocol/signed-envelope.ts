import type { z } from "zod";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export type SignedEnvelopeVerificationError =
  | "missing_secret"
  | "malformed"
  | "invalid_signature"
  | "invalid_payload";

export type SignedEnvelopeVerificationResult<TClaims> =
  | { ok: true; claims: TClaims }
  | { ok: false; error: SignedEnvelopeVerificationError };

export interface SignedEnvelopeContract<TClaims> {
  signingDomain: string;
  claimsSchema: z.ZodType<TClaims>;
}

const getSubtleCrypto = (): SubtleCrypto => {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new Error("SubtleCrypto unavailable");
  }
  return subtle;
};

const getBtoa = (): ((value: string) => string) => {
  if (typeof globalThis.btoa !== "function") {
    throw new Error("Base64 encoding unavailable");
  }
  return globalThis.btoa.bind(globalThis);
};

const getAtob = (): ((value: string) => string) => {
  if (typeof globalThis.atob !== "function") {
    throw new Error("Base64 decoding unavailable");
  }
  return globalThis.atob.bind(globalThis);
};

const toBase64Url = (bytes: Uint8Array): string => {
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return getBtoa()(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
};

const fromBase64Url = (value: string): Uint8Array => {
  if (!/^[A-Za-z0-9_-]+$/u.test(value)) {
    throw new Error("Invalid base64url value");
  }
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(
    normalized.length + ((4 - (normalized.length % 4)) % 4),
    "=",
  );
  const binary = getAtob()(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
};

const deriveSigningKey = async (
  secret: string,
  signingDomain: string,
  usages: KeyUsage[],
): Promise<CryptoKey> => {
  const subtle = getSubtleCrypto();
  const rootKey = await subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const derivedKey = await subtle.sign(
    "HMAC",
    rootKey,
    encoder.encode(signingDomain),
  );
  return subtle.importKey(
    "raw",
    derivedKey,
    { name: "HMAC", hash: "SHA-256" },
    false,
    usages,
  );
};

const toArrayBuffer = (bytes: Uint8Array): ArrayBuffer => {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
};

export const createSignedEnvelope = async <TClaims>({
  secret,
  claims,
  contract,
}: {
  secret: string;
  claims: TClaims;
  contract: SignedEnvelopeContract<TClaims>;
}): Promise<{ token: string; claims: TClaims }> => {
  if (!secret.trim()) {
    throw new Error("Signed-envelope secret is required");
  }
  if (!contract.signingDomain.trim()) {
    throw new Error("Signed-envelope domain is required");
  }

  const normalizedClaims = contract.claimsSchema.parse(claims);
  const payload = toBase64Url(encoder.encode(JSON.stringify(normalizedClaims)));
  const signingKey = await deriveSigningKey(secret, contract.signingDomain, [
    "sign",
  ]);
  const signature = await getSubtleCrypto().sign(
    "HMAC",
    signingKey,
    encoder.encode(payload),
  );

  return {
    token: `${payload}.${toBase64Url(new Uint8Array(signature))}`,
    claims: normalizedClaims,
  };
};

export const verifySignedEnvelope = async <TClaims>({
  secret,
  token,
  contract,
}: {
  secret: string;
  token: string;
  contract: SignedEnvelopeContract<TClaims>;
}): Promise<SignedEnvelopeVerificationResult<TClaims>> => {
  if (!secret.trim()) {
    return { ok: false, error: "missing_secret" };
  }

  const parts = token.split(".");
  if (parts.length !== 2) {
    return { ok: false, error: "malformed" };
  }
  const [payload, encodedSignature] = parts;

  try {
    const signingKey = await deriveSigningKey(secret, contract.signingDomain, [
      "verify",
    ]);
    const signatureValid = await getSubtleCrypto().verify(
      "HMAC",
      signingKey,
      toArrayBuffer(fromBase64Url(encodedSignature!)),
      encoder.encode(payload!),
    );
    if (!signatureValid) {
      return { ok: false, error: "invalid_signature" };
    }

    const claims = contract.claimsSchema.safeParse(
      JSON.parse(decoder.decode(fromBase64Url(payload!))) as unknown,
    );
    if (!claims.success) {
      return { ok: false, error: "invalid_payload" };
    }
    return { ok: true, claims: claims.data };
  } catch {
    return { ok: false, error: "malformed" };
  }
};

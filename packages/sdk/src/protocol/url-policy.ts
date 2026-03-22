import { z } from "zod";

const ALLOWED_RUNTIME_PROTOCOLS = new Set(["http:", "https:"]);

const parseRuntimeUrl = (value: string): URL | null => {
  try {
    const parsed = new URL(value);
    if (!ALLOWED_RUNTIME_PROTOCOLS.has(parsed.protocol)) {
      return null;
    }
    if (parsed.username || parsed.password) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
};

export const normalizeRuntimeUrl = (value: string): string | null => {
  const parsed = parseRuntimeUrl(value);
  return parsed ? parsed.toString() : null;
};

export const getRuntimeUrlOrigin = (value: string): string | null => {
  const parsed = parseRuntimeUrl(value);
  return parsed ? parsed.origin : null;
};

export const runtimeUrlSchema = z
  .string()
  .trim()
  .min(1)
  .refine((value) => parseRuntimeUrl(value) !== null, {
    message:
      "URL must be a valid http(s) URL without embedded credentials.",
  });

export const appendRuntimeQueryParams = (
  baseUrl: string,
  params: Record<string, string | null | undefined>,
): string | null => {
  const parsed = parseRuntimeUrl(baseUrl);
  if (!parsed) {
    return null;
  }

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") {
      continue;
    }
    parsed.searchParams.set(key, value);
  }

  return parsed.toString();
};

export const isTrustedRuntimeMessageOrigin = (
  runtimeUrl: string,
  messageOrigin: string,
): boolean => {
  const runtimeOrigin = getRuntimeUrlOrigin(runtimeUrl);
  return runtimeOrigin !== null && runtimeOrigin === messageOrigin;
};

const DEFAULT_UPLOAD_URL_TTL_SECONDS = 15 * 60;

type ReleaseStorageConfig = {
  bucket: string;
  endpoint: string;
  accessKeyId: string;
  secretAccessKey: string;
  uploadUrlTtlSeconds: number;
};

let cachedConfig: ReleaseStorageConfig | null = null;

const readRequiredEnv = (name: string): string => {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required release storage env: ${name}`);
  }
  return value;
};

const readPositiveIntegerEnv = (name: string, fallback: number): number => {
  const rawValue = process.env[name]?.trim();
  if (!rawValue) return fallback;

  const parsedValue = Number.parseInt(rawValue, 10);
  if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
    throw new Error(`Invalid positive integer env for ${name}: ${rawValue}`);
  }

  return parsedValue;
};

export const getReleaseStorageConfig = (): ReleaseStorageConfig => {
  if (cachedConfig) {
    return cachedConfig;
  }

  const explicitEndpoint = process.env.AIRJAM_RELEASES_R2_ENDPOINT?.trim();
  const accountId = process.env.AIRJAM_RELEASES_R2_ACCOUNT_ID?.trim();
  const endpoint =
    explicitEndpoint ||
    (accountId
      ? `https://${accountId}.r2.cloudflarestorage.com`
      : null);

  if (!endpoint) {
    throw new Error(
      "Missing release storage endpoint. Set AIRJAM_RELEASES_R2_ENDPOINT or AIRJAM_RELEASES_R2_ACCOUNT_ID.",
    );
  }

  cachedConfig = {
    bucket: readRequiredEnv("AIRJAM_RELEASES_R2_BUCKET"),
    endpoint,
    accessKeyId: readRequiredEnv("AIRJAM_RELEASES_R2_ACCESS_KEY_ID"),
    secretAccessKey: readRequiredEnv("AIRJAM_RELEASES_R2_SECRET_ACCESS_KEY"),
    uploadUrlTtlSeconds: readPositiveIntegerEnv(
      "AIRJAM_RELEASES_UPLOAD_URL_TTL_SECONDS",
      DEFAULT_UPLOAD_URL_TTL_SECONDS,
    ),
  };

  return cachedConfig;
};

export type { ReleaseStorageConfig };

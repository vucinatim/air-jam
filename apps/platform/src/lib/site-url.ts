import {
  PLATFORM_PUBLIC_URL_FALLBACK,
  resolvePlatformDeploymentConfig,
} from "./platform-deployment-config";

export function getSiteUrl(): string {
  return (
    resolvePlatformDeploymentConfig(process.env).platformPublicUrl ||
    PLATFORM_PUBLIC_URL_FALLBACK
  );
}

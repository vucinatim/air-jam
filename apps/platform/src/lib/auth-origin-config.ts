import {
  PLATFORM_PUBLIC_URL_FALLBACK,
  resolvePlatformDeploymentConfig,
} from "./platform-deployment-config";

export const resolveAuthBaseUrl = (
  env: NodeJS.ProcessEnv = process.env,
): string =>
  resolvePlatformDeploymentConfig(env).authBaseUrl ||
  PLATFORM_PUBLIC_URL_FALLBACK;

export const resolveAuthTrustedOrigins = (
  env: NodeJS.ProcessEnv = process.env,
): string[] => resolvePlatformDeploymentConfig(env).authTrustedOrigins;

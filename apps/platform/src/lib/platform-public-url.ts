import {
  PLATFORM_PUBLIC_URL_FALLBACK,
  resolvePlatformDeploymentConfig,
} from "./platform-deployment-config";

export const resolvePlatformPublicUrl = (
  env: NodeJS.ProcessEnv = process.env,
): string => resolvePlatformDeploymentConfig(env).platformPublicUrl;

export { PLATFORM_PUBLIC_URL_FALLBACK };

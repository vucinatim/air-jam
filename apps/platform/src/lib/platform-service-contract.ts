import {
  PLATFORM_LIVENESS_PATH,
  PLATFORM_READINESS_PATH,
} from "./platform-service-paths.mjs";

export { PLATFORM_LIVENESS_PATH, PLATFORM_READINESS_PATH };

export type PlatformDeploymentIdentity = {
  provider: "railway" | null;
  environment: string | null;
  deploymentId: string | null;
  revision: string | null;
};

export const readPlatformDeploymentIdentity = (
  env: NodeJS.ProcessEnv = process.env,
): PlatformDeploymentIdentity => ({
  provider: env.RAILWAY_PROJECT_ID ? "railway" : null,
  environment: env.RAILWAY_ENVIRONMENT_NAME?.trim() || null,
  deploymentId: env.RAILWAY_DEPLOYMENT_ID?.trim() || null,
  revision: env.RAILWAY_GIT_COMMIT_SHA?.trim() || null,
});

export const isPlatformLivenessPath = (pathname: string): boolean =>
  pathname === PLATFORM_LIVENESS_PATH;

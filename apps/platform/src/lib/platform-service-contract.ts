export const PLATFORM_LIVENESS_PATH = "/api/health" as const;
export const PLATFORM_READINESS_PATH = "/api/readiness" as const;

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
  revision:
    env.RAILWAY_GIT_COMMIT_SHA?.trim() ||
    env.VERCEL_GIT_COMMIT_SHA?.trim() ||
    null,
});

export const isPlatformLivenessPath = (pathname: string): boolean =>
  pathname === PLATFORM_LIVENESS_PATH;

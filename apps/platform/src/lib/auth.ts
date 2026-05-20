import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "../db";
import * as schema from "../db/schema";
import { resolveAuthSecret } from "./auth-secret";
import { resolvePlatformDeploymentConfig } from "./platform-deployment-config";

const deploymentConfig = resolvePlatformDeploymentConfig(process.env);
const githubClientId = process.env.GITHUB_CLIENT_ID;
const githubClientSecret = process.env.GITHUB_CLIENT_SECRET;

export const auth = betterAuth({
  baseURL: deploymentConfig.authBaseUrl,
  trustedOrigins: deploymentConfig.authTrustedOrigins,
  secret: resolveAuthSecret({
    env: process.env,
    isRailwayPreviewEnvironment: deploymentConfig.isRailwayPreviewEnvironment,
  }),
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      ...schema,
      user: schema.users,
      session: schema.sessions,
      account: schema.accounts,
      verification: schema.verificationTokens,
    },
  }),
  emailAndPassword: {
    enabled: true,
  },
  socialProviders:
    githubClientId && githubClientSecret
      ? {
          github: {
            clientId: githubClientId,
            clientSecret: githubClientSecret,
          },
        }
      : undefined,
  // Baseline per-IP rate limiting on auth endpoints (sign-up, sign-in, reset, etc.).
  // Sufficient for v1 single-instance launch; revisit once we have distributed infra.
  rateLimit: {
    enabled: true,
    window: 60,
    max: 20,
  },
});

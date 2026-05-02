import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "../db";
import * as schema from "../db/schema";
import {
  resolveAuthBaseUrl,
  resolveAuthTrustedOrigins,
} from "./auth-origin-config";

const githubClientId = process.env.GITHUB_CLIENT_ID;
const githubClientSecret = process.env.GITHUB_CLIENT_SECRET;
const authBaseUrl = resolveAuthBaseUrl(process.env);
const authTrustedOrigins = resolveAuthTrustedOrigins(process.env);

export const auth = betterAuth({
  baseURL: authBaseUrl,
  trustedOrigins: authTrustedOrigins,
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

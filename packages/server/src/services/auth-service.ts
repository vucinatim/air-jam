import { and, eq } from "drizzle-orm";
import {
  verifyHostGrant,
  type HostGrantClaims,
} from "@air-jam/sdk/protocol";
import { createServerLogger, type ServerLogger } from "../logging/logger.js";
import { appIds, db } from "../db.js";

type AuthMode = "disabled" | "required";

/**
 * App identity verification result
 */
export interface VerificationResult {
  isVerified: boolean;
  error?: string;
}

export interface VerifyAppIdContext {
  origin?: string;
}

export interface VerifyHostBootstrapInput {
  appId?: string;
  hostGrant?: string;
  origin?: string;
}

export interface HostBootstrapVerificationResult extends VerificationResult {
  appId?: string;
  verifiedVia?: "appId" | "hostGrant";
  verifiedOrigin?: string;
  grantClaims?: HostGrantClaims;
}

const normalizeOrigin = (value?: string): string | null => {
  if (!value) {
    return null;
  }

  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
};

/**
 * Authentication service
 * Handles app identity verification.
 * In local/dev mode, allows all connections by default.
 * In production, defaults to required auth (fail-closed).
 */
export class AuthService {
  private logger: ServerLogger;
  private masterKey: string | undefined;
  private hostGrantSecret: string | undefined;
  private databaseUrl: string | undefined;
  private authMode: AuthMode;

  constructor(options: { logger?: ServerLogger } = {}) {
    this.logger = options.logger ?? createServerLogger({ component: "auth" });
    this.masterKey = process.env.AIR_JAM_MASTER_KEY;
    this.hostGrantSecret = process.env.AIR_JAM_HOST_GRANT_SECRET;
    this.databaseUrl = process.env.DATABASE_URL;
    this.authMode = this.resolveAuthMode();

    if (this.authMode === "disabled") {
      this.logger.info(
        "Authentication disabled (set AIR_JAM_AUTH_MODE=required to enforce app identity checks)",
      );
    } else if (this.masterKey && !this.databaseUrl) {
      this.logger.info(
        "Running with master key authentication (no database required)",
      );
    } else if (this.databaseUrl) {
      this.logger.info("Running with database authentication");
    } else {
      this.logger.warn(
        "Authentication required, but no auth backend is configured (set AIR_JAM_MASTER_KEY or DATABASE_URL)",
      );
    }
  }

  async verifyHostBootstrap({
    appId,
    hostGrant,
    origin,
  }: VerifyHostBootstrapInput): Promise<HostBootstrapVerificationResult> {
    const normalizedOrigin = normalizeOrigin(origin) ?? undefined;

    if (hostGrant) {
      if (!this.hostGrantSecret) {
        return {
          isVerified: false,
          error:
            "Unauthorized: Host grant verification is not configured on the server",
        };
      }

      const grantResult = await verifyHostGrant({
        secret: this.hostGrantSecret,
        token: hostGrant,
      });
      if (!grantResult.ok || !grantResult.claims) {
        return {
          isVerified: false,
          error: grantResult.error ?? "Unauthorized: Invalid Host Grant",
        };
      }

      const grantOrigins = (grantResult.claims.origins ?? [])
        .map((value) => normalizeOrigin(value))
        .filter((value): value is string => value !== null);

      if (grantOrigins.length > 0) {
        if (!normalizedOrigin) {
          return {
            isVerified: false,
            error: "Unauthorized: Missing or Invalid Origin",
          };
        }

        if (!grantOrigins.includes(normalizedOrigin)) {
          return {
            isVerified: false,
            error: "Unauthorized: Origin not allowed by Host Grant",
          };
        }
      }

      return {
        isVerified: true,
        appId: grantResult.claims.appId,
        verifiedVia: "hostGrant",
        verifiedOrigin: normalizedOrigin,
        grantClaims: grantResult.claims,
      };
    }

    const appIdResult = await this.verifyAppId(appId, { origin });
    return {
      ...appIdResult,
      appId: appIdResult.isVerified ? appId : undefined,
      verifiedVia: appIdResult.isVerified ? "appId" : undefined,
      verifiedOrigin: appIdResult.isVerified ? normalizedOrigin : undefined,
    };
  }

  /**
   * Verify a browser-supplied app ID.
   * Returns verification result with optional error message
   * In local/dev mode, always returns success
   */
  async verifyAppId(
    appId?: string,
    context?: VerifyAppIdContext,
  ): Promise<VerificationResult> {
    // Local/dev mode: no auth required
    if (this.authMode === "disabled") {
      return { isVerified: true };
    }

    if (!appId) {
      return {
        isVerified: false,
        error: "Unauthorized: Invalid or Missing App ID",
      };
    }

    // Check master key first
    if (this.masterKey && appId === this.masterKey) {
      return { isVerified: true };
    }

    // Check database (only if database URL is configured)
    if (!this.databaseUrl || !db) {
      return {
        isVerified: false,
        error: "Unauthorized: Invalid or Missing App ID",
      };
    }

    try {
      const [keyRecord] = await db
        .select()
        .from(appIds)
        .where(and(eq(appIds.key, appId), eq(appIds.isActive, true)))
        .limit(1);

      if (keyRecord) {
        const allowedOrigins = keyRecord.allowedOrigins ?? [];
        if (allowedOrigins.length > 0) {
          const requestOrigin = normalizeOrigin(context?.origin);
          if (!requestOrigin) {
            return {
              isVerified: false,
              error: "Unauthorized: Missing or Invalid Origin",
            };
          }

          const normalizedAllowedOrigins = allowedOrigins
            .map((value) => normalizeOrigin(value))
            .filter((value): value is string => value !== null);

          if (!normalizedAllowedOrigins.includes(requestOrigin)) {
            return {
              isVerified: false,
              error: "Unauthorized: Origin not allowed for this App ID",
            };
          }
        }

        // Update last used timestamp (fire and forget)
        db.update(appIds)
          .set({ lastUsedAt: new Date() })
          .where(eq(appIds.id, keyRecord.id))
          .catch((err: unknown) => {
            this.logger.warn({ err }, "Failed to update app ID lastUsedAt");
          });

        return { isVerified: true };
      }

      return {
        isVerified: false,
        error: "Unauthorized: Invalid or Missing App ID",
      };
    } catch (error) {
      this.logger.error({ err: error }, "Database error during app ID verification");
      return {
        isVerified: false,
        error: "Internal Server Error",
      };
    }
  }

  private resolveAuthMode(): AuthMode {
    const configuredMode = process.env.AIR_JAM_AUTH_MODE?.toLowerCase();

    if (configuredMode === "disabled") {
      return "disabled";
    }

    if (configuredMode === "required") {
      return "required";
    }

    // Auto mode (default):
    // - Production defaults to required.
    // - Development defaults to disabled for friction-free local iteration.
    // - Use AIR_JAM_AUTH_MODE=required to enforce auth in development.
    if (process.env.NODE_ENV === "production") {
      return "required";
    }

    return "disabled";
  }
}

import { and, eq } from "drizzle-orm";
import { apiKeys, db } from "../db.js";

type AuthMode = "disabled" | "required";

/**
 * API key verification result
 */
export interface VerificationResult {
  isVerified: boolean;
  error?: string;
}

/**
 * Authentication service
 * Handles API key verification
 * In local/dev mode, allows all connections by default.
 * In production, defaults to required auth (fail-closed).
 */
export class AuthService {
  private masterKey: string | undefined;
  private databaseUrl: string | undefined;
  private authMode: AuthMode;

  constructor() {
    this.masterKey = process.env.AIR_JAM_MASTER_KEY;
    this.databaseUrl = process.env.DATABASE_URL;
    this.authMode = this.resolveAuthMode();

    if (this.authMode === "disabled") {
      console.log(
        "[server] Authentication disabled (set AIR_JAM_AUTH_MODE=required to enforce API keys)",
      );
    } else if (this.masterKey && !this.databaseUrl) {
      console.log(
        "[server] Running with master key authentication (no database required)",
      );
    } else if (this.databaseUrl) {
      console.log("[server] Running with database authentication");
    } else {
      console.log(
        "[server] Authentication required, but no auth backend is configured (set AIR_JAM_MASTER_KEY or DATABASE_URL)",
      );
    }
  }

  /**
   * Verify an API key
   * Returns verification result with optional error message
   * In local/dev mode, always returns success
   */
  async verifyApiKey(apiKey?: string): Promise<VerificationResult> {
    // Local/dev mode: no auth required
    if (this.authMode === "disabled") {
      return { isVerified: true };
    }

    if (!apiKey) {
      return {
        isVerified: false,
        error: "Unauthorized: Invalid or Missing API Key",
      };
    }

    // Check master key first
    if (this.masterKey && apiKey === this.masterKey) {
      return { isVerified: true };
    }

    // Check database (only if database URL is configured)
    if (!this.databaseUrl || !db) {
      return {
        isVerified: false,
        error: "Unauthorized: Invalid or Missing API Key",
      };
    }

    try {
      const [keyRecord] = await db
        .select()
        .from(apiKeys)
        .where(and(eq(apiKeys.key, apiKey), eq(apiKeys.isActive, true)))
        .limit(1);

      if (keyRecord) {
        // Update last used timestamp (fire and forget)
        db.update(apiKeys)
          .set({ lastUsedAt: new Date() })
          .where(eq(apiKeys.id, keyRecord.id))
          .catch((err: unknown) =>
            console.error("[server] Failed to update lastUsedAt", err),
          );

        return { isVerified: true };
      }

      return {
        isVerified: false,
        error: "Unauthorized: Invalid or Missing API Key",
      };
    } catch (error) {
      console.error("[server] Database error during key verification", error);
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

/**
 * Singleton instance
 */
export const authService = new AuthService();

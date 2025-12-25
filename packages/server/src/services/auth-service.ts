import { and, eq } from "drizzle-orm";
import { apiKeys, db } from "../db.js";

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
 * In dev mode (no master key, no database), allows all connections
 */
export class AuthService {
  private masterKey: string | undefined;
  private databaseUrl: string | undefined;
  private isDevMode: boolean;

  constructor() {
    this.masterKey = process.env.AIR_JAM_MASTER_KEY;
    this.databaseUrl = process.env.DATABASE_URL;
    this.isDevMode = !this.masterKey && !this.databaseUrl;

    if (this.isDevMode) {
      console.log(
        "[server] Running in development mode - authentication disabled",
      );
    } else if (this.masterKey && !this.databaseUrl) {
      console.log(
        "[server] Running with master key authentication (no database required)",
      );
    } else if (this.databaseUrl) {
      console.log("[server] Running with database authentication");
    }
  }

  /**
   * Verify an API key
   * Returns verification result with optional error message
   * In dev mode, always returns success
   */
  async verifyApiKey(apiKey?: string): Promise<VerificationResult> {
    // Dev mode: no auth required
    if (this.isDevMode) {
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
}

/**
 * Singleton instance
 */
export const authService = new AuthService();

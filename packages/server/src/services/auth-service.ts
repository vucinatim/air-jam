import { db, apiKeys } from "../db.js";
import { eq, and } from "drizzle-orm";

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
 */
export class AuthService {
  private masterKey: string | undefined;

  constructor() {
    this.masterKey = process.env.AIR_JAM_MASTER_KEY;
  }

  /**
   * Verify an API key
   * Returns verification result with optional error message
   */
  async verifyApiKey(apiKey?: string): Promise<VerificationResult> {
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

    // Check database
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
            console.error("[server] Failed to update lastUsedAt", err)
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

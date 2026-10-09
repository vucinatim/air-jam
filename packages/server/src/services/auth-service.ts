import type { HostGrantClaims, HostSessionKind } from "@air-jam/sdk/protocol";
/**
 * App identity verification result
 */
export interface VerificationResult {
  isVerified: boolean;
  error?: string;
  gameId?: string;
  creatorId?: string;
}

export interface VerifyAppIdContext {
  origin?: string;
}

export interface VerifyHostBootstrapInput {
  appId?: string;
  hostGrant?: string;
  origin?: string;
  hostSessionKind?: HostSessionKind;
}

export interface HostBootstrapVerificationResult extends VerificationResult {
  appId?: string;
  verifiedVia?: "appId" | "hostGrant";
  verifiedOrigin?: string;
  grantClaims?: HostGrantClaims;
  hostSessionKind?: HostSessionKind;
}

export interface HostBootstrapAuthService {
  verifyHostBootstrap: (
    input: VerifyHostBootstrapInput,
  ) => Promise<HostBootstrapVerificationResult>;
  getStartupConfigurationError?: () => string | null;
}

export class AuthService implements HostBootstrapAuthService {
  constructor(
    private readonly options: {
      env?: { authMode?: "disabled" | "required"; masterKey?: string };
    } = {},
  ) {}

  getStartupConfigurationError(): string | null {
    return this.options.env?.authMode === "required" &&
      !this.options.env.masterKey
      ? "Required authentication needs an explicit authService adapter. AIR_JAM_MASTER_KEY is available only for local development and tests."
      : null;
  }

  async verifyHostBootstrap({
    appId,
    hostGrant,
    origin,
    hostSessionKind,
  }: VerifyHostBootstrapInput): Promise<HostBootstrapVerificationResult> {
    if (hostGrant) {
      return {
        isVerified: false,
        error:
          "Unauthorized: Host grant verification is not configured on the server",
      };
    }
    const verification = await this.verifyAppId(appId);
    let verifiedOrigin: string | undefined;
    if (origin) {
      try {
        verifiedOrigin = new URL(origin).origin;
      } catch {
        verifiedOrigin = undefined;
      }
    }
    return {
      ...verification,
      appId: verification.isVerified ? appId : undefined,
      verifiedVia: verification.isVerified ? "appId" : undefined,
      verifiedOrigin: verification.isVerified ? verifiedOrigin : undefined,
      hostSessionKind: verification.isVerified
        ? this.options.env?.authMode === "required"
          ? "game"
          : (hostSessionKind ?? "system")
        : undefined,
    };
  }

  async verifyAppId(appId?: string): Promise<VerificationResult> {
    if (this.options.env?.authMode !== "required") return { isVerified: true };
    if (this.options.env.masterKey && appId === this.options.env.masterKey)
      return { isVerified: true };
    return {
      isVerified: false,
      error: "Unauthorized: Invalid or Missing App ID",
    };
  }
}

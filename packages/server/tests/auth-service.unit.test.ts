import { describe, expect, it } from "vitest";
import { AuthService } from "../src/services/auth-service";

describe("standalone host authentication", () => {
  it("preserves local host identity and session kind", async () => {
    await expect(
      new AuthService().verifyHostBootstrap({
        appId: "local-game",
        origin: "http://localhost:3000/path",
        hostSessionKind: "game",
      }),
    ).resolves.toMatchObject({
      isVerified: true,
      appId: "local-game",
      hostSessionKind: "game",
      verifiedOrigin: "http://localhost:3000",
    });
  });

  it("rejects hosted grants without an explicit authority adapter", async () => {
    await expect(
      new AuthService().verifyHostBootstrap({ hostGrant: "untrusted" }),
    ).resolves.toMatchObject({ isVerified: false });
  });

  it("requires an explicit backend instead of falling back to unauthenticated mode", () => {
    expect(
      new AuthService({
        env: { authMode: "required" },
      }).getStartupConfigurationError(),
    ).toContain("explicit authService adapter");
  });

  it("supports the explicit local test key and rejects other identities", async () => {
    const auth = new AuthService({
      env: { authMode: "required", masterKey: "local-test" },
    });
    await expect(
      auth.verifyHostBootstrap({
        appId: "local-test",
        hostSessionKind: "system",
      }),
    ).resolves.toMatchObject({ isVerified: true, hostSessionKind: "game" });
    await expect(
      auth.verifyHostBootstrap({ appId: "different" }),
    ).resolves.toMatchObject({ isVerified: false });
  });
});

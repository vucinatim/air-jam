import { describe, expect, it } from "vitest";
import {
  assessHostedReleaseOrigin,
  HostedReleaseOriginConfigurationError,
  isHostedReleaseOriginRequired,
  isHostedReleaseRequestHost,
  normalizeIncomingRequestHost,
  requireHostedReleasePublicOrigin,
  resolveConservativeCookieSite,
} from "./hosted-release-origin";

const makeEnv = (
  overrides: Record<string, string | undefined> = {},
): NodeJS.ProcessEnv => ({
  NODE_ENV: "test",
  NEXT_PUBLIC_APP_URL: "https://airjam.io",
  ...overrides,
});

describe("hosted release origin boundary", () => {
  it("disables hosted delivery when no release origin is configured", () => {
    const assessment = assessHostedReleaseOrigin(makeEnv());

    expect(assessment).toMatchObject({
      status: "disabled",
      publicOrigin: null,
      platformOrigin: "https://airjam.io",
    });
    expect(assessment.reason).toContain("delivery is disabled");
    expect(() => requireHostedReleasePublicOrigin(makeEnv())).toThrow(
      HostedReleaseOriginConfigurationError,
    );
  });

  it.each([
    "not a URL",
    "ftp://releases.example.net",
    "https://user:password@releases.example.net",
    "https://releases.example.net/path",
    "https://releases.example.net?preview=true",
    "https://releases.example.net#artifact",
  ])("rejects invalid configured origins: %s", (publicOrigin) => {
    const assessment = assessHostedReleaseOrigin(
      makeEnv({ AIRJAM_RELEASES_PUBLIC_ORIGIN: publicOrigin }),
    );

    expect(assessment.status).toBe("invalid");
    expect(assessment.publicOrigin).toBeNull();
    expect(assessment.reason).toContain("absolute http(s) origin");
  });

  it("rejects the authenticated platform origin itself", () => {
    const assessment = assessHostedReleaseOrigin(
      makeEnv({ AIRJAM_RELEASES_PUBLIC_ORIGIN: "https://airjam.io" }),
    );

    expect(assessment.status).toBe("invalid");
    expect(assessment.reason).toContain(
      "must not equal the authenticated platform origin",
    );
  });

  it.each(["https://releases.airjam.io", "https://cdn.releases.airjam.io"])(
    "rejects a release origin on the platform cookie site: %s",
    (origin) => {
      const assessment = assessHostedReleaseOrigin(
        makeEnv({ AIRJAM_RELEASES_PUBLIC_ORIGIN: origin }),
      );

      expect(assessment.status).toBe("invalid");
      expect(assessment.reason).toContain("separate cookie site");
    },
  );

  it("rejects a release origin trusted by the authentication system", () => {
    const assessment = assessHostedReleaseOrigin(
      makeEnv({
        AIRJAM_RELEASES_PUBLIC_ORIGIN: "https://airjamusercontent.net",
        BETTER_AUTH_TRUSTED_ORIGINS:
          "https://admin.example.com, https://airjamusercontent.net/",
      }),
    );

    expect(assessment.status).toBe("invalid");
    expect(assessment.reason).toContain("Better Auth trusted origins");
  });

  it("rejects a release origin covered by a Better Auth wildcard", () => {
    const assessment = assessHostedReleaseOrigin(
      makeEnv({
        AIRJAM_RELEASES_PUBLIC_ORIGIN: "https://games.airjamusercontent.net",
        BETTER_AUTH_TRUSTED_ORIGINS: "https://*.airjamusercontent.net",
      }),
    );

    expect(assessment.status).toBe("invalid");
    expect(assessment.reason).toContain("Better Auth trusted origins");
  });

  it("requires an explicit platform identity in production", () => {
    const assessment = assessHostedReleaseOrigin({
      NODE_ENV: "production",
      AIRJAM_RELEASES_PUBLIC_ORIGIN: "https://airjamusercontent.net",
    } as NodeJS.ProcessEnv);

    expect(assessment.status).toBe("invalid");
    expect(assessment.reason).toContain("explicit authenticated platform");
  });

  it("rejects build/runtime platform-origin drift", () => {
    const assessment = assessHostedReleaseOrigin(
      makeEnv({
        NODE_ENV: "production",
        AIRJAM_RELEASES_PUBLIC_ORIGIN: "https://airjamusercontent.net",
        AIRJAM_BUILT_PLATFORM_PUBLIC_ORIGIN: "https://previous.airjam.io",
      }),
    );

    expect(assessment.status).toBe("invalid");
    expect(assessment.reason).toContain(
      "baked into the release response policy",
    );
  });

  it.each([
    { NODE_ENV: "production" },
    { NODE_ENV: "test", RAILWAY_ENVIRONMENT_NAME: "production" },
  ])("rejects an HTTP release origin in production: %o", (productionEnv) => {
    const assessment = assessHostedReleaseOrigin(
      makeEnv({
        ...productionEnv,
        AIRJAM_RELEASES_PUBLIC_ORIGIN: "http://airjamusercontent.net",
      }),
    );

    expect(assessment.status).toBe("invalid");
    expect(assessment.reason).toContain("must use https in production");
  });

  it("accepts and normalizes a valid cross-site HTTPS release origin", () => {
    const env = makeEnv({
      NODE_ENV: "production",
      AIRJAM_RELEASES_PUBLIC_ORIGIN: "  https://games.airjamusercontent.net/  ",
    });

    expect(assessHostedReleaseOrigin(env)).toEqual({
      status: "ready",
      publicOrigin: "https://games.airjamusercontent.net",
      platformOrigin: "https://airjam.io",
      cookieSite: "airjamusercontent.net",
    });
    expect(requireHostedReleasePublicOrigin(env)).toBe(
      "https://games.airjamusercontent.net",
    );
    expect(isHostedReleaseRequestHost("games.airjamusercontent.net", env)).toBe(
      true,
    );
    expect(isHostedReleaseRequestHost("airjam.io", env)).toBe(false);
  });

  it("normalizes only a single valid incoming Host authority", () => {
    expect(normalizeIncomingRequestHost("Games.Example.NET:8443")).toBe(
      "games.example.net:8443",
    );
    expect(
      normalizeIncomingRequestHost("bad.example, attacker.example"),
    ).toBeNull();
    expect(normalizeIncomingRequestHost("bad host")).toBeNull();
    expect(normalizeIncomingRequestHost(null)).toBeNull();
  });

  it("permits HTTP only outside production while preserving cross-site isolation", () => {
    const assessment = assessHostedReleaseOrigin(
      makeEnv({
        AIRJAM_RELEASES_PUBLIC_ORIGIN: "http://localhost:3100",
      }),
    );

    expect(assessment).toMatchObject({
      status: "ready",
      publicOrigin: "http://localhost:3100",
      cookieSite: "localhost",
    });
  });

  it("derives the conservative cookie-site boundary deterministically", () => {
    expect(resolveConservativeCookieSite("Play.AirJam.IO.")).toBe("airjam.io");
    expect(resolveConservativeCookieSite("airjamusercontent.net")).toBe(
      "airjamusercontent.net",
    );
    expect(resolveConservativeCookieSite("localhost")).toBe("localhost");
    expect(resolveConservativeCookieSite("127.0.0.1")).toBe("127.0.0.1");
  });

  it("requires an isolated origin only in production environments", () => {
    expect(
      isHostedReleaseOriginRequired(makeEnv({ NODE_ENV: "production" })),
    ).toBe(true);
    expect(
      isHostedReleaseOriginRequired(
        makeEnv({ RAILWAY_ENVIRONMENT_NAME: "production" }),
      ),
    ).toBe(true);
    expect(
      isHostedReleaseOriginRequired(
        makeEnv({ RAILWAY_ENVIRONMENT_NAME: "preview" }),
      ),
    ).toBe(false);
  });
});

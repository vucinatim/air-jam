import { describe, expect, it } from "vitest";
import { resolveAuthSecret } from "./auth-secret";

describe("resolveAuthSecret", () => {
  it("returns the explicit BETTER_AUTH_SECRET when set", () => {
    expect(
      resolveAuthSecret({
        env: { BETTER_AUTH_SECRET: "explicit-secret" },
        isRailwayPreviewEnvironment: false,
      }),
    ).toBe("explicit-secret");
  });

  it("derives a deterministic secret on Railway previews when none is set", () => {
    const first = resolveAuthSecret({
      env: { RAILWAY_ENVIRONMENT_NAME: "air-jam-pr-42" },
      isRailwayPreviewEnvironment: true,
    });
    const second = resolveAuthSecret({
      env: { RAILWAY_ENVIRONMENT_NAME: "air-jam-pr-42" },
      isRailwayPreviewEnvironment: true,
    });

    expect(first).toBeDefined();
    expect(first).toBe(second);
    expect(first).toMatch(/^[a-f0-9]{64}$/);
  });

  it("uses different secrets for different preview environments", () => {
    expect(
      resolveAuthSecret({
        env: { RAILWAY_ENVIRONMENT_NAME: "air-jam-pr-1" },
        isRailwayPreviewEnvironment: true,
      }),
    ).not.toBe(
      resolveAuthSecret({
        env: { RAILWAY_ENVIRONMENT_NAME: "air-jam-pr-2" },
        isRailwayPreviewEnvironment: true,
      }),
    );
  });

  it("prefers the explicit BETTER_AUTH_SECRET over the preview derivation", () => {
    expect(
      resolveAuthSecret({
        env: {
          BETTER_AUTH_SECRET: "explicit-secret",
          RAILWAY_ENVIRONMENT_NAME: "air-jam-pr-42",
        },
        isRailwayPreviewEnvironment: true,
      }),
    ).toBe("explicit-secret");
  });

  it("returns undefined outside previews when nothing is set", () => {
    expect(
      resolveAuthSecret({
        env: {},
        isRailwayPreviewEnvironment: false,
      }),
    ).toBeUndefined();
  });
});

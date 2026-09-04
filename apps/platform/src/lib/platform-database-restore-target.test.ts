import { describe, expect, it } from "vitest";
import {
  assertPlatformDatabaseRestoreTarget,
  type PlatformDatabaseTarget,
} from "../../scripts/lib/platform-postgres-tooling";

const target = (
  overrides: Partial<PlatformDatabaseTarget> = {},
): PlatformDatabaseTarget => ({
  kind: "railway",
  projectId: "project-airjam",
  environmentId: "environment-recovery",
  environmentName: "recovery-drill",
  databaseServiceId: "service-recovery-postgres",
  databaseServiceName: "Postgres",
  ...overrides,
});

const source = target({
  environmentId: "environment-production",
  environmentName: "production",
  databaseServiceId: "service-production-postgres",
});

describe("platform database restore target", () => {
  it("accepts only provider-attested Railway targets with distinct identities", () => {
    expect(() =>
      assertPlatformDatabaseRestoreTarget({
        target: target(),
        sourceTarget: source,
      }),
    ).not.toThrow();

    for (const unsafe of [
      target({ environmentName: "production" }),
      target({ environmentName: "PRODUCTION" }),
      target({ environmentName: null }),
      target({ kind: "unclassified", environmentName: null }),
      target({ environmentId: source.environmentId }),
      target({ databaseServiceId: source.databaseServiceId }),
    ]) {
      expect(() =>
        assertPlatformDatabaseRestoreTarget({
          target: unsafe,
          sourceTarget: source,
        }),
      ).toThrow();
    }
  });

  it("requires explicit operator attestation for every loopback target", () => {
    const loopback = target({
      kind: "local",
      projectId: null,
      environmentId: null,
      environmentName: "local",
      databaseServiceId: null,
      databaseServiceName: null,
    });

    expect(() =>
      assertPlatformDatabaseRestoreTarget({
        target: loopback,
        sourceTarget: source,
      }),
    ).toThrow(/attest-isolated-loopback/u);
    expect(() =>
      assertPlatformDatabaseRestoreTarget({
        target: loopback,
        sourceTarget: source,
        attestIsolatedLoopback: true,
      }),
    ).not.toThrow();
  });
});

import { platformSchemaHead } from "@/db/platform-schema-head.generated";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const readSchemaCompatibility = vi.hoisted(() => vi.fn());

vi.mock("@/server/operations/platform-schema-compatibility", () => ({
  readPlatformSchemaCompatibility: readSchemaCompatibility,
}));

const ORIGINAL_ENV = { ...process.env };

const resetEnv = (): void => {
  for (const key of Object.keys(process.env)) {
    if (!(key in ORIGINAL_ENV)) {
      delete process.env[key];
    }
  }
  Object.assign(process.env, ORIGINAL_ENV);
};

beforeEach(() => {
  readSchemaCompatibility.mockResolvedValue({
    contractVersion: 1,
    status: "ready",
    compatible: true,
    expected: platformSchemaHead,
    observed: {
      createdAt: platformSchemaHead.createdAt,
      hash: platformSchemaHead.hash,
    },
    reason: null,
  });
  process.env.NODE_ENV = "production";
  process.env.NEXT_PUBLIC_AIR_JAM_PUBLIC_HOST = "https://airjam.io";
  process.env.RAILWAY_PROJECT_ID = "project-air-jam";
  process.env.RAILWAY_DEPLOYMENT_ID = "deployment-platform";
  process.env.RAILWAY_GIT_COMMIT_SHA = "0123456789abcdef";
  process.env.RAILWAY_ENVIRONMENT_NAME = "production";
  delete process.env.AIRJAM_RELEASES_PUBLIC_ORIGIN;
});

afterEach(resetEnv);

describe("platform readiness boundary", () => {
  it("fails production readiness when the hosted release origin is unavailable", async () => {
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body).toMatchObject({
      ok: false,
      service: "platform",
      deployment: {
        provider: "railway",
        environment: "production",
        deploymentId: "deployment-platform",
        revision: "0123456789abcdef",
      },
      boundaries: {
        platformRequestPolicy: {
          platformPublicOrigin: "https://airjam.io",
          isRailwayPreviewEnvironment: false,
          platformRequestHosts: ["airjam.io", "www.airjam.io"],
        },
        hostedReleaseOrigin: {
          required: true,
          status: "disabled",
          publicOrigin: null,
        },
      },
    });
  });

  it("passes production readiness only with a cross-site release origin", async () => {
    process.env.AIRJAM_RELEASES_PUBLIC_ORIGIN =
      "https://airjamusercontent.example";

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      ok: true,
      boundaries: {
        hostedReleaseOrigin: {
          required: true,
          status: "ready",
          publicOrigin: "https://airjamusercontent.example",
          reason: null,
        },
      },
    });
  });

  it("fails readiness when runtime platform identity drifts from the built response policy", async () => {
    process.env.AIRJAM_RELEASES_PUBLIC_ORIGIN =
      "https://airjamusercontent.example";
    process.env.AIRJAM_BUILT_PLATFORM_PUBLIC_ORIGIN =
      "https://previous.airjam.io";

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body).toMatchObject({
      ok: false,
      boundaries: {
        hostedReleaseOrigin: {
          required: true,
          status: "invalid",
          publicOrigin: null,
        },
      },
    });
    expect(body.boundaries.hostedReleaseOrigin.reason).toContain(
      "baked into the release response policy",
    );
  });

  it("keeps preview readiness available while release delivery stays disabled", async () => {
    process.env.RAILWAY_ENVIRONMENT_NAME = "air-jam-pr-71";

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      ok: true,
      boundaries: {
        hostedReleaseOrigin: {
          required: false,
          status: "disabled",
        },
      },
    });
  });

  it("exposes Railway environment-name drift in the machine-readable host policy", async () => {
    process.env.RAILWAY_ENVIRONMENT_NAME = "Production";
    process.env.RAILWAY_PUBLIC_DOMAIN =
      "air-jam-platform-production.up.railway.app";

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      ok: true,
      boundaries: {
        platformRequestPolicy: {
          platformPublicOrigin:
            "https://air-jam-platform-production.up.railway.app",
          isRailwayPreviewEnvironment: true,
          platformRequestHosts: ["air-jam-platform-production.up.railway.app"],
        },
        hostedReleaseOrigin: {
          required: false,
          status: "disabled",
        },
      },
    });
  });

  it("fails readiness when the database migration head is incompatible", async () => {
    process.env.AIRJAM_RELEASES_PUBLIC_ORIGIN =
      "https://airjamusercontent.example";
    readSchemaCompatibility.mockResolvedValue({
      contractVersion: 1,
      status: "behind",
      compatible: false,
      expected: platformSchemaHead,
      observed: null,
      reason: "database_schema_behind",
    });

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body).toMatchObject({
      ok: false,
      boundaries: {
        databaseSchema: {
          status: "behind",
          compatible: false,
          reason: "database_schema_behind",
        },
      },
    });
  });
});

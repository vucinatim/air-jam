import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  assertGoldenPathStagingVariableIsolation,
  resolveGoldenPathRailwayStagingTarget,
} from "../lib/golden-path-staging-target.mjs";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
);
const cliPath = path.join(repoRoot, "scripts", "repo", "cli.mjs");
const projectId = "project-airjam";
const productionEnvironmentId = "environment-production";
const stagingEnvironmentId = "environment-pr-52";
const databaseUrl =
  "postgresql://postgres:secret@postgres.railway.internal:5432/railway";

const createEnvironment = (id) => {
  const production = id === productionEnvironmentId;
  return {
    id,
    name: production ? "production" : "air-jam-pr-52",
    projectId,
    isEphemeral: !production,
    canAccess: true,
    serviceInstances: [
      {
        id: production
          ? "platform-instance-production"
          : "platform-instance-staging",
        serviceId: production ? "platform-production" : "platform-staging",
        serviceName: "air-jam-platform",
        railwayConfigFile: "/apps/platform/railway.json",
        latestDeployment: {
          id: production ? "deployment-production" : "deployment-staging",
          status: "SUCCESS",
        },
        domains: {
          customDomains: production ? [{ domain: "airjam.io" }] : [],
          serviceDomains: [
            {
              domain: production
                ? "air-jam-platform-production.up.railway.app"
                : "air-jam-platform-air-jam-pr-52.up.railway.app",
            },
          ],
        },
      },
      {
        id: production
          ? "postgres-instance-production"
          : "postgres-instance-staging",
        serviceId: "postgres",
        serviceName: "Postgres",
        railwayConfigFile: null,
      },
    ],
  };
};

const createStagingFixture = () => ({
  client: {
    getProject: async (id) => {
      assert.equal(id, projectId);
      return {
        id: projectId,
        name: "air-jam",
        primaryEnvironmentId: productionEnvironmentId,
        baseEnvironmentId: productionEnvironmentId,
      };
    },
    getEnvironment: async (id) => createEnvironment(id),
    getVariables: async ({ environmentId }) =>
      environmentId === stagingEnvironmentId
        ? {
            RAILWAY_ENVIRONMENT_ID: stagingEnvironmentId,
            RAILWAY_ENVIRONMENT_NAME: "air-jam-pr-52",
            DATABASE_URL: databaseUrl,
            AIRJAM_RELEASES_R2_BUCKET: "air-jam-pr-52-releases",
          }
        : {
            RAILWAY_ENVIRONMENT_ID: productionEnvironmentId,
            RAILWAY_ENVIRONMENT_NAME: "production",
            DATABASE_URL: databaseUrl,
            AIRJAM_RELEASES_R2_BUCKET: "air-jam-production-releases",
          },
  },
  fetchImpl: async (url) => {
    assert.equal(
      url.toString(),
      "https://air-jam-platform-air-jam-pr-52.up.railway.app/api/health",
    );
    return {
      ok: true,
      status: 200,
      json: async () => ({ ok: true, service: "platform" }),
    };
  },
});

test("primary run requires provider identities instead of a trusted-looking URL", () => {
  const help = execFileSync(
    process.execPath,
    [cliPath, "golden-path", "run-primary", "--help"],
    {
      cwd: repoRoot,
      encoding: "utf8",
    },
  );

  assert.match(help, /--railway-project/);
  assert.match(help, /--railway-environment/);
  assert.doesNotMatch(help, /--staging-url/);
});

test("primary run resolves and health-checks a Railway-isolated staging identity", async () => {
  const target = await resolveGoldenPathRailwayStagingTarget({
    projectId,
    environmentId: stagingEnvironmentId,
    ...createStagingFixture(),
  });

  assert.equal(target.provider, "railway");
  assert.equal(target.environmentId, stagingEnvironmentId);
  assert.equal(target.deploymentId, "deployment-staging");
  assert.equal(
    target.url,
    "https://air-jam-platform-air-jam-pr-52.up.railway.app",
  );
  assert.equal(target.productionAllowed, false);
  assert.deepEqual(target.isolation, {
    providerEnvironmentIdentity: true,
    postgresServiceInstanceDistinct: true,
    databaseTargetDistinctOrProviderScoped: true,
    releaseStorageBucketDistinct: true,
    publicOriginDistinct: true,
  });
});

test("primary run rejects Railway's production environment before resolution", async () => {
  const fixture = createStagingFixture();
  fixture.client.getEnvironment = async () => {
    assert.fail("production rejection must happen before environment reads");
  };

  await assert.rejects(
    resolveGoldenPathRailwayStagingTarget({
      projectId,
      environmentId: productionEnvironmentId,
      ...fixture,
    }),
    /cannot target Railway's primary or base environment/u,
  );
});

test("primary run rejects staging that shares production release storage", () => {
  const stagingEnvironment = createEnvironment(stagingEnvironmentId);
  const primaryEnvironment = createEnvironment(productionEnvironmentId);

  assert.throws(
    () =>
      assertGoldenPathStagingVariableIsolation({
        environmentId: stagingEnvironmentId,
        environment: stagingEnvironment,
        primaryEnvironment,
        stagingVariables: {
          RAILWAY_ENVIRONMENT_ID: stagingEnvironmentId,
          RAILWAY_ENVIRONMENT_NAME: stagingEnvironment.name,
          DATABASE_URL: databaseUrl,
          AIRJAM_RELEASES_R2_BUCKET: "air-jam-production-releases",
        },
        primaryVariables: {
          DATABASE_URL: databaseUrl,
          AIRJAM_RELEASES_R2_BUCKET: "air-jam-production-releases",
        },
      }),
    /release storage bucket must be distinct from production/u,
  );
});

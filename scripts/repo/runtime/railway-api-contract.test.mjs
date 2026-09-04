import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateRailwayUsageCost,
  createRailwayApiClient,
  RAILWAY_USAGE_SOURCE_VERSION,
} from "../lib/railway-api.mjs";

const createMockFetch = (handler) => async (_url, init) => {
  const body = JSON.parse(init.body);
  const payload = await handler(body);
  return {
    ok: true,
    status: 200,
    text: async () => JSON.stringify(payload),
  };
};

test("getProject flattens Railway connection fields", async () => {
  const client = createRailwayApiClient({
    token: "token",
    fetchImpl: createMockFetch((body) => {
      assert.match(body.query, /query RailwayProject/);
      return {
        data: {
          project: {
            id: "project-1",
            name: "air-jam",
            workspace: { id: "workspace-1", name: "Tim Vucina's Projects" },
            environments: {
              edges: [
                {
                  node: { id: "env-1", name: "production", isEphemeral: false },
                },
              ],
            },
            services: {
              edges: [{ node: { id: "service-1", name: "air-jam-server" } }],
            },
          },
        },
      };
    }),
  });

  const project = await client.getProject("project-1");
  assert.equal(project.name, "air-jam");
  assert.deepEqual(
    project.environments.map((entry) => entry.name),
    ["production"],
  );
  assert.deepEqual(
    project.services.map((entry) => entry.name),
    ["air-jam-server"],
  );
});

test("Railway usage evidence preserves provider measurements and derives USD", async () => {
  const actualMeasurements = [
    { measurement: "MEMORY_USAGE_GB", value: 43_200 },
    { measurement: "CPU_USAGE", value: 43_200 },
    { measurement: "NETWORK_TX_GB", value: 2 },
    { measurement: "DISK_USAGE_GB", value: 43_200 },
    { measurement: "BACKUP_USAGE_GB", value: 43_200 },
  ];
  let calls = 0;
  const client = createRailwayApiClient({
    token: "token",
    fetchImpl: createMockFetch((body) => {
      calls += 1;
      if (calls === 1) {
        assert.match(body.query, /query RailwayProject/u);
        return {
          data: {
            project: {
              id: "project-1",
              name: "air-jam",
              workspace: {
                id: "workspace-1",
                name: "Air Jam",
                customer: {
                  billingPeriod: {
                    start: "2026-08-03T00:00:00.000Z",
                    end: "2026-09-03T00:00:00.000Z",
                  },
                },
              },
              environments: { edges: [] },
              services: { edges: [] },
            },
          },
        };
      }

      assert.match(body.query, /query RailwayProjectUsageEvidence/u);
      assert.deepEqual(body.variables, {
        projectId: "project-1",
        measurements: [
          "MEMORY_USAGE_GB",
          "CPU_USAGE",
          "NETWORK_TX_GB",
          "DISK_USAGE_GB",
          "BACKUP_USAGE_GB",
        ],
        startDate: "2026-08-03T00:00:00.000Z",
        endDate: "2026-09-03T00:00:00.000Z",
      });
      return {
        data: {
          usage: actualMeasurements,
          estimatedUsage: actualMeasurements.map((entry) => ({
            measurement: entry.measurement,
            estimatedValue: entry.value * 2,
          })),
        },
      };
    }),
  });

  const evidence = await client.getProjectUsageEvidence({
    projectId: "project-1",
    observedAt: new Date("2026-08-29T20:00:00.000Z"),
  });

  assert.equal(evidence.actualAmountMicrousd, 30_400_000);
  assert.equal(evidence.projectedAmountMicrousd, 60_800_000);
  assert.equal(evidence.sourceVersion, RAILWAY_USAGE_SOURCE_VERSION);
  assert.equal(evidence.scope.id, "project-1");
  assert.equal(evidence.observedAt, "2026-08-29T20:00:00.000Z");
  assert.deepEqual(evidence.measurements.actual, actualMeasurements);
});

test("Railway usage cost rejects unknown or invalid measurements", () => {
  assert.throws(
    () =>
      calculateRailwayUsageCost([{ measurement: "NETWORK_RX_GB", value: 1 }]),
    /Unsupported Railway usage measurement/u,
  );
  assert.throws(
    () =>
      calculateRailwayUsageCost([
        { measurement: "MEMORY_USAGE_GB", value: Number.NaN },
      ]),
    /non-negative finite number/u,
  );
  assert.throws(
    () =>
      calculateRailwayUsageCost([
        { measurement: "MEMORY_USAGE_GB", value: 1 },
        { measurement: "MEMORY_USAGE_GB", value: 2 },
      ]),
    /returned more than once/u,
  );
});

test("Railway usage evidence rejects malformed provider results", async () => {
  let calls = 0;
  const client = createRailwayApiClient({
    token: "token",
    fetchImpl: createMockFetch(() => {
      calls += 1;
      return calls === 1
        ? {
            data: {
              project: {
                id: "project-1",
                name: "air-jam",
                workspace: {
                  id: "workspace-1",
                  name: "Air Jam",
                  customer: {
                    billingPeriod: {
                      start: "2026-08-03T00:00:00.000Z",
                      end: "2026-09-03T00:00:00.000Z",
                    },
                  },
                },
                environments: { edges: [] },
                services: { edges: [] },
              },
            },
          }
        : { data: { usage: null, estimatedUsage: [] } };
    }),
  });

  await assert.rejects(
    client.getProjectUsageEvidence({ projectId: "project-1" }),
    /actual usage must be an array/u,
  );
});

test("resolveServicePublicDomain prefers custom domains, then service domains, then deployment URLs", async () => {
  const client = createRailwayApiClient({
    token: "token",
    fetchImpl: createMockFetch(() => ({
      data: {
        environment: {
          id: "env-1",
          name: "preview-pr-42",
          serviceInstances: {
            edges: [
              {
                node: {
                  serviceId: "service-1",
                  serviceName: "air-jam-server",
                  domains: {
                    customDomains: [{ domain: "api.airjam.io" }],
                    serviceDomains: [
                      { domain: "air-jam-server-preview-pr-42.up.railway.app" },
                    ],
                  },
                  latestDeployment: {
                    staticUrl: "fallback.up.railway.app",
                    url: "https://fallback.up.railway.app",
                  },
                },
              },
            ],
          },
        },
      },
    })),
  });

  const domain = await client.resolveServicePublicDomain({
    environmentId: "env-1",
    serviceName: "air-jam-server",
  });
  assert.equal(domain, "api.airjam.io");
});

test("waitForDeployment returns success once the deployment reaches a terminal success state", async () => {
  let calls = 0;
  const client = createRailwayApiClient({
    token: "token",
    fetchImpl: createMockFetch(() => {
      calls += 1;
      return {
        data: {
          deployment: {
            id: "deployment-1",
            status: calls === 1 ? "BUILDING" : "SUCCESS",
            url: null,
            staticUrl: "service.up.railway.app",
          },
        },
      };
    }),
  });

  const result = await client.waitForDeployment({
    deploymentId: "deployment-1",
    retries: 2,
    retryDelayMs: 0,
  });

  assert.equal(result.ok, true);
  assert.equal(result.deployment.status, "SUCCESS");
  assert.equal(calls, 2);
});

test("Railway recovery helpers expose backup policy and exact deployment actions", async () => {
  const observed = [];
  const client = createRailwayApiClient({
    token: "token",
    fetchImpl: createMockFetch((body) => {
      observed.push(body);
      if (body.query.includes("RailwayVolumeBackups")) {
        return {
          data: {
            volumeInstanceBackupList: [
              {
                id: "backup-1",
                name: "daily",
                createdAt: "2026-09-04T00:00:00.000Z",
                expiresAt: "2026-09-10T00:00:00.000Z",
                usedMB: 1,
                referencedMB: 2,
              },
            ],
          },
        };
      }
      if (body.query.includes("RailwayVolumeBackupSchedules")) {
        return {
          data: {
            volumeInstanceBackupScheduleList: [
              {
                id: "schedule-1",
                name: "daily",
                cron: "0 0 * * *",
                kind: "DAILY",
                retentionSeconds: 518400,
                createdAt: "2026-09-04T00:00:00.000Z",
              },
            ],
          },
        };
      }
      if (body.query.includes("RailwayVolumeBackupScheduleUpdate")) {
        return { data: { volumeInstanceBackupScheduleUpdate: true } };
      }
      if (body.query.includes("RailwayDeployments")) {
        return {
          data: {
            deployments: {
              edges: [
                {
                  node: {
                    id: "deployment-old",
                    status: "REMOVED",
                    serviceId: "service-1",
                    environmentId: "environment-1",
                    meta: { commitHash: "abc123" },
                    canRedeploy: true,
                    canRollback: true,
                  },
                },
              ],
            },
          },
        };
      }
      if (body.query.includes("RailwayDeploymentRollback")) {
        return { data: { deploymentRollback: true } };
      }
      throw new Error(`Unexpected query: ${body.query}`);
    }),
  });

  assert.equal(
    (await client.listVolumeBackups({ volumeInstanceId: "volume-1" }))[0].id,
    "backup-1",
  );
  assert.equal(
    (
      await client.listVolumeBackupSchedules({
        volumeInstanceId: "volume-1",
      })
    )[0].kind,
    "DAILY",
  );
  assert.equal(
    await client.updateVolumeBackupSchedules({
      volumeInstanceId: "volume-1",
      kinds: ["DAILY", "WEEKLY"],
    }),
    true,
  );
  const deployments = await client.listDeployments({
    projectId: "project-1",
    environmentId: "environment-1",
    serviceId: "service-1",
  });
  assert.equal(deployments[0].canRollback, true);
  assert.equal(deployments[0].meta.commitHash, "abc123");
  const rollback = await client.rollbackDeployment({
    deploymentId: "deployment-old",
  });
  assert.equal(rollback, true);
  assert.doesNotMatch(
    observed[4].query,
    /deploymentRollback\(id: \$id\)\s*\{/u,
  );
  assert.match(
    observed[4].query,
    /mutation RailwayDeploymentRollback[\s\S]*deploymentRollback\(id: \$id\)\s*\}/u,
  );
  assert.deepEqual(observed[2].variables, {
    volumeInstanceId: "volume-1",
    kinds: ["DAILY", "WEEKLY"],
  });
  assert.deepEqual(observed[4].variables, { id: "deployment-old" });
});

test("Railway waits for a new service deployment matching the exact target", async () => {
  let reads = 0;
  const client = createRailwayApiClient({
    token: "token",
    fetchImpl: createMockFetch((body) => {
      assert.match(body.query, /query RailwayEnvironment/u);
      reads += 1;
      if (reads === 1) throw new Error("transient provider read failure");
      const deploymentId =
        reads === 2 ? "deployment-unrelated" : "deployment-rollback";
      const revision =
        deploymentId === "deployment-rollback"
          ? "revision-target"
          : "revision-unrelated";
      return {
        data: {
          environment: {
            id: "environment-1",
            name: "production",
            projectId: "project-1",
            serviceInstances: {
              edges: [
                {
                  node: {
                    serviceId: "service-1",
                    serviceName: "platform",
                    railwayConfigFile: "/railway.json",
                    latestDeployment: {
                      id: deploymentId,
                      status: "INITIALIZING",
                      serviceId: "service-1",
                      environmentId: "environment-1",
                      meta: {
                        commitHash: revision,
                        imageDigest: `sha256:${revision}`,
                      },
                      canRedeploy: false,
                      canRollback: false,
                    },
                    domains: { customDomains: [], serviceDomains: [] },
                  },
                },
              ],
            },
            volumeInstances: { edges: [] },
          },
        },
      };
    }),
  });

  const result = await client.waitForServiceDeployment({
    environmentId: "environment-1",
    serviceId: "service-1",
    matches: (candidate) =>
      candidate.id !== "deployment-current" &&
      candidate.meta.commitHash === "revision-target",
    retries: 3,
    retryDelayMs: 0,
  });

  assert.equal(result.matched, true);
  assert.equal(result.deployment.id, "deployment-rollback");
  assert.equal(result.attempt, 3);
});

test("Railway deployment matching reports timeout and the last observation", async () => {
  const client = createRailwayApiClient({
    token: "token",
    fetchImpl: createMockFetch(() => ({
      data: {
        environment: {
          id: "environment-1",
          name: "production",
          projectId: "project-1",
          serviceInstances: {
            edges: [
              {
                node: {
                  serviceId: "service-1",
                  serviceName: "platform",
                  latestDeployment: {
                    id: "deployment-unrelated",
                    status: "SUCCESS",
                    serviceId: "service-1",
                    environmentId: "environment-1",
                    meta: { commitHash: "revision-unrelated" },
                  },
                  domains: { customDomains: [], serviceDomains: [] },
                },
              },
            ],
          },
          volumeInstances: { edges: [] },
        },
      },
    })),
  });

  const result = await client.waitForServiceDeployment({
    environmentId: "environment-1",
    serviceId: "service-1",
    matches: (candidate) =>
      candidate.id !== "deployment-current" &&
      candidate.meta.commitHash === "revision-target",
    retries: 1,
    retryDelayMs: 0,
  });

  assert.equal(result.matched, false);
  assert.equal(result.timeout, true);
  assert.equal(result.deployment.id, "deployment-unrelated");
  assert.equal(result.attempt, 1);
});

test("Railway deployment matching reports a missing service", async () => {
  const client = createRailwayApiClient({
    token: "token",
    fetchImpl: createMockFetch(() => ({
      data: {
        environment: {
          id: "environment-1",
          name: "production",
          projectId: "project-1",
          serviceInstances: { edges: [] },
          volumeInstances: { edges: [] },
        },
      },
    })),
  });

  const result = await client.waitForServiceDeployment({
    environmentId: "environment-1",
    serviceId: "service-missing",
    matches: () => false,
    retries: 1,
    retryDelayMs: 0,
  });

  assert.equal(result.matched, false);
  assert.match(result.error, /service-missing/u);
});

test("Railway API requests have an absolute aborting deadline", async () => {
  let aborted = false;
  const client = createRailwayApiClient({
    token: "token",
    requestTimeoutMs: 20,
    fetchImpl: async (_url, init) =>
      await new Promise((_resolve) => {
        init.signal.addEventListener("abort", () => {
          aborted = true;
        });
      }),
  });

  await assert.rejects(client.getProject("project-1"), (error) => {
    assert.equal(error.name, "RailwayApiError");
    assert.match(error.message, /timed out after 20ms/);
    return true;
  });
  assert.equal(aborted, true);
});

test("Railway API rejects invalid request deadlines before making a request", () => {
  assert.throws(
    () =>
      createRailwayApiClient({
        token: "token",
        requestTimeoutMs: 0,
      }),
    /positive finite number/,
  );
});

import assert from "node:assert/strict";
import test from "node:test";
import { createRailwayApiClient } from "../lib/railway-api.mjs";

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
                { node: { id: "env-1", name: "production", isEphemeral: false } },
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
  assert.deepEqual(project.environments.map((entry) => entry.name), [
    "production",
  ]);
  assert.deepEqual(project.services.map((entry) => entry.name), [
    "air-jam-server",
  ]);
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
                    customDomains: [{ domain: "full-pr-42.preview.airjam.io" }],
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
  assert.equal(domain, "full-pr-42.preview.airjam.io");
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

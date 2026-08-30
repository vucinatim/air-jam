import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  resolveRailwayPlatformDatabaseUrl,
  resolveRailwayPlatformDatabaseUrlWithCli,
} from "../commands/platform.mjs";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
);
const cliPath = path.join(repoRoot, "scripts", "repo", "cli.mjs");

const readHelp = (...args) =>
  execFileSync(process.execPath, [cliPath, ...args, "--help"], {
    cwd: repoRoot,
    encoding: "utf8",
  });

test("platform telemetry is a discoverable repo CLI surface", () => {
  const platformHelp = readHelp("platform");
  const telemetryHelp = readHelp("platform", "telemetry");

  assert.match(platformHelp, /telemetry/);
  assert.match(telemetryHelp, /overview/);
  assert.match(telemetryHelp, /health/);
  assert.match(telemetryHelp, /rebuild/);
  assert.match(telemetryHelp, /retain/);
});

test("telemetry reads expose JSON and mutations require explicit apply", () => {
  const overviewHelp = readHelp("platform", "telemetry", "overview");
  const healthHelp = readHelp("platform", "telemetry", "health");
  const rebuildHelp = readHelp("platform", "telemetry", "rebuild");
  const retainHelp = readHelp("platform", "telemetry", "retain");

  assert.match(overviewHelp, /--days/);
  assert.match(overviewHelp, /--environment/);
  assert.match(overviewHelp, /--json/);
  assert.match(overviewHelp, /--railway-environment/);
  assert.match(overviewHelp, /--railway-project/);
  assert.match(healthHelp, /--json/);
  assert.match(rebuildHelp, /--apply/);
  assert.match(rebuildHelp, /read-only\s+preview/);
  assert.match(retainHelp, /--apply/);
  assert.match(retainHelp, /read-only\s+preview/);
});

test("remote telemetry resolves PostgreSQL without exposing a second operator path", async () => {
  const calls = [];
  const databaseUrl = resolveRailwayPlatformDatabaseUrlWithCli(
    { environmentId: "environment-1", projectId: "project-1" },
    (args, operation) => {
      calls.push({ args, operation });
      if (operation === "service discovery") {
        return [
          {
            id: "service-platform",
            name: "air-jam-platform",
            source: { image: null },
          },
          {
            id: "service-postgres",
            name: "Postgres",
            source: { image: "postgres:17" },
          },
        ];
      }
      return {
        DATABASE_PUBLIC_URL: "postgresql://public-connection",
        DATABASE_URL: "postgresql://private-connection",
      };
    },
  );

  assert.equal(databaseUrl, "postgresql://public-connection");
  assert.equal(calls.length, 2);
  assert.deepEqual(calls[1].args.slice(-3), [
    "--service",
    "service-postgres",
    "--json",
  ]);

  const fallbackUrl = await resolveRailwayPlatformDatabaseUrl(
    { environmentId: "environment-1", projectId: "project-1" },
    {
      createClient: () => ({
        getEnvironment: async () => {
          throw new Error("project token cannot inspect preview");
        },
      }),
      resolveWithCli: ({ environmentId, projectId }) => {
        assert.equal(environmentId, "environment-1");
        assert.equal(projectId, "project-1");
        return "postgresql://oauth-cli-fallback";
      },
    },
  );
  assert.equal(fallbackUrl, "postgresql://oauth-cli-fallback");
});

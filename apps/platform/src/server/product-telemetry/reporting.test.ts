import { describe, expect, it } from "vitest";
import { buildProductTelemetryOpsOverview } from "./reporting";

describe("product telemetry ops reporting", () => {
  it("builds a gap-free view while preserving each authority plane", () => {
    const overview = buildProductTelemetryOpsOverview({
      days: 3,
      deploymentEnvironment: "production",
      now: new Date("2026-08-26T12:00:00.000Z"),
      rows: {
        dailyEvents: [
          {
            bucketDate: "2026-08-24",
            kind: "page_view",
            actorClass: "human",
            count: "3",
          },
          {
            bucketDate: "2026-08-24",
            kind: "page_view",
            actorClass: "bot",
            count: "2",
          },
          {
            bucketDate: "2026-08-25",
            kind: "quick_start_opened",
            actorClass: "human",
            count: "5",
          },
          {
            bucketDate: "2026-08-26",
            kind: "agent_resource_requested",
            actorClass: "agent",
            count: "4",
          },
        ],
        dailySessions: [
          { bucketDate: "2026-08-24", count: 2 },
          { bucketDate: "2026-08-25", count: 1 },
        ],
        windowSessions: 2,
        topPages: [{ surface: "landing", pageKey: "/", count: "5" }],
        referrers: [{ source: "ai", count: "3" }],
        intents: [{ kind: "quick_start_opened", count: "5" }],
        agentResources: [{ resource: "llms_txt", count: "4" }],
        agentFamilies: [{ family: "anthropic", count: "4" }],
        platformLifecycle: {
          accountsCreated: 1,
          gamesCreated: 2,
          releasesCreated: 3,
          releasesPublished: 1,
        },
        runtimeUsage: {
          runtimeSessions: 7,
          gameSessions: "6",
          eligiblePlaytimeSeconds: "3600",
        },
      },
    });

    expect(overview.window).toMatchObject({
      days: 3,
      deploymentEnvironment: "production",
      from: new Date("2026-08-24T00:00:00.000Z"),
    });
    expect(overview.productTelemetry.authority).toBe(
      "approximate_product_telemetry",
    );
    expect(overview.productTelemetry.totals).toEqual({
      pageViews: 5,
      anonymousSessions: 2,
      intentEvents: 5,
      agentResourceRequests: 4,
    });
    expect(overview.productTelemetry.daily).toHaveLength(3);
    expect(overview.productTelemetry.daily[2]).toMatchObject({
      bucketDate: "2026-08-26",
      pageViews: 0,
      anonymousSessions: 0,
      agentResourceRequests: 4,
      trafficByActor: {
        human: 0,
        bot: 0,
        agent: 4,
        unknown: 0,
      },
    });
    expect(overview.productTelemetry.trafficByActor).toContainEqual({
      actorClass: "human",
      count: 3,
    });
    expect(overview.productTelemetry.intents).toContainEqual({
      kind: "scaffold_command_copied",
      count: 0,
    });
    expect(overview.productTelemetry.agentResources).toContainEqual({
      resource: "llms_txt",
      requests: 4,
    });
    expect(overview.platformLifecycle).toEqual({
      authority: "authoritative_platform_database",
      accountsCreated: 1,
      gamesCreated: 2,
      releasesCreated: 3,
      releasesPublished: 1,
    });
    expect(overview.runtimeUsage).toEqual({
      authority: "authoritative_runtime_usage",
      runtimeSessions: 7,
      gameSessions: 6,
      eligiblePlaytimeSeconds: 3600,
    });
  });
});

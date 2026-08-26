import { describe, expect, it } from "vitest";
import { buildProductTelemetryHealth } from "./operations";

describe("product telemetry operations", () => {
  it("builds a stable machine-readable health contract", () => {
    const health = buildProductTelemetryHealth({
      now: new Date("2026-08-26T12:00:00.000Z"),
      rows: {
        rawEvents: {
          count: "12",
          oldestReceivedAt: new Date("2026-08-20T10:00:00.000Z"),
          latestReceivedAt: new Date("2026-08-26T11:59:00.000Z"),
        },
        dailyMetrics: {
          count: 8,
          projectedEventCount: "12",
          earliestBucketDate: "2026-08-20",
          latestBucketDate: "2026-08-26",
        },
        sessionContributions: {
          count: "5",
          earliestBucketDate: "2026-08-20",
          latestBucketDate: "2026-08-26",
        },
        retentionEligible: {
          rawEvents: "2",
          sessionContributions: 1,
        },
      },
    });

    expect(health).toEqual({
      eventSchemaVersion: 1,
      status: "healthy",
      checkedAt: new Date("2026-08-26T12:00:00.000Z"),
      storage: {
        rawEvents: {
          count: 12,
          oldestReceivedAt: new Date("2026-08-20T10:00:00.000Z"),
          latestReceivedAt: new Date("2026-08-26T11:59:00.000Z"),
        },
        dailyMetrics: {
          count: 8,
          projectedEventCount: 12,
          earliestBucketDate: "2026-08-20",
          latestBucketDate: "2026-08-26",
        },
        sessionContributions: {
          count: 5,
          earliestBucketDate: "2026-08-20",
          latestBucketDate: "2026-08-26",
        },
      },
      retention: {
        rawEventDays: 90,
        sessionContributionDays: 90,
        rawCutoff: new Date("2026-05-28T12:00:00.000Z"),
        sessionContributionCutoffDate: "2026-05-28",
        eligibleRawEvents: 2,
        eligibleSessionContributions: 1,
      },
    });
  });
});

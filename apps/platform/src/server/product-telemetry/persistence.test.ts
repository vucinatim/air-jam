import { describe, expect, it } from "vitest";
import {
  applyProductTelemetryRetention,
  projectIncrementalProductTelemetryEvents,
  type ProductTelemetryProjectionWriter,
} from "./persistence";
import type { NormalizedProductTelemetryEvent } from "./types";

const makeEvent = (
  overrides: Partial<NormalizedProductTelemetryEvent> = {},
): NormalizedProductTelemetryEvent => ({
  id: "6b1e5658-46ca-42d1-8a7f-c0961a628b75",
  schemaVersion: 1,
  kind: "page_view",
  occurredAt: new Date("2026-08-26T12:00:00.000Z"),
  receivedAt: new Date("2026-08-26T12:00:01.000Z"),
  anonymousSessionId: "dc27928e-48af-4dd0-ab05-f857e473104c",
  surface: "docs",
  pageKey: "/docs",
  actorClass: "human",
  agentFamily: null,
  referrerSource: "direct",
  referrerHost: null,
  campaignSource: null,
  campaignMedium: null,
  campaignName: null,
  placement: null,
  externalTarget: null,
  agentResource: null,
  deploymentEnvironment: "production",
  deploymentId: "production",
  ...overrides,
});

describe("incremental product telemetry persistence orchestration", () => {
  it("does not re-project event IDs and counts a session once per dimension", async () => {
    const rawEventIds = new Set<string>();
    const contributionIds = new Set<string>();
    const metricEventCounts = new Map<string, number>();
    const metricSessionCounts = new Map<string, number>();

    const writer: ProductTelemetryProjectionWriter = {
      async insertRawEvent(event) {
        if (rawEventIds.has(event.id)) {
          return false;
        }
        rawEventIds.add(event.id);
        return true;
      },
      async upsertMetricEvent(metric) {
        metricEventCounts.set(
          metric.id,
          (metricEventCounts.get(metric.id) ?? 0) + 1,
        );
      },
      async insertSessionContribution(contribution) {
        if (contributionIds.has(contribution.id)) {
          return false;
        }
        contributionIds.add(contribution.id);
        return true;
      },
      async incrementMetricSessionCount(metricId) {
        metricSessionCounts.set(
          metricId,
          (metricSessionCounts.get(metricId) ?? 0) + 1,
        );
      },
    };

    const first = makeEvent();
    const repeatInSession = makeEvent({
      id: "d4d49b32-b0aa-477a-a456-bca457f27d5b",
      occurredAt: new Date("2026-08-26T12:05:00.000Z"),
    });
    const firstResult = await projectIncrementalProductTelemetryEvents(
      [first, repeatInSession],
      writer,
    );
    const replayResult = await projectIncrementalProductTelemetryEvents(
      [first],
      writer,
    );

    expect(firstResult).toEqual({ accepted: 2, duplicates: 0 });
    expect(replayResult).toEqual({ accepted: 0, duplicates: 1 });
    expect(rawEventIds).toHaveLength(2);
    expect([...metricEventCounts.values()]).toEqual([2]);
    expect([...metricSessionCounts.values()]).toEqual([1]);
    expect(contributionIds).toHaveLength(1);
  });

  it("rejects fractional retention periods instead of silently rounding", async () => {
    await expect(
      applyProductTelemetryRetention({ rawRetentionDays: 1.5 }),
    ).rejects.toThrow("positive whole days");
    await expect(
      applyProductTelemetryRetention({
        sessionContributionRetentionDays: 0,
      }),
    ).rejects.toThrow("positive whole days");
  });
});

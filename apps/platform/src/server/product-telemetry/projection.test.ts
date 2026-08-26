import { describe, expect, it } from "vitest";
import {
  createProductTelemetryProjection,
  rebuildProductTelemetryProjectionRows,
} from "./projection";
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

describe("product telemetry projection", () => {
  it("builds stable metric and session-contribution IDs", () => {
    const first = createProductTelemetryProjection(makeEvent());
    const second = createProductTelemetryProjection(makeEvent());

    expect(first.metric.id).toBe(second.metric.id);
    expect(first.contribution?.id).toBe(second.contribution?.id);
    expect(first.metric.id).toMatch(/^ptm_[a-f0-9]{64}$/);
  });

  it("deduplicates event replays and session contributions deterministically", () => {
    const first = makeEvent();
    const replay = { ...first };
    const repeatSession = makeEvent({
      id: "d4d49b32-b0aa-477a-a456-bca457f27d5b",
      occurredAt: new Date("2026-08-26T13:00:00.000Z"),
    });
    const secondSession = makeEvent({
      id: "680d4517-dd1f-4a47-8f3d-fca82efb9b09",
      anonymousSessionId: "e2f765f0-0d7a-4595-805d-f110445a76ce",
      occurredAt: new Date("2026-08-26T14:00:00.000Z"),
    });

    const projection = rebuildProductTelemetryProjectionRows([
      secondSession,
      replay,
      repeatSession,
      first,
    ]);

    expect(projection.metrics).toHaveLength(1);
    expect(projection.metrics[0]).toMatchObject({
      eventCount: 3,
      anonymousSessionCount: 2,
      firstOccurredAt: new Date("2026-08-26T12:00:00.000Z"),
      lastOccurredAt: new Date("2026-08-26T14:00:00.000Z"),
    });
    expect(projection.contributions).toHaveLength(2);
  });

  it("keeps the same anonymous session separate across reporting dimensions", () => {
    const projection = rebuildProductTelemetryProjectionRows([
      makeEvent(),
      makeEvent({
        id: "196a766c-bbd1-4e53-91b2-de097440a11f",
        kind: "quick_start_opened",
        placement: "landing_hero",
      }),
    ]);

    expect(projection.metrics).toHaveLength(2);
    expect(projection.contributions).toHaveLength(2);
    expect(
      projection.metrics.every((metric) => metric.anonymousSessionCount === 1),
    ).toBe(true);
  });
});

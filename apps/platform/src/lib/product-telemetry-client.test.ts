import {
  createProductTelemetryClient,
  normalizeTelemetryCampaign,
  normalizeTelemetryPathname,
  normalizeTelemetryReferrerHost,
} from "@/lib/product-telemetry-client";
import {
  PRODUCT_TELEMETRY_MAX_REQUEST_BYTES,
  type ProductTelemetryBrowserEvent,
} from "@/lib/product-telemetry-contract";
import { describe, expect, it } from "vitest";

const UUIDS = Array.from(
  { length: 64 },
  (_, index) =>
    `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
);

const createHarness = () => {
  const batches: Array<{
    events: ProductTelemetryBrowserEvent[];
    preferBeacon: boolean;
  }> = [];
  const scheduled = new Set<() => void>();
  let uuidIndex = 0;

  const client = createProductTelemetryClient({
    batchDelayMs: 25,
    createUuid: () => UUIDS[uuidIndex++],
    now: () => new Date("2026-08-26T12:00:00.000Z"),
    readBrowserContext: () => ({
      pathname: "/",
      search:
        "?utm_source=Claude&utm_medium=AI_Chat&utm_campaign=Launch-1&email=private@example.com",
      referrer: "https://WWW.Claude.AI/share/private-path?secret=value",
    }),
    sendBatch: (events, preferBeacon) => {
      batches.push({ events, preferBeacon });
    },
    setTimer: (callback) => {
      scheduled.add(callback);
      return callback as unknown as ReturnType<typeof setTimeout>;
    },
    clearTimer: (timer) => {
      scheduled.delete(timer as unknown as () => void);
    },
  });

  const runScheduledFlush = () => {
    const callback = scheduled.values().next().value;
    if (callback) {
      scheduled.delete(callback);
      callback();
    }
  };

  return { batches, client, runScheduledFlush, scheduled };
};

describe("product telemetry browser normalization", () => {
  it("retains only normalized allowlisted campaign dimensions", () => {
    expect(
      normalizeTelemetryCampaign(
        "?utm_source=Claude&utm_medium=AI_Chat&utm_campaign=Launch-1&email=private@example.com",
      ),
    ).toEqual({
      source: "claude",
      medium: "ai_chat",
      campaign: "launch-1",
    });
    expect(
      normalizeTelemetryCampaign(
        "?utm_source=not%20allowed&utm_medium=%F0%9F%98%80&gclid=secret",
      ),
    ).toBeUndefined();
  });

  it("reduces referrers to a normalized http(s) hostname", () => {
    expect(
      normalizeTelemetryReferrerHost(
        "https://WWW.Claude.AI./share/private-path?secret=value",
      ),
    ).toBe("www.claude.ai");
    expect(
      normalizeTelemetryReferrerHost("javascript:alert(1)"),
    ).toBeUndefined();
    expect(normalizeTelemetryReferrerHost("not a url")).toBeUndefined();
  });

  it("uses bounded query-free canonical pathnames", () => {
    expect(normalizeTelemetryPathname("/docs/quick-start/?secret=value")).toBe(
      "/docs/quick-start",
    );
    expect(normalizeTelemetryPathname("/".repeat(181))).toBeUndefined();
    expect(normalizeTelemetryPathname("/private value")).toBeUndefined();
  });
});

describe("product telemetry browser client", () => {
  it("batches typed events under one ephemeral in-memory session", () => {
    const { batches, client, runScheduledFlush, scheduled } = createHarness();

    client.trackPageView("/");
    client.trackQuickStartOpened("landing_hero");
    client.trackScaffoldCommandCopied("landing_hero");
    client.trackExternalLinkOpened("footer", "npm");

    expect(batches).toHaveLength(0);
    expect(scheduled.size).toBe(1);
    runScheduledFlush();

    expect(batches).toHaveLength(1);
    expect(batches[0]?.events.map((event) => event.kind)).toEqual([
      "page_view",
      "quick_start_opened",
      "scaffold_command_copied",
      "external_link_opened",
    ]);
    expect(
      new Set(batches[0]?.events.map((event) => event.anonymousSessionId)).size,
    ).toBe(1);
    expect(batches[0]?.events[0]).toMatchObject({
      pathname: "/",
      referrerHost: "www.claude.ai",
      campaign: {
        source: "claude",
        medium: "ai_chat",
        campaign: "launch-1",
      },
    });
    expect(batches[0]?.events[3]).toMatchObject({
      kind: "external_link_opened",
      placement: "footer",
      target: "npm",
    });
    expect(JSON.stringify(batches)).not.toContain("private-path");
    expect(JSON.stringify(batches)).not.toContain("private@example.com");
  });

  it("deduplicates only consecutive App Router page observations", () => {
    const { batches, client } = createHarness();

    client.trackPageView("/");
    client.trackPageView("/");
    client.trackPageView("/docs");
    client.trackPageView("/");
    client.flush();

    expect(batches[0]?.events.map((event) => event.pathname)).toEqual([
      "/",
      "/docs",
      "/",
    ]);
  });

  it("marks navigation flushes for beacon delivery and swallows transport errors", () => {
    const { batches, client } = createHarness();
    client.trackArcadeEntered("landing_final");
    client.flush(true);

    expect(batches[0]?.preferBeacon).toBe(true);

    const failingClient = createProductTelemetryClient({
      createUuid: (() => {
        let index = 0;
        return () => UUIDS[index++];
      })(),
      now: () => new Date("2026-08-26T12:00:00.000Z"),
      readBrowserContext: () => ({
        pathname: "/",
        search: "",
        referrer: "",
      }),
      sendBatch: () => {
        throw new Error("offline");
      },
      setTimer: (callback) =>
        callback as unknown as ReturnType<typeof setTimeout>,
      clearTimer: () => undefined,
    });

    expect(() => {
      failingClient.trackPageView("/");
      failingClient.flush();
    }).not.toThrow();
  });

  it("keeps every transport batch within the ingestion byte contract", () => {
    const batches: ProductTelemetryBrowserEvent[][] = [];
    let uuidIndex = 0;
    const maxCampaignValue = "a".repeat(64);
    const client = createProductTelemetryClient({
      createUuid: () => UUIDS[uuidIndex++],
      now: () => new Date("2026-08-26T12:00:00.000Z"),
      readBrowserContext: () => ({
        pathname: `/${"a".repeat(179)}`,
        search: `?utm_source=${maxCampaignValue}&utm_medium=${maxCampaignValue}&utm_campaign=${maxCampaignValue}`,
        referrer: `https://${["a".repeat(60), "b".repeat(60), "c".repeat(60), "d".repeat(60)].join(".")}.com/private`,
      }),
      sendBatch: (events) => batches.push(events),
      setTimer: (callback) =>
        callback as unknown as ReturnType<typeof setTimeout>,
      clearTimer: () => undefined,
    });

    for (let index = 0; index < 20; index += 1) {
      client.trackQuickStartOpened("landing_hero");
    }

    expect(batches.flat()).toHaveLength(20);
    expect(batches.length).toBeGreaterThan(1);
    for (const events of batches) {
      expect(JSON.stringify({ events }).length).toBeLessThanOrEqual(
        PRODUCT_TELEMETRY_MAX_REQUEST_BYTES,
      );
    }
  });
});

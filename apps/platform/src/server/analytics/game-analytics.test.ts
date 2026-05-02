import { describe, expect, it } from "vitest";
import {
  buildGameAnalyticsOverview,
  type GameAnalyticsDailyRow,
} from "./game-analytics";

describe("game analytics read model", () => {
  it("fills missing UTC day buckets and computes overview totals", () => {
    const rows: GameAnalyticsDailyRow[] = [
      {
        bucketDate: "2026-03-25",
        sessionCount: 2,
        totalGameActiveSeconds: 900,
        totalControllerSeconds: 1200,
        totalRawEligiblePlaytimeSeconds: 720,
        totalEligiblePlaytimeSeconds: 600,
        guardedSessionCount: 1,
        peakConcurrentControllers: 3,
        lastActivityAt: new Date("2026-03-25T18:00:00.000Z"),
      },
      {
        bucketDate: "2026-03-27",
        sessionCount: 1,
        totalGameActiveSeconds: 300,
        totalControllerSeconds: 300,
        totalRawEligiblePlaytimeSeconds: 240,
        totalEligiblePlaytimeSeconds: 240,
        guardedSessionCount: 0,
        peakConcurrentControllers: 1,
        lastActivityAt: new Date("2026-03-27T09:15:00.000Z"),
      },
    ];

    const overview = buildGameAnalyticsOverview(
      rows,
      3,
      new Date("2026-03-27T12:00:00.000Z"),
    );

    expect(overview.daily).toEqual([
      {
        bucketDate: "2026-03-25",
        sessionCount: 2,
        totalGameActiveSeconds: 900,
        totalControllerSeconds: 1200,
        totalRawEligiblePlaytimeSeconds: 720,
        totalEligiblePlaytimeSeconds: 600,
        guardedSessionCount: 1,
        peakConcurrentControllers: 3,
        lastActivityAt: new Date("2026-03-25T18:00:00.000Z"),
      },
      {
        bucketDate: "2026-03-26",
        sessionCount: 0,
        totalGameActiveSeconds: 0,
        totalControllerSeconds: 0,
        totalRawEligiblePlaytimeSeconds: 0,
        totalEligiblePlaytimeSeconds: 0,
        guardedSessionCount: 0,
        peakConcurrentControllers: 0,
        lastActivityAt: null,
      },
      {
        bucketDate: "2026-03-27",
        sessionCount: 1,
        totalGameActiveSeconds: 300,
        totalControllerSeconds: 300,
        totalRawEligiblePlaytimeSeconds: 240,
        totalEligiblePlaytimeSeconds: 240,
        guardedSessionCount: 0,
        peakConcurrentControllers: 1,
        lastActivityAt: new Date("2026-03-27T09:15:00.000Z"),
      },
    ]);

    expect(overview.totals).toEqual({
      sessionCount: 3,
      totalGameActiveSeconds: 1200,
      totalControllerSeconds: 1500,
      totalRawEligiblePlaytimeSeconds: 960,
      totalEligiblePlaytimeSeconds: 840,
      guardedSessionCount: 1,
      peakConcurrentControllers: 3,
      lastActivityAt: new Date("2026-03-27T09:15:00.000Z"),
    });
  });
});

import { describe, expect, it } from "vitest";
import {
  buildRuntimeUsageDailyGameMetrics,
  buildRuntimeUsageGameSessionMetrics,
} from "../src/analytics/runtime-usage-aggregates-domain";

describe("runtime usage aggregates domain", () => {
  it("builds per-game-session metrics from overlapping segments", () => {
    const referenceTime = new Date("2026-03-27T10:10:00.000Z");

    const metrics = buildRuntimeUsageGameSessionMetrics(
      [
        {
          id: "game-segment-1",
          runtimeSessionId: "runtime-1",
          roomId: "ROOM1",
          appId: "aj_app_test",
          gameId: "game-1",
          startedAt: new Date("2026-03-27T10:00:00.000Z"),
          endedAt: new Date("2026-03-27T10:10:00.000Z"),
        },
      ],
      [
        {
          id: "controller-segment-1",
          runtimeSessionId: "runtime-1",
          roomId: "ROOM1",
          appId: "aj_app_test",
          controllerId: "ctrl-1",
          startedAt: new Date("2026-03-27T10:00:00.000Z"),
          endedAt: new Date("2026-03-27T10:10:00.000Z"),
        },
        {
          id: "controller-segment-2",
          runtimeSessionId: "runtime-1",
          roomId: "ROOM1",
          appId: "aj_app_test",
          controllerId: "ctrl-2",
          startedAt: new Date("2026-03-27T10:02:00.000Z"),
          endedAt: new Date("2026-03-27T10:06:00.000Z"),
        },
      ],
      [
        {
          id: "eligible-segment-1",
          runtimeSessionId: "runtime-1",
          roomId: "ROOM1",
          appId: "aj_app_test",
          gameId: "game-1",
          startedAt: new Date("2026-03-27T10:00:00.000Z"),
          endedAt: new Date("2026-03-27T10:05:00.000Z"),
        },
        {
          id: "eligible-segment-2",
          runtimeSessionId: "runtime-1",
          roomId: "ROOM1",
          appId: "aj_app_test",
          gameId: "game-1",
          startedAt: new Date("2026-03-27T10:05:30.000Z"),
          endedAt: new Date("2026-03-27T10:10:00.000Z"),
        },
      ],
      referenceTime,
    );

    expect(metrics).toEqual([
      expect.objectContaining({
        id: "game-segment-1",
        controllerSeconds: 840,
        eligiblePlaytimeSeconds: 570,
        peakConcurrentControllers: 2,
      }),
    ]);
  });

  it("builds daily metrics by UTC start-date bucket", () => {
    const referenceTime = new Date("2026-03-27T23:59:59.000Z");

    const metrics = buildRuntimeUsageDailyGameMetrics(
      [
        {
          id: "game-segment-1",
          runtimeSessionId: "runtime-1",
          roomId: "ROOM1",
          appId: "aj_app_test",
          gameId: "game-1",
          startedAt: new Date("2026-03-27T10:00:00.000Z"),
          endedAt: new Date("2026-03-27T10:10:00.000Z"),
          controllerSeconds: 840,
          eligiblePlaytimeSeconds: 570,
          peakConcurrentControllers: 2,
        },
        {
          id: "game-segment-2",
          runtimeSessionId: "runtime-2",
          roomId: "ROOM2",
          appId: "aj_app_test",
          gameId: "game-1",
          startedAt: new Date("2026-03-27T14:00:00.000Z"),
          endedAt: new Date("2026-03-27T14:05:00.000Z"),
          controllerSeconds: 300,
          eligiblePlaytimeSeconds: 300,
          peakConcurrentControllers: 1,
        },
      ],
      referenceTime,
    );

    expect(metrics).toEqual([
      {
        id: "game-1:aj_app_test:2026-03-27",
        bucketDate: "2026-03-27",
        appId: "aj_app_test",
        gameId: "game-1",
        sessionCount: 2,
        totalGameActiveSeconds: 900,
        totalControllerSeconds: 1140,
        totalEligiblePlaytimeSeconds: 870,
        peakConcurrentControllers: 2,
        lastActivityAt: new Date("2026-03-27T14:05:00.000Z"),
      },
    ]);
  });
});

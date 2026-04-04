import { describe, expect, it } from "vitest";
import {
  rebuildRuntimeUsageFromEvents,
  sortRuntimeUsageEventsForReplay,
} from "../src/analytics/runtime-usage-rebuild-domain";
import type { RuntimeUsageEvent } from "../src/analytics/runtime-usage";

const createEvent = (
  partial: Partial<RuntimeUsageEvent> &
    Pick<RuntimeUsageEvent, "id" | "kind" | "occurredAt">,
): RuntimeUsageEvent => ({
  runtimeSessionId: "runtime-1",
  roomId: "ROOM1",
  appId: "aj_app_test",
  payload: {},
  ...partial,
});

describe("runtime usage rebuild domain", () => {
  it("sorts replay events by occurredAt then event id", () => {
    const sorted = sortRuntimeUsageEventsForReplay([
      createEvent({ id: "b", kind: "room_created", occurredAt: 10 }),
      createEvent({ id: "a", kind: "room_created", occurredAt: 10 }),
      createEvent({ id: "c", kind: "room_created", occurredAt: 5 }),
    ]);

    expect(sorted.map((event) => event.id)).toEqual(["c", "a", "b"]);
  });

  it("rebuilds segments and metrics deterministically from a reconnect gap", () => {
    const result = rebuildRuntimeUsageFromEvents(
      [
        createEvent({
          id: "event-room",
          kind: "room_created",
          occurredAt: Date.parse("2026-03-27T10:00:00.000Z"),
        }),
        createEvent({
          id: "event-game",
          kind: "game_became_active",
          occurredAt: Date.parse("2026-03-27T10:00:00.000Z"),
          gameId: "game-1",
        }),
        createEvent({
          id: "event-join-1",
          kind: "controller_joined",
          occurredAt: Date.parse("2026-03-27T10:00:00.000Z"),
          payload: { controllerId: "ctrl-1" },
        }),
        createEvent({
          id: "event-drop",
          kind: "controller_disconnected",
          occurredAt: Date.parse("2026-03-27T10:05:00.000Z"),
          payload: { controllerId: "ctrl-1" },
        }),
        createEvent({
          id: "event-join-2",
          kind: "controller_joined",
          occurredAt: Date.parse("2026-03-27T10:05:30.000Z"),
          payload: { controllerId: "ctrl-1" },
        }),
        createEvent({
          id: "event-leave",
          kind: "controller_left",
          occurredAt: Date.parse("2026-03-27T10:10:00.000Z"),
          payload: { controllerId: "ctrl-1" },
        }),
        createEvent({
          id: "event-close",
          kind: "room_closed",
          occurredAt: Date.parse("2026-03-27T10:10:00.000Z"),
          gameId: "game-1",
          payload: { reason: "host_disconnected" },
        }),
      ],
      new Date("2026-03-27T10:10:00.000Z"),
    );

    expect(result.controllerSegments).toEqual([
      expect.objectContaining({
        id: "ctrl:runtime-1:ctrl-1:event-join-1",
        controllerId: "ctrl-1",
        endReason: "controller_disconnected",
      }),
      expect.objectContaining({
        id: "ctrl:runtime-1:ctrl-1:event-join-2",
        controllerId: "ctrl-1",
        endReason: "controller_left",
      }),
    ]);

    expect(result.eligibleSegments).toEqual([
      expect.objectContaining({
        id: "eligible:runtime-1:game-1:event-join-1",
        endReason: "controller_disconnected",
      }),
      expect.objectContaining({
        id: "eligible:runtime-1:game-1:event-join-2",
        endReason: "controller_left",
      }),
    ]);

    expect(result.gameSessionMetrics).toEqual([
      expect.objectContaining({
        id: "game:runtime-1:game-1:event-game",
        controllerSeconds: 570,
        eligiblePlaytimeSeconds: 570,
        peakConcurrentControllers: 1,
      }),
    ]);

    expect(result.dailyGameMetrics).toEqual([
      expect.objectContaining({
        id: "game-1:aj_app_test:2026-03-27",
        sessionCount: 1,
        totalGameActiveSeconds: 600,
        totalControllerSeconds: 570,
        totalEligiblePlaytimeSeconds: 570,
      }),
    ]);
  });
});

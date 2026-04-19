import { describe, expect, it } from "vitest";
import type { RuntimeUsageEvent } from "../src/analytics/runtime-usage";
import { projectRuntimeUsageEvent } from "../src/analytics/runtime-usage-projection-domain";

const createEvent = (
  partial: Partial<RuntimeUsageEvent> & Pick<RuntimeUsageEvent, "kind">,
): RuntimeUsageEvent => ({
  id: partial.id ?? "event-1",
  kind: partial.kind,
  occurredAt: partial.occurredAt ?? Date.now(),
  runtimeSessionId: partial.runtimeSessionId ?? "runtime-1",
  roomId: partial.roomId ?? "ROOM1",
  appId: partial.appId ?? "aj_app_test",
  gameId: partial.gameId,
  hostVerifiedVia: partial.hostVerifiedVia,
  hostVerifiedOrigin: partial.hostVerifiedOrigin,
  payload: partial.payload,
  runtimeSessionStartedAt: partial.runtimeSessionStartedAt,
});

describe("runtime usage projection domain", () => {
  it("opens controller and eligible segments when a controller joins an active game", () => {
    const actions = projectRuntimeUsageEvent(
      createEvent({
        kind: "controller_joined",
        payload: { controllerId: "ctrl-1" },
      }),
      {
        openControllerCount: 0,
        hasOpenControllerSegmentForController: false,
        openGameId: "game-1",
        hasOpenGameSegment: true,
        hasOpenEligibleSegment: false,
      },
    );

    expect(actions).toEqual([
      {
        type: "open_controller_segment",
        controllerId: "ctrl-1",
      },
      {
        type: "open_eligible_segment",
        gameId: "game-1",
        reason: "controller_joined",
      },
    ]);
  });

  it("closes controller and eligible segments when the last controller disconnects", () => {
    const actions = projectRuntimeUsageEvent(
      createEvent({
        kind: "controller_disconnected",
        payload: { controllerId: "ctrl-1" },
      }),
      {
        openControllerCount: 1,
        hasOpenControllerSegmentForController: true,
        openGameId: "game-1",
        hasOpenGameSegment: true,
        hasOpenEligibleSegment: true,
      },
    );

    expect(actions).toEqual([
      {
        type: "close_controller_segment",
        controllerId: "ctrl-1",
        reason: "controller_disconnected",
      },
      {
        type: "close_eligible_segment",
        reason: "controller_disconnected",
      },
    ]);
  });

  it("opens game and eligible segments when gameplay becomes active with connected controllers", () => {
    const actions = projectRuntimeUsageEvent(
      createEvent({
        kind: "game_became_active",
        gameId: "game-2",
        payload: { activation: "embedded_game_activate" },
      }),
      {
        openControllerCount: 2,
        hasOpenControllerSegmentForController: false,
        openGameId: undefined,
        hasOpenGameSegment: false,
        hasOpenEligibleSegment: false,
      },
    );

    expect(actions).toEqual([
      {
        type: "open_game_segment",
        gameId: "game-2",
        reason: "embedded_game_activate",
      },
      {
        type: "open_eligible_segment",
        gameId: "game-2",
        reason: "game_became_active",
      },
    ]);
  });

  it("closes all open segments when a room closes", () => {
    const actions = projectRuntimeUsageEvent(
      createEvent({
        kind: "room_closed",
        payload: { reason: "host_disconnected" },
      }),
      {
        openControllerCount: 2,
        hasOpenControllerSegmentForController: false,
        openGameId: "game-3",
        hasOpenGameSegment: true,
        hasOpenEligibleSegment: true,
      },
    );

    expect(actions).toEqual([
      {
        type: "close_eligible_segment",
        reason: "host_disconnected",
      },
      {
        type: "close_all_game_segments",
        reason: "host_disconnected",
      },
      {
        type: "close_all_controller_segments",
        reason: "host_disconnected",
      },
    ]);
  });
});

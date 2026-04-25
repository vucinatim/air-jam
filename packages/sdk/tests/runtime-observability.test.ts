// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { AIRJAM_DEV_LOG_EVENTS } from "../src/protocol";
import {
  createRuntimeObservabilityEvent,
  matchesRuntimeObservabilityFilter,
  subscribeToRuntimeObservability,
} from "../src/runtime/contracts/observability";
import { AIRJAM_DEV_RUNTIME_EVENT } from "../src/runtime/dev-runtime-events";

describe("runtime observability contract", () => {
  it("normalizes runtime event details into machine-readable observability events", () => {
    const event = createRuntimeObservabilityEvent(
      {
        event: AIRJAM_DEV_LOG_EVENTS.runtime.socketConnected,
        message: "Socket connected",
        level: "info",
        role: "host",
        roomId: "ABCD",
      },
      "2026-04-09T20:00:00.000Z",
    );

    expect(event).toEqual({
      source: "runtime",
      observedAt: "2026-04-09T20:00:00.000Z",
      event: AIRJAM_DEV_LOG_EVENTS.runtime.socketConnected,
      message: "Socket connected",
      level: "info",
      role: "host",
      roomId: "ABCD",
    });
  });

  it("matches runtime observability filters by event, role, and room", () => {
    const event = createRuntimeObservabilityEvent({
      event: AIRJAM_DEV_LOG_EVENTS.runtime.controllerJoinRequested,
      message: "Controller requested join",
      level: "info",
      role: "controller",
      roomId: "WXYZ",
      controllerId: "controller-1",
    });

    expect(
      matchesRuntimeObservabilityFilter(event, {
        events: [AIRJAM_DEV_LOG_EVENTS.runtime.controllerJoinRequested],
        role: "controller",
        roomId: "WXYZ",
      }),
    ).toBe(true);
    expect(
      matchesRuntimeObservabilityFilter(event, {
        role: "host",
      }),
    ).toBe(false);
  });

  it("subscribes to the existing runtime custom-event stream with filtering", () => {
    const handler = vi.fn();
    const unsubscribe = subscribeToRuntimeObservability(handler, {
      role: "host",
      events: [AIRJAM_DEV_LOG_EVENTS.runtime.socketConnected],
    });

    window.dispatchEvent(
      new CustomEvent(AIRJAM_DEV_RUNTIME_EVENT, {
        detail: {
          event: AIRJAM_DEV_LOG_EVENTS.runtime.socketConnected,
          message: "Host connected",
          level: "info",
          role: "host",
          roomId: "ABCD",
        },
      }),
    );

    window.dispatchEvent(
      new CustomEvent(AIRJAM_DEV_RUNTIME_EVENT, {
        detail: {
          event: AIRJAM_DEV_LOG_EVENTS.runtime.socketDisconnected,
          message: "Controller disconnected",
          level: "warn",
          role: "controller",
          roomId: "ABCD",
        },
      }),
    );

    unsubscribe();

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "runtime",
        event: AIRJAM_DEV_LOG_EVENTS.runtime.socketConnected,
        message: "Host connected",
        role: "host",
        roomId: "ABCD",
      }),
    );
  });
});

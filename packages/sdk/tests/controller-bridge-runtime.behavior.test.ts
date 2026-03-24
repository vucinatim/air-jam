// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getControllerRealtimeClient,
  resetControllerRealtimeClientForTests,
} from "../src/runtime/controller-realtime-client";

describe("embedded controller bridge runtime", () => {
  beforeEach(() => {
    window.history.replaceState(
      {},
      "",
      "/controller?aj_room=ROOM1&aj_controller_id=ctrl_1",
    );
  });

  afterEach(() => {
    window.history.replaceState({}, "", "/");
    resetControllerRealtimeClientForTests();
    vi.restoreAllMocks();
  });

  it("bootstraps a message-channel bridge and forwards child emits to the parent port", async () => {
    const directSocketGetter = vi.fn(() => {
      throw new Error("direct socket should not be requested in embedded mode");
    });
    const postMessageSpy = vi.spyOn(window.parent, "postMessage");

    const client = getControllerRealtimeClient(directSocketGetter);
    const connectSpy = vi.fn();
    client.on("connect", connectSpy);

    client.connect();

    const requestCall = postMessageSpy.mock.calls[0] as unknown[] | undefined;
    expect(requestCall?.[0]).toMatchObject({
      type: "AIRJAM_CONTROLLER_BRIDGE_REQUEST",
    });
    expect(directSocketGetter).not.toHaveBeenCalled();

    const parentPort = (requestCall?.[2] as MessagePort[] | undefined)?.[0];
    expect(parentPort).toBeDefined();
    const parentMessages: unknown[] = [];
    parentPort!.onmessage = (event) => {
      parentMessages.push(event.data);
    };
    parentPort!.start?.();

    parentPort!.postMessage({
      type: "AIRJAM_CONTROLLER_BRIDGE_ATTACH",
      payload: {
        handshake: {
          protocolVersion: "2",
          sdkVersion: "1.0.0",
          runtimeKind: "arcade-controller-runtime",
          capabilityFlags: {
            controllerBridge: true,
          },
        },
        snapshot: {
          roomId: "ROOM1",
          controllerId: "ctrl_1",
          connected: true,
        },
      },
    });

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(client.connected).toBe(true);
    expect(connectSpy).toHaveBeenCalledTimes(1);

    client.emit("controller:system", {
      roomId: "ROOM1",
      command: "toggle_pause",
    });

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(parentMessages).toContainEqual({
      type: "AIRJAM_CONTROLLER_BRIDGE_EMIT",
      payload: {
        event: "controller:system",
        args: [
          {
            roomId: "ROOM1",
            command: "toggle_pause",
          },
        ],
      },
    });
  });

  it("fails closed when the parent never attaches the bridge", () => {
    vi.useFakeTimers();

    const client = getControllerRealtimeClient(
      vi.fn(() => {
        throw new Error("direct socket should not be requested in embedded mode");
      }),
    );
    const disconnectSpy = vi.fn();
    client.on("disconnect", disconnectSpy);

    client.connect();
    vi.advanceTimersByTime(2000);

    expect(client.connected).toBe(false);
    expect(disconnectSpy).toHaveBeenCalledWith(
      "Embedded controller bridge handshake timed out.",
    );

    vi.useRealTimers();
  });
});

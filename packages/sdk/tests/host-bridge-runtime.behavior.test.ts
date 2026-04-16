// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AIRJAM_DEV_LOG_EVENTS } from "../src/protocol";
import {
  AIRJAM_DEV_RUNTIME_EVENT,
  type AirJamDevRuntimeEventDetail,
} from "../src/runtime/dev-runtime-events";
import {
  getHostRealtimeClient,
  resetHostRealtimeClientForTests,
} from "../src/runtime/host-realtime-client";

describe("embedded host bridge runtime", () => {
  const getMockCall = (
    spy: ReturnType<typeof vi.spyOn>,
    offsetFromEnd = 0,
  ): unknown[] | undefined =>
    spy.mock.calls.at(-(offsetFromEnd + 1)) as unknown[] | undefined;

  beforeEach(() => {
    vi.useRealTimers();
    window.history.replaceState(
      {},
      "",
      "/host?aj_room=ROOM1&aj_cap=join_123&aj_cap_exp=1700000000000&aj_arcade_epoch=2&aj_arcade_kind=game&aj_arcade_game_id=pong",
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    window.history.replaceState({}, "", "/");
    resetHostRealtimeClientForTests();
    vi.restoreAllMocks();
  });

  const captureRuntimeEvents = () => {
    const events: AirJamDevRuntimeEventDetail[] = [];
    const handler = (event: Event) => {
      events.push((event as CustomEvent<AirJamDevRuntimeEventDetail>).detail);
    };
    window.addEventListener(AIRJAM_DEV_RUNTIME_EVENT, handler);
    return {
      events,
      cleanup: () => window.removeEventListener(AIRJAM_DEV_RUNTIME_EVENT, handler),
    };
  };

  it("bootstraps a message-channel bridge and forwards child host emits to the parent port", async () => {
    const directSocketGetter = vi.fn(() => {
      throw new Error("direct socket should not be requested in embedded mode");
    });
    const postMessageSpy = vi.spyOn(window.parent, "postMessage");
    const runtimeEvents = captureRuntimeEvents();

    const client = getHostRealtimeClient(directSocketGetter);
    const connectSpy = vi.fn();
    client.on("connect", connectSpy);

    client.connect();

    const requestCall = getMockCall(postMessageSpy);
    expect(requestCall?.[0]).toMatchObject({
      type: "AIRJAM_HOST_BRIDGE_REQUEST",
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
      type: "AIRJAM_HOST_BRIDGE_ATTACH",
      payload: {
        handshake: {
          protocolVersion: "2",
          sdkVersion: "1.0.0",
          runtimeKind: "arcade-host-runtime",
          capabilityFlags: {
            hostBridge: true,
          },
        },
        snapshot: {
          roomId: "ROOM1",
          capabilityToken: "join_123",
          connected: true,
          players: [],
          arcadeSurface: { epoch: 2, kind: "game", gameId: "pong" },
        },
      },
    });

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(client.connected).toBe(true);
    expect(connectSpy).toHaveBeenCalledTimes(1);
    expect(runtimeEvents.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          event: AIRJAM_DEV_LOG_EVENTS.runtime.embeddedBridgeRequested,
          roomId: "ROOM1",
          runtimeEpoch: 2,
          runtimeKind: "arcade-host-runtime",
        }),
        expect.objectContaining({
          event: AIRJAM_DEV_LOG_EVENTS.runtime.embeddedBridgeAttached,
          roomId: "ROOM1",
          runtimeEpoch: 2,
          runtimeKind: "arcade-host-runtime",
        }),
      ]),
    );

    client.emit("host:system", {
      roomId: "ROOM1",
      command: "toggle_pause",
    });

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(parentMessages).toContainEqual({
      type: "AIRJAM_HOST_BRIDGE_EMIT",
      payload: {
        event: "host:system",
        args: [
          {
            roomId: "ROOM1",
            command: "toggle_pause",
          },
        ],
      },
    });

    runtimeEvents.cleanup();
  });

  it("surfaces handshake timeout and then re-requests the bridge", () => {
    vi.useFakeTimers();
    const runtimeEvents = captureRuntimeEvents();
    const postMessageSpy = vi.spyOn(window.parent, "postMessage");

    const client = getHostRealtimeClient(
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
      "Embedded host bridge handshake timed out.",
    );
    expect(runtimeEvents.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          event: AIRJAM_DEV_LOG_EVENTS.runtime.embeddedBridgeRejected,
          roomId: "ROOM1",
          runtimeEpoch: 2,
          runtimeKind: "arcade-host-runtime",
        }),
      ]),
    );
    expect(postMessageSpy).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(50);
    expect(postMessageSpy).toHaveBeenCalledTimes(2);

    runtimeEvents.cleanup();
    vi.useRealTimers();
  });

  it("rejects attach with a lower arcade surface epoch than a previous attach", async () => {
    const directSocketGetter = vi.fn(() => {
      throw new Error("direct socket should not be requested in embedded mode");
    });
    const postMessageSpy = vi.spyOn(window.parent, "postMessage");
    const runtimeEvents = captureRuntimeEvents();

    const client = getHostRealtimeClient(directSocketGetter);
    const disconnectSpy = vi.fn();
    client.on("disconnect", disconnectSpy);

    client.connect();

    const requestCall = getMockCall(postMessageSpy);
    const parentPort = (requestCall?.[2] as MessagePort[] | undefined)?.[0];
    expect(parentPort).toBeDefined();

    const attachPayload = {
      handshake: {
        protocolVersion: "2",
        sdkVersion: "1.0.0",
        runtimeKind: "arcade-host-runtime",
        capabilityFlags: { hostBridge: true },
      },
      snapshot: {
        roomId: "ROOM1",
        capabilityToken: "join_123",
        connected: true,
        players: [],
        arcadeSurface: { epoch: 3, kind: "game" as const, gameId: "pong" },
      },
    };

    parentPort!.postMessage({
      type: "AIRJAM_HOST_BRIDGE_ATTACH",
      payload: attachPayload,
    });

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(client.connected).toBe(true);

    parentPort!.postMessage({
      type: "AIRJAM_HOST_BRIDGE_ATTACH",
      payload: {
        ...attachPayload,
        snapshot: {
          ...attachPayload.snapshot,
          arcadeSurface: { epoch: 2, kind: "game" as const, gameId: "pong" },
        },
      },
    });

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(disconnectSpy).toHaveBeenCalledWith(
      "Embedded host bridge attach rejected: stale arcade surface epoch.",
    );
    expect(runtimeEvents.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          event: AIRJAM_DEV_LOG_EVENTS.runtime.embeddedBridgeRejected,
          roomId: "ROOM1",
          runtimeEpoch: 2,
          runtimeKind: "arcade-host-runtime",
        }),
      ]),
    );

    runtimeEvents.cleanup();
  });

  it("re-requests the bridge after a transient parent close", async () => {
    vi.useFakeTimers();
    const postMessageSpy = vi.spyOn(window.parent, "postMessage");

    const client = getHostRealtimeClient(() => {
      throw new Error("direct socket should not be requested in embedded mode");
    });
    const connectSpy = vi.fn();
    const disconnectSpy = vi.fn();
    client.on("connect", connectSpy);
    client.on("disconnect", disconnectSpy);

    client.connect();

    const firstRequestCall = getMockCall(postMessageSpy);
    const firstParentPort = (firstRequestCall?.[2] as MessagePort[] | undefined)?.[0];
    expect(firstParentPort).toBeDefined();

    firstParentPort!.postMessage({
      type: "AIRJAM_HOST_BRIDGE_ATTACH",
      payload: {
        handshake: {
          protocolVersion: "2",
          sdkVersion: "1.0.0",
          runtimeKind: "arcade-host-runtime",
          capabilityFlags: { hostBridge: true },
        },
        snapshot: {
          roomId: "ROOM1",
          capabilityToken: "join_123",
          connected: true,
          arcadeSurface: { epoch: 2, kind: "game", gameId: "pong" },
          players: [],
        },
      },
    });

    await vi.advanceTimersByTimeAsync(0);
    expect(client.connected).toBe(true);

    firstParentPort!.postMessage({
      type: "AIRJAM_HOST_BRIDGE_CLOSE",
      payload: { reason: "game_unloaded" },
    });

    await vi.advanceTimersByTimeAsync(49);
    expect(postMessageSpy).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1);
    expect(postMessageSpy).toHaveBeenCalledTimes(2);
    expect(disconnectSpy).toHaveBeenCalledWith("game_unloaded");

    const secondRequestCall = getMockCall(postMessageSpy);
    expect(secondRequestCall?.[0]).toMatchObject({
      type: "AIRJAM_HOST_BRIDGE_REQUEST",
    });

    const secondParentPort = (secondRequestCall?.[2] as MessagePort[] | undefined)?.[0];
    expect(secondParentPort).toBeDefined();

    secondParentPort!.postMessage({
      type: "AIRJAM_HOST_BRIDGE_ATTACH",
      payload: {
        handshake: {
          protocolVersion: "2",
          sdkVersion: "1.0.0",
          runtimeKind: "arcade-host-runtime",
          capabilityFlags: { hostBridge: true },
        },
        snapshot: {
          roomId: "ROOM1",
          capabilityToken: "join_123",
          connected: true,
          arcadeSurface: { epoch: 2, kind: "game", gameId: "pong" },
          players: [],
        },
      },
    });

    await vi.advanceTimersByTimeAsync(0);
    expect(client.connected).toBe(true);
    expect(connectSpy).toHaveBeenCalledTimes(2);
  });
});

// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AIRJAM_DEV_LOG_EVENTS } from "../src/protocol";
import {
  AIRJAM_DEV_RUNTIME_EVENT,
  type AirJamDevRuntimeEventDetail,
} from "../src/runtime/dev-runtime-events";
import {
  getControllerRealtimeClient,
  resetControllerRealtimeClientForTests,
} from "../src/runtime/controller-realtime-client";

describe("embedded controller bridge runtime", () => {
  beforeEach(() => {
    window.history.replaceState(
      {},
      "",
      "/controller?aj_room=ROOM1&aj_controller_id=ctrl_1&aj_arcade_epoch=2&aj_arcade_kind=game&aj_arcade_game_id=pong",
    );
  });

  afterEach(() => {
    window.history.replaceState({}, "", "/");
    resetControllerRealtimeClientForTests();
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

  it("bootstraps a message-channel bridge and forwards child emits to the parent port", async () => {
    const directSocketGetter = vi.fn(() => {
      throw new Error("direct socket should not be requested in embedded mode");
    });
    const postMessageSpy = vi.spyOn(window.parent, "postMessage");
    const runtimeEvents = captureRuntimeEvents();

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
          controllerId: "ctrl_1",
          runtimeEpoch: 2,
          runtimeKind: "arcade-controller-runtime",
        }),
        expect.objectContaining({
          event: AIRJAM_DEV_LOG_EVENTS.runtime.embeddedBridgeAttached,
          roomId: "ROOM1",
          controllerId: "ctrl_1",
          runtimeEpoch: 2,
          runtimeKind: "arcade-controller-runtime",
        }),
      ]),
    );

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

    runtimeEvents.cleanup();
  });

  it("normalizes legacy null action payloads before posting bridge emits", async () => {
    const postMessageSpy = vi.spyOn(window.parent, "postMessage");
    const client = getControllerRealtimeClient(() => {
      throw new Error("direct socket should not be requested in embedded mode");
    });

    client.connect();

    const requestCall = postMessageSpy.mock.calls[0] as unknown[] | undefined;
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
          arcadeSurface: { epoch: 2, kind: "game", gameId: "pong" },
        },
      },
    });

    await new Promise((resolve) => setTimeout(resolve, 0));

    client.emit("controller:action_rpc", {
      roomId: "ROOM1",
      actionName: "airjam.arcade.toggle_qr",
      payload: null,
      storeDomain: "arcade.surface",
    } as never);

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(parentMessages).toContainEqual({
      type: "AIRJAM_CONTROLLER_BRIDGE_EMIT",
      payload: {
        event: "controller:action_rpc",
        args: [
          {
            roomId: "ROOM1",
            actionName: "airjam.arcade.toggle_qr",
            payload: undefined,
            storeDomain: "arcade.surface",
          },
        ],
      },
    });
  });

  it("normalizes legacy null action payloads for direct controller sockets", () => {
    window.history.replaceState({}, "", "/");

    const socket = {
      connected: true,
      id: "socket_1",
      connect: vi.fn(),
      disconnect: vi.fn(),
      on: vi.fn(),
      off: vi.fn(),
      emit: vi.fn(),
    };

    const client = getControllerRealtimeClient(() => socket as never);

    client.emit("controller:action_rpc", {
      roomId: "ROOM1",
      actionName: "airjam.arcade.toggle_qr",
      payload: null,
      storeDomain: "arcade.surface",
    } as never);

    expect(socket.emit).toHaveBeenCalledWith("controller:action_rpc", {
      roomId: "ROOM1",
      actionName: "airjam.arcade.toggle_qr",
      payload: undefined,
      storeDomain: "arcade.surface",
    });
  });

  it("fails closed when the parent never attaches the bridge", () => {
    vi.useFakeTimers();
    const runtimeEvents = captureRuntimeEvents();

    const client = getControllerRealtimeClient(
      vi.fn(() => {
        throw new Error(
          "direct socket should not be requested in embedded mode",
        );
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
    expect(runtimeEvents.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          event: AIRJAM_DEV_LOG_EVENTS.runtime.embeddedBridgeRejected,
          roomId: "ROOM1",
          controllerId: "ctrl_1",
          runtimeEpoch: 2,
          runtimeKind: "arcade-controller-runtime",
        }),
      ]),
    );

    runtimeEvents.cleanup();
    vi.useRealTimers();
  });

  it("replays snapshot orientation state on attach", async () => {
    const directSocketGetter = vi.fn(() => {
      throw new Error("direct socket should not be requested in embedded mode");
    });
    const postMessageSpy = vi.spyOn(window.parent, "postMessage");

    const client = getControllerRealtimeClient(directSocketGetter);
    const stateSpy = vi.fn();
    client.on("server:state", stateSpy);

    client.connect();

    const requestCall = postMessageSpy.mock.calls[0] as unknown[] | undefined;
    const parentPort = (requestCall?.[2] as MessagePort[] | undefined)?.[0];
    expect(parentPort).toBeDefined();
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
          arcadeSurface: { epoch: 2, kind: "game", gameId: "pong" },
          state: {
            runtimeState: "playing",
            orientation: "landscape",
          },
        },
      },
    });

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(stateSpy).toHaveBeenCalledWith({
      roomId: "ROOM1",
      state: {
        runtimeState: "playing",
        orientation: "landscape",
      },
    });
  });

  it("rejects attach with a lower arcade surface epoch than a previous attach", async () => {
    const directSocketGetter = vi.fn(() => {
      throw new Error("direct socket should not be requested in embedded mode");
    });
    const postMessageSpy = vi.spyOn(window.parent, "postMessage");
    const runtimeEvents = captureRuntimeEvents();

    const client = getControllerRealtimeClient(directSocketGetter);
    const disconnectSpy = vi.fn();
    client.on("disconnect", disconnectSpy);

    client.connect();

    const requestCall = postMessageSpy.mock.calls[0] as unknown[] | undefined;
    const parentPort = (requestCall?.[2] as MessagePort[] | undefined)?.[0];
    expect(parentPort).toBeDefined();

    const attachPayload = {
      handshake: {
        protocolVersion: "2",
        sdkVersion: "1.0.0",
        runtimeKind: "arcade-controller-runtime",
        capabilityFlags: { controllerBridge: true },
      },
      snapshot: {
        roomId: "ROOM1",
        controllerId: "ctrl_1",
        connected: true,
        arcadeSurface: { epoch: 2, kind: "game" as const, gameId: "a" },
      },
    };

    parentPort!.postMessage({
      type: "AIRJAM_CONTROLLER_BRIDGE_ATTACH",
      payload: attachPayload,
    });

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(client.connected).toBe(true);

    parentPort!.postMessage({
      type: "AIRJAM_CONTROLLER_BRIDGE_ATTACH",
      payload: {
        ...attachPayload,
        snapshot: {
          ...attachPayload.snapshot,
          arcadeSurface: { epoch: 1, kind: "game" as const, gameId: "a" },
        },
      },
    });

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(disconnectSpy).toHaveBeenCalledWith(
      "Embedded controller bridge attach rejected: stale arcade surface epoch.",
    );
    expect(runtimeEvents.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          event: AIRJAM_DEV_LOG_EVENTS.runtime.embeddedBridgeRejected,
          roomId: "ROOM1",
          controllerId: "ctrl_1",
          runtimeEpoch: 2,
          runtimeKind: "arcade-controller-runtime",
        }),
      ]),
    );

    runtimeEvents.cleanup();
  });
});

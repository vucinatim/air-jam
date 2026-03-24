import type { RoomCode } from "../protocol";
import {
  createControllerBridgeCloseMessage,
  createControllerBridgeEmitMessage,
  createControllerBridgeRequestMessage,
  parseControllerBridgeAttachMessage,
  parseControllerBridgeCloseMessage,
  parseControllerBridgeEventMessage,
  type ControllerBridgeClientEventArgs,
  type ControllerBridgeClientEventName,
  type ControllerBridgeServerEventArgs,
  type ControllerBridgeServerEventName,
} from "./controller-bridge";
import type {
  AirJamRealtimeClient,
  BridgeListener,
  DirectSocketGetter,
} from "./realtime-client";
import { readEmbeddedControllerRuntimeParams } from "./runtime-session-params";

const BRIDGE_HANDSHAKE_TIMEOUT_MS = 2000;

class EmbeddedControllerBridgeClient implements AirJamRealtimeClient {
  public connected = false;
  public id: string | undefined;

  private listeners = new Map<string, Set<BridgeListener>>();
  private port: MessagePort | null = null;
  private connectTimeout: ReturnType<typeof setTimeout> | null = null;
  private requested = false;

  connect(): this {
    const runtimeParams = readEmbeddedControllerRuntimeParams();
    if (!runtimeParams || typeof window === "undefined") {
      this.fail("Embedded controller bridge runtime params missing.");
      return this;
    }

    if (this.connected || this.requested) {
      return this;
    }

    this.requested = true;
    this.clearPort(false);

    const channel = new MessageChannel();
    this.port = channel.port1;
    this.port.onmessage = (event) => {
      this.handlePortMessage(event.data);
    };
    this.port.start?.();

    this.connectTimeout = setTimeout(() => {
      this.fail("Embedded controller bridge handshake timed out.");
    }, BRIDGE_HANDSHAKE_TIMEOUT_MS);

    window.parent.postMessage(
      createControllerBridgeRequestMessage({
        roomId: runtimeParams.room as RoomCode,
        controllerId: runtimeParams.controllerId,
      }),
      "*",
      [channel.port2],
    );

    return this;
  }

  disconnect(): this {
    if (this.port) {
      this.port.postMessage(createControllerBridgeCloseMessage("detached"));
    }
    this.clearPort(true, "detached");
    return this;
  }

  on(event: string, listener: BridgeListener): this {
    const eventKey = String(event);
    const current = this.listeners.get(eventKey) ?? new Set<BridgeListener>();
    current.add(listener);
    this.listeners.set(eventKey, current);
    return this;
  }

  off(event: string, listener?: BridgeListener): this {
    const eventKey = String(event);
    const current = this.listeners.get(eventKey);
    if (!current) {
      return this;
    }

    if (!listener) {
      this.listeners.delete(eventKey);
      return this;
    }

    current.delete(listener);
    if (current.size === 0) {
      this.listeners.delete(eventKey);
    }
    return this;
  }

  emit(event: string, ...args: unknown[]): this {
    if (!this.port || !this.connected) {
      return this;
    }

    const bridgeEvent = event as ControllerBridgeClientEventName;
    this.port.postMessage(
      createControllerBridgeEmitMessage(
        bridgeEvent,
        ...(args as ControllerBridgeClientEventArgs[typeof bridgeEvent]),
      ),
    );
    return this;
  }

  private handlePortMessage(message: unknown): void {
    const attachMessage = parseControllerBridgeAttachMessage(message);
    if (attachMessage) {
      if (
        attachMessage.payload.handshake.runtimeKind !==
          "arcade-controller-runtime" ||
        attachMessage.payload.handshake.capabilityFlags.controllerBridge !==
          true
      ) {
        this.fail("Embedded controller bridge handshake rejected.");
        return;
      }

      const snapshot = attachMessage.payload.snapshot;
      this.id = snapshot.socketId ?? snapshot.controllerId;
      this.requested = false;
      this.clearConnectTimeout();

      if (snapshot.connected && !this.connected) {
        this.connected = true;
        this.notify("connect");
      } else if (!snapshot.connected) {
        this.connected = false;
      }

      if (snapshot.player) {
        this.notify("server:welcome", {
          controllerId: snapshot.controllerId,
          roomId: snapshot.roomId,
          player: snapshot.player,
        });
      }

      if (snapshot.state) {
        this.notify("server:state", {
          roomId: snapshot.roomId,
          state: snapshot.state,
        });
      }

      return;
    }

    const eventMessage = parseControllerBridgeEventMessage(message);
    if (eventMessage) {
      const { event, args } = eventMessage.payload;

      if (event === "connect") {
        this.connected = true;
      }

      if (event === "disconnect") {
        this.connected = false;
      }

      this.notify(
        event,
        ...(args as ControllerBridgeServerEventArgs[typeof event]),
      );
      return;
    }

    const closeMessage = parseControllerBridgeCloseMessage(message);
    if (closeMessage) {
      this.clearPort(true, closeMessage.payload.reason);
    }
  }

  private fail(reason: string): void {
    this.clearPort(false);
    this.notify("disconnect", reason);
  }

  private clearPort(notifyDisconnect: boolean, reason?: string): void {
    const shouldNotify = notifyDisconnect && (this.connected || this.requested);
    this.clearConnectTimeout();
    this.requested = false;
    this.connected = false;
    this.id = undefined;

    if (this.port) {
      this.port.onmessage = null;
      this.port.close();
      this.port = null;
    }

    if (shouldNotify) {
      this.notify("disconnect", reason);
    }
  }

  private clearConnectTimeout(): void {
    if (!this.connectTimeout) {
      return;
    }

    clearTimeout(this.connectTimeout);
    this.connectTimeout = null;
  }

  private notify<TEvent extends ControllerBridgeServerEventName>(
    event: TEvent,
    ...args: ControllerBridgeServerEventArgs[TEvent]
  ): void {
    const current = this.listeners.get(event);
    if (!current) {
      return;
    }

    for (const listener of current) {
      listener(...args);
    }
  }
}

let embeddedControllerClient: EmbeddedControllerBridgeClient | null = null;

export const isEmbeddedControllerRuntime = (): boolean =>
  readEmbeddedControllerRuntimeParams() !== null;

export const getControllerRealtimeClient = (
  getSocket: DirectSocketGetter<"controller">,
): AirJamRealtimeClient => {
  if (!isEmbeddedControllerRuntime()) {
    return getSocket("controller") as unknown as AirJamRealtimeClient;
  }

  if (!embeddedControllerClient) {
    embeddedControllerClient = new EmbeddedControllerBridgeClient();
  }

  return embeddedControllerClient;
};

export const resetControllerRealtimeClientForTests = (): void => {
  embeddedControllerClient?.disconnect();
  embeddedControllerClient = null;
};

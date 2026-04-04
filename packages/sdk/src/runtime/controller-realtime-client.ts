import {
  AIRJAM_DEV_LOG_EVENTS,
  type ControllerActionRpcPayload,
  type RoomCode,
} from "../protocol";
import type { AirJamSocket } from "../context/socket-manager";
import { emitAirJamDevRuntimeEvent } from "./dev-runtime-events";
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
import { validateArcadeBridgeAttachEpoch } from "./validate-arcade-bridge-attach";

const BRIDGE_HANDSHAKE_TIMEOUT_MS = 2000;
const CONTROLLER_BRIDGE_RUNTIME_KIND = "arcade-controller-runtime";

type LegacyControllerActionRpcPayload = Omit<
  ControllerActionRpcPayload,
  "payload"
> & {
  payload: ControllerActionRpcPayload["payload"] | null;
};

const normalizeControllerEmitArgs = (
  event: string,
  args: unknown[],
): unknown[] => {
  if (event !== "controller:action_rpc") {
    return args;
  }

  const [payload, ...rest] = args;
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return args;
  }

  const actionPayload = payload as LegacyControllerActionRpcPayload;
  if (actionPayload.payload !== null) {
    return args;
  }

  return [{ ...actionPayload, payload: undefined }, ...rest];
};

class DirectControllerRealtimeClient implements AirJamRealtimeClient {
  constructor(private readonly socket: AirJamSocket) {}

  get connected(): boolean {
    return this.socket.connected;
  }

  get id(): string | undefined {
    return this.socket.id;
  }

  connect(): this {
    this.socket.connect();
    return this;
  }

  disconnect(): this {
    this.socket.disconnect();
    return this;
  }

  on(event: string, listener: BridgeListener): this {
    this.socket.on(event as never, listener as never);
    return this;
  }

  off(event: string, listener?: BridgeListener): this {
    if (!listener) {
      this.socket.off(event as never);
      return this;
    }

    this.socket.off(event as never, listener as never);
    return this;
  }

  emit(event: string, ...args: unknown[]): this {
    (
      this.socket.emit as unknown as (
        this: AirJamSocket,
        event: string,
        ...args: unknown[]
      ) => void
    ).call(this.socket, event, ...normalizeControllerEmitArgs(event, args));
    return this;
  }
}

class EmbeddedControllerBridgeClient implements AirJamRealtimeClient {
  public connected = false;
  public id: string | undefined;

  private listeners = new Map<string, Set<BridgeListener>>();
  private port: MessagePort | null = null;
  private connectTimeout: ReturnType<typeof setTimeout> | null = null;
  private requested = false;
  private lastAttachedArcadeEpoch: number | null = null;

  connect(): this {
    const runtimeParams = readEmbeddedControllerRuntimeParams();
    if (!runtimeParams || typeof window === "undefined") {
      this.fail("Embedded controller bridge runtime params missing.", {
        reason: "runtime_params_missing",
      });
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
      this.fail("Embedded controller bridge handshake timed out.", {
        reason: "handshake_timeout",
        runtimeParams,
      });
    }, BRIDGE_HANDSHAKE_TIMEOUT_MS);

    window.parent.postMessage(
      createControllerBridgeRequestMessage({
        roomId: runtimeParams.room as RoomCode,
        controllerId: runtimeParams.controllerId,
        arcadeSurface: runtimeParams.arcadeSurface,
      }),
      "*",
      [channel.port2],
    );

    this.emitRuntimeEvent(
      AIRJAM_DEV_LOG_EVENTS.runtime.embeddedBridgeRequested,
      "Embedded controller bridge requested",
      "info",
      runtimeParams,
      {
        gameId: runtimeParams.arcadeSurface.gameId,
        surfaceKind: runtimeParams.arcadeSurface.kind,
      },
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
    const normalizedArgs = normalizeControllerEmitArgs(event, args);
    this.port.postMessage(
      createControllerBridgeEmitMessage(
        bridgeEvent,
        ...(normalizedArgs as ControllerBridgeClientEventArgs[typeof bridgeEvent]),
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
        this.fail("Embedded controller bridge handshake rejected.", {
          reason: "handshake_rejected",
          runtimeParams: readEmbeddedControllerRuntimeParams(),
        });
        return;
      }

      const snapshot = attachMessage.payload.snapshot;
      const epochResult = validateArcadeBridgeAttachEpoch(
        this.lastAttachedArcadeEpoch,
        snapshot.arcadeSurface,
      );
      if (!epochResult.ok) {
        this.fail(
          "Embedded controller bridge attach rejected: stale arcade surface epoch.",
          {
            reason: "stale_arcade_surface_epoch",
            runtimeParams: readEmbeddedControllerRuntimeParams(),
            data: {
              attachedEpoch: snapshot.arcadeSurface.epoch,
              previousEpoch: this.lastAttachedArcadeEpoch,
            },
          },
        );
        return;
      }
      this.lastAttachedArcadeEpoch = epochResult.nextLast;

      this.emitRuntimeEvent(
        AIRJAM_DEV_LOG_EVENTS.runtime.embeddedBridgeAttached,
        "Embedded controller bridge attached",
        "info",
        {
          room: snapshot.roomId,
          controllerId: snapshot.controllerId,
          arcadeSurface: snapshot.arcadeSurface,
        },
        {
          connected: snapshot.connected,
          socketId: snapshot.socketId,
          hasPlayer: Boolean(snapshot.player),
        },
      );

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
      this.emitRuntimeEvent(
        AIRJAM_DEV_LOG_EVENTS.runtime.embeddedBridgeClosed,
        "Embedded controller bridge closed",
        "info",
        readEmbeddedControllerRuntimeParams(),
        { reason: closeMessage.payload.reason },
      );
      this.clearPort(true, closeMessage.payload.reason);
    }
  }

  private fail(
    reason: string,
    options?: {
      reason?: string;
      runtimeParams?: ReturnType<typeof readEmbeddedControllerRuntimeParams>;
      data?: Record<string, unknown>;
    },
  ): void {
    this.emitRuntimeEvent(
      AIRJAM_DEV_LOG_EVENTS.runtime.embeddedBridgeRejected,
      reason,
      "warn",
      options?.runtimeParams ?? readEmbeddedControllerRuntimeParams(),
      {
        reason: options?.reason ?? reason,
        ...options?.data,
      },
    );
    this.clearPort(false);
    this.notify("disconnect", reason);
  }

  private clearPort(notifyDisconnect: boolean, reason?: string): void {
    const shouldNotify = notifyDisconnect && (this.connected || this.requested);
    this.clearConnectTimeout();
    this.requested = false;
    this.connected = false;
    this.id = undefined;
    this.lastAttachedArcadeEpoch = null;

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

  private emitRuntimeEvent(
    event: (typeof AIRJAM_DEV_LOG_EVENTS.runtime)[keyof typeof AIRJAM_DEV_LOG_EVENTS.runtime],
    message: string,
    level: "info" | "warn" | "error",
    runtimeParams: ReturnType<typeof readEmbeddedControllerRuntimeParams>,
    data?: Record<string, unknown>,
  ): void {
    emitAirJamDevRuntimeEvent({
      event,
      message,
      level,
      role: "controller",
      roomId: runtimeParams?.room,
      controllerId: runtimeParams?.controllerId,
      runtimeEpoch: runtimeParams?.arcadeSurface.epoch,
      runtimeKind: CONTROLLER_BRIDGE_RUNTIME_KIND,
      data,
    });
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
const directControllerClients = new WeakMap<
  AirJamSocket,
  DirectControllerRealtimeClient
>();

export const isEmbeddedControllerRuntime = (): boolean =>
  readEmbeddedControllerRuntimeParams() !== null;

export const getControllerRealtimeClient = (
  getSocket: DirectSocketGetter<"controller">,
): AirJamRealtimeClient => {
  if (!isEmbeddedControllerRuntime()) {
    const socket = getSocket("controller");
    const existing = directControllerClients.get(socket);
    if (existing) {
      return existing;
    }

    const client = new DirectControllerRealtimeClient(socket);
    directControllerClients.set(socket, client);
    return client;
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

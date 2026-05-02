import type { AirJamSocket } from "../context/socket-manager";
import { AIRJAM_DEV_LOG_EVENTS, type RoomCode } from "../protocol";
import { emitAirJamDevRuntimeEvent } from "./dev-runtime-events";
import {
  createHostBridgeCloseMessage,
  createHostBridgeEmitMessage,
  createHostBridgeRequestMessage,
  createHostBridgeResponseMessage,
  parseHostBridgeAttachMessage,
  parseHostBridgeCloseMessage,
  parseHostBridgeEventMessage,
  parseHostBridgeResponseMessage,
  type HostBridgeClientEventArgs,
  type HostBridgeClientEventName,
  type HostBridgeServerEventArgs,
  type HostBridgeServerEventName,
} from "./host-bridge";
import type {
  AirJamRealtimeClient,
  BridgeListener,
  DirectSocketGetter,
} from "./realtime-client";
import { readChildHostRuntimeParams } from "./runtime-session-params";
import { validateArcadeBridgeAttachEpoch } from "./validate-arcade-bridge-attach";

const BRIDGE_HANDSHAKE_TIMEOUT_MS = 2000;
const BRIDGE_ACK_TIMEOUT_MS = 5_000;
const HOST_BRIDGE_RUNTIME_KIND = "arcade-host-runtime";
const BRIDGE_TRANSIENT_CLOSE_REASONS = new Set(["game_unloaded", "replaced"]);
const BRIDGE_TRANSIENT_FAILURE_REASONS = new Set(["handshake_timeout"]);

class DirectHostRealtimeClient implements AirJamRealtimeClient {
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
    ).call(this.socket, event, ...args);
    return this;
  }

  emitWithAck<TAck>(event: string, ...args: unknown[]): Promise<TAck> {
    return new Promise<TAck>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(
          new Error(
            `Timed out waiting for acknowledgement for realtime event "${event}".`,
          ),
        );
      }, BRIDGE_ACK_TIMEOUT_MS);

      (
        this.socket.emit as unknown as (
          this: AirJamSocket,
          event: string,
          ...args: unknown[]
        ) => void
      ).call(this.socket, event, ...args, (ack: TAck) => {
        clearTimeout(timeoutId);
        resolve(ack);
      });
    });
  }
}

class EmbeddedHostBridgeClient implements AirJamRealtimeClient {
  public connected = false;
  public id: string | undefined;

  private listeners = new Map<string, Set<BridgeListener>>();
  private port: MessagePort | null = null;
  private connectTimeout: ReturnType<typeof setTimeout> | null = null;
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private requested = false;
  private lastAttachedArcadeEpoch: number | null = null;
  private allowReconnect = true;
  private pendingAcks = new Map<
    string,
    {
      resolve: (ack: unknown) => void;
      reject: (error: Error) => void;
      timeoutId: ReturnType<typeof setTimeout>;
    }
  >();

  connect(): this {
    const runtimeParams = readChildHostRuntimeParams();
    if (!runtimeParams || typeof window === "undefined") {
      this.fail("Embedded host bridge runtime params missing.", {
        reason: "runtime_params_missing",
      });
      return this;
    }

    if (this.connected || this.requested) {
      return this;
    }

    this.allowReconnect = true;
    this.clearReconnectTimeout();
    this.clearPort(false);
    this.requested = true;

    const channel = new MessageChannel();
    this.port = channel.port1;
    this.port.onmessage = (event) => {
      this.handlePortMessage(event.data);
    };
    this.port.start?.();

    this.connectTimeout = setTimeout(() => {
      this.fail("Embedded host bridge handshake timed out.", {
        reason: "handshake_timeout",
        runtimeParams,
      });
    }, BRIDGE_HANDSHAKE_TIMEOUT_MS);

    window.parent.postMessage(
      createHostBridgeRequestMessage({
        roomId: runtimeParams.room as RoomCode,
        capabilityToken: runtimeParams.capabilityToken,
        arcadeSurface: runtimeParams.arcadeSurface,
      }),
      "*",
      [channel.port2],
    );

    this.emitRuntimeEvent(
      AIRJAM_DEV_LOG_EVENTS.runtime.embeddedBridgeRequested,
      "Embedded host bridge requested",
      "info",
      runtimeParams,
      {
        capabilityExpiresAt: runtimeParams.capabilityExpiresAt,
        gameId: runtimeParams.arcadeSurface.gameId,
        surfaceKind: runtimeParams.arcadeSurface.kind,
      },
    );

    return this;
  }

  disconnect(): this {
    this.allowReconnect = false;
    this.clearReconnectTimeout();
    if (this.port) {
      this.port.postMessage(createHostBridgeCloseMessage("detached"));
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

    const bridgeEvent = event as HostBridgeClientEventName;
    this.port.postMessage(
      createHostBridgeEmitMessage(
        bridgeEvent,
        ...(args as HostBridgeClientEventArgs[typeof bridgeEvent]),
      ),
    );
    return this;
  }

  emitWithAck<TAck>(event: string, ...args: unknown[]): Promise<TAck> {
    if (!this.port || !this.connected) {
      return Promise.reject(
        new Error(
          `Cannot emit acknowledged realtime event "${event}" because the embedded host bridge is not connected.`,
        ),
      );
    }

    const requestId =
      globalThis.crypto?.randomUUID?.() ??
      `ack-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

    return new Promise<TAck>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.pendingAcks.delete(requestId);
        reject(
          new Error(
            `Timed out waiting for acknowledgement for bridge event "${event}".`,
          ),
        );
      }, BRIDGE_ACK_TIMEOUT_MS);

      this.pendingAcks.set(requestId, {
        resolve: (ack) => resolve(ack as TAck),
        reject,
        timeoutId,
      });

      const bridgeEvent = event as HostBridgeClientEventName;
      this.port?.postMessage(
        createHostBridgeEmitMessage(
          bridgeEvent,
          ...(args as HostBridgeClientEventArgs[typeof bridgeEvent]),
          { requestId },
        ),
      );
    });
  }

  private handlePortMessage(message: unknown): void {
    const responseMessage = parseHostBridgeResponseMessage(message);
    if (responseMessage) {
      const pending = this.pendingAcks.get(responseMessage.payload.requestId);
      if (!pending) {
        return;
      }

      clearTimeout(pending.timeoutId);
      this.pendingAcks.delete(responseMessage.payload.requestId);
      pending.resolve(responseMessage.payload.ack);
      return;
    }

    const attachMessage = parseHostBridgeAttachMessage(message);
    if (attachMessage) {
      if (
        attachMessage.payload.handshake.runtimeKind !== "arcade-host-runtime" ||
        attachMessage.payload.handshake.capabilityFlags.hostBridge !== true
      ) {
        this.fail("Embedded host bridge handshake rejected.", {
          reason: "handshake_rejected",
          runtimeParams: readChildHostRuntimeParams(),
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
          "Embedded host bridge attach rejected: stale arcade surface epoch.",
          {
            reason: "stale_arcade_surface_epoch",
            runtimeParams: readChildHostRuntimeParams(),
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
        "Embedded host bridge attached",
        "info",
        readChildHostRuntimeParams(),
        {
          connected: snapshot.connected,
          socketId: snapshot.socketId,
          playerCount: snapshot.players.length,
        },
      );

      this.id = snapshot.socketId ?? snapshot.roomId;
      this.requested = false;
      this.clearConnectTimeout();

      if (snapshot.connected && !this.connected) {
        this.connected = true;
        this.notify("connect");
      } else if (!snapshot.connected) {
        this.connected = false;
      }

      for (const player of snapshot.players) {
        this.notify("server:controllerJoined", player);
      }

      if (snapshot.state) {
        this.notify("server:state", {
          roomId: snapshot.roomId,
          state: snapshot.state,
        });
      }

      return;
    }

    const eventMessage = parseHostBridgeEventMessage(message);
    if (eventMessage) {
      const { event, args, requestId } = eventMessage.payload;

      if (event === "connect") {
        this.connected = true;
      }

      if (event === "disconnect") {
        this.connected = false;
      }

      if (event === "airjam:action_rpc" && requestId && this.port) {
        const [payload] = args as [
          HostBridgeServerEventArgs["airjam:action_rpc"][0],
        ];
        this.notify(event, payload, (ack: unknown) => {
          this.port?.postMessage(
            createHostBridgeResponseMessage(requestId, ack),
          );
        });
        return;
      }

      this.notify(event, ...(args as HostBridgeServerEventArgs[typeof event]));
      return;
    }

    const closeMessage = parseHostBridgeCloseMessage(message);
    if (closeMessage) {
      this.emitRuntimeEvent(
        AIRJAM_DEV_LOG_EVENTS.runtime.embeddedBridgeClosed,
        "Embedded host bridge closed",
        "info",
        readChildHostRuntimeParams(),
        { reason: closeMessage.payload.reason },
      );
      this.clearPort(true, closeMessage.payload.reason);
      this.scheduleReconnect(
        closeMessage.payload.reason,
        BRIDGE_TRANSIENT_CLOSE_REASONS,
      );
    }
  }

  private fail(
    reason: string,
    options?: {
      reason?: string;
      runtimeParams?: ReturnType<typeof readChildHostRuntimeParams>;
      data?: Record<string, unknown>;
    },
  ): void {
    this.emitRuntimeEvent(
      AIRJAM_DEV_LOG_EVENTS.runtime.embeddedBridgeRejected,
      reason,
      "warn",
      options?.runtimeParams ?? readChildHostRuntimeParams(),
      {
        reason: options?.reason ?? reason,
        ...options?.data,
      },
    );
    this.clearPort(false);
    this.scheduleReconnect(options?.reason, BRIDGE_TRANSIENT_FAILURE_REASONS);
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

    for (const pending of this.pendingAcks.values()) {
      clearTimeout(pending.timeoutId);
      pending.reject(
        new Error("Embedded host bridge disconnected before acknowledgement."),
      );
    }
    this.pendingAcks.clear();

    if (shouldNotify) {
      this.notify("disconnect", reason);
    }
  }

  private scheduleReconnect(
    reason: string | undefined,
    transientReasons: ReadonlySet<string>,
  ): void {
    if (!this.allowReconnect || !transientReasons.has(reason ?? "")) {
      return;
    }

    this.clearReconnectTimeout();
    this.reconnectTimeout = setTimeout(() => {
      this.reconnectTimeout = null;
      this.connect();
    }, 50);
  }

  private clearConnectTimeout(): void {
    if (!this.connectTimeout) {
      return;
    }

    clearTimeout(this.connectTimeout);
    this.connectTimeout = null;
  }

  private clearReconnectTimeout(): void {
    if (!this.reconnectTimeout) {
      return;
    }

    clearTimeout(this.reconnectTimeout);
    this.reconnectTimeout = null;
  }

  private emitRuntimeEvent(
    event: (typeof AIRJAM_DEV_LOG_EVENTS.runtime)[keyof typeof AIRJAM_DEV_LOG_EVENTS.runtime],
    message: string,
    level: "info" | "warn" | "error",
    runtimeParams: ReturnType<typeof readChildHostRuntimeParams>,
    data?: Record<string, unknown>,
  ): void {
    emitAirJamDevRuntimeEvent({
      event,
      message,
      level,
      role: "host",
      roomId: runtimeParams?.room,
      runtimeEpoch: runtimeParams?.arcadeSurface.epoch,
      runtimeKind: HOST_BRIDGE_RUNTIME_KIND,
      data,
    });
  }

  private notify<TEvent extends HostBridgeServerEventName>(
    event: TEvent,
    ...args: HostBridgeServerEventArgs[TEvent]
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

let embeddedHostClient: EmbeddedHostBridgeClient | null = null;
const directHostClients = new WeakMap<AirJamSocket, DirectHostRealtimeClient>();

export const isEmbeddedHostRuntime = (): boolean =>
  readChildHostRuntimeParams() !== null;

export const getHostRealtimeClient = (
  getSocket: DirectSocketGetter<"host">,
): AirJamRealtimeClient => {
  if (!isEmbeddedHostRuntime()) {
    const socket = getSocket("host");
    const existing = directHostClients.get(socket);
    if (existing) {
      return existing;
    }

    const client = new DirectHostRealtimeClient(socket);
    directHostClients.set(socket, client);
    return client;
  }

  if (!embeddedHostClient) {
    embeddedHostClient = new EmbeddedHostBridgeClient();
  }

  return embeddedHostClient;
};

export const resetHostRealtimeClientForTests = (): void => {
  embeddedHostClient?.disconnect();
  embeddedHostClient = null;
};

import { io, Socket } from "socket.io-client";
import type { StoreApi } from "zustand";
import type {
  ClientToServerEvents,
  ConnectionRole,
  ControllerInputPayload,
  ControllerJoinedNotice,
  ControllerLeftNotice,
  GameState,
  ServerToClientEvents,
} from "./protocol";
import { createAirJamStore, type AirJamStore } from "./state/connection-store";
import { detectRunMode } from "./utils/mode";
import { urlBuilder } from "./utils/url-builder";

export interface AirJamClientOptions {
  apiKey?: string;
  serverUrl?: string;
  role: ConnectionRole;
}

/**
 * The core Air Jam Engine.
 * Manages the Socket.io connection and the state store for a single Air Jam session.
 * This class is framework-agnostic and can be used outside of React.
 */
export class AirJamClient {
  public readonly socket: Socket<ServerToClientEvents, ClientToServerEvents>;
  public readonly store: StoreApi<AirJamStore>;
  public readonly role: ConnectionRole;
  private readonly _inputBuffer: Map<string, ControllerInputPayload> =
    new Map();
  private _listenerRegisteredAt?: number;
  public readonly _clientInstanceId: string;

  constructor(options: AirJamClientOptions) {
    this.role = options.role;
    this._clientInstanceId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // 1. Initialize State
    this.store = createAirJamStore();
    this.store.getState().setRole(options.role);
    this.store.getState().setMode(detectRunMode());

    // 2. Resolve Server URL
    const resolvedUrl = options.serverUrl || urlBuilder.resolveServerUrl();

    // 3. Initialize Socket
    this.socket = io(resolvedUrl, {
      autoConnect: false,
      reconnection: true,
      transports: ["websocket"],
    });

    // 4. Set up core listeners
    this.setupListeners();
  }

  private setupHostListeners() {
    if (this.role !== "host") return;

    // Remove existing listeners to avoid duplicates
    this.socket.off("server:controllerJoined");
    this.socket.off("server:controllerLeft");
    this.socket.off("server:input");

    this.socket.on(
      "server:controllerJoined",
      (payload: ControllerJoinedNotice) => {
        console.log(`[AirJamClient] server:controllerJoined`, payload);
        if (payload.player) {
          this.store.getState().upsertPlayer(payload.player);
        }
      },
    );

    this.socket.on("server:controllerLeft", (payload: ControllerLeftNotice) => {
      this.store.getState().removePlayer(payload.controllerId);
      this._inputBuffer.delete(payload.controllerId);
    });

    this.socket.on("server:input", (payload) => {
      this._inputBuffer.set(payload.controllerId, payload.input);
    });
  }

  private setupServerStateListener() {
    // Remove existing listener to avoid duplicates
    this.socket.off("server:state");

    const serverStateHandler = (payload: {
      state: { gameState?: GameState; message?: string };
    }) => {
      const store = this.store.getState();
      if (payload.state.gameState) {
        store.setGameState(payload.state.gameState);
      }
      if (payload.state.message !== undefined) {
        store.setStateMessage(payload.state.message);
      }
    };

    this.socket.on("server:state", serverStateHandler);
  }

  private setupListeners() {
    // Handle connect event
    const onConnect = () => {
      this.store.getState().setStatus("connected");
      this.store.getState().setError(undefined);
      // Re-register all listeners after connection to ensure they're active
      // This fixes the issue where listeners registered before socket connects don't work
      this.setupServerStateListener();
      this.setupHostListeners();
    };
    this.socket.on("connect", onConnect);

    // If socket is already connected, call handler immediately
    if (this.socket.connected) {
      onConnect();
    }

    this.socket.on("disconnect", () => {
      this.store.getState().setStatus("disconnected");
    });

    this.socket.on("server:error", (payload: { message: string }) => {
      this.store.getState().setError(payload.message);
    });

    // DO NOT register server:state or host-specific listeners here
    // They must be registered AFTER socket connects in the onConnect handler
    // This is because Socket.io listeners registered before connect don't work reliably

    // Controller-specific listeners
    if (this.role === "controller") {
      this.socket.on("server:welcome", (payload) => {
        const store = this.store.getState();
        store.setRoomId(payload.roomId);
        if (payload.controllerId) {
          store.setControllerId(payload.controllerId);
        }
        if (payload.player) {
          store.upsertPlayer(payload.player);
        }
      });

      this.socket.on("server:hostLeft", (payload) => {
        const store = this.store.getState();
        store.setError(payload.reason);
        store.setStatus("disconnected");
        store.resetGameState();
      });
    }
  }

  /**
   * Connect to the Air Jam server.
   */
  public connect() {
    // CRITICAL FIX: Check if listeners were removed by destroy() and re-register them
    // This handles React Strict Mode which calls destroy() then connect() on the same client
    const hasConnectListener = this.socket.listeners("connect").length > 0;
    if (!hasConnectListener) {
      this.setupListeners();
    }

    if (!this.socket.connected) {
      this.store.getState().setStatus("connecting");
      this.socket.connect();
      // CRITICAL FIX: Register listener immediately if socket connects synchronously
      // Socket.io may connect before the 'connect' event fires, so we check immediately
      // and also use a timeout as fallback
      const checkAndRegister = () => {
        if (this.socket.connected) {
          const hasListener = this.socket.listeners("server:state").length > 0;
          if (!hasListener) {
            this.store.getState().setStatus("connected");
            this.store.getState().setError(undefined);
            this.setupServerStateListener();
            this.setupHostListeners();
          }
        }
      };
      // Check immediately (in case socket connected synchronously)
      checkAndRegister();
      // Also check after a short delay (in case connection happens asynchronously)
      setTimeout(checkAndRegister, 50);
      setTimeout(checkAndRegister, 200);
      setTimeout(checkAndRegister, 500);
    } else {
      // Ensure listeners are registered if socket is already connected
      if (!this.socket.listeners("server:state").length) {
        this.store.getState().setStatus("connected");
        this.store.getState().setError(undefined);
        this.setupServerStateListener();
        this.setupHostListeners();
      }
    }
  }

  /**
   * Disconnect from the Air Jam server.
   */
  public disconnect() {
    this.socket.disconnect();
    this.store.getState().setStatus("disconnected");
  }

  /**
   * Get the current input buffer.
   */
  public get inputBuffer() {
    return this._inputBuffer;
  }

  /**
   * Cleanup resources.
   */
  public destroy() {
    this.disconnect();
    this.socket.removeAllListeners();
    this._inputBuffer.clear();
  }
}

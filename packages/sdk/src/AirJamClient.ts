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

    // #region agent log
    fetch("http://127.0.0.1:7245/ingest/77275639-c0f5-41c0-a729-c2568f3ab68e", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        location: "AirJamClient.ts:56",
        message: "setupHostListeners called - re-registering host listeners",
        data: {
          role: this.role,
          socketId: this.socket.id,
          socketConnected: this.socket.connected,
          clientInstanceId: this._clientInstanceId,
        },
        timestamp: Date.now(),
        sessionId: "debug-session",
        runId: "run1",
        hypothesisId: "HOST_LISTENERS_SETUP",
      }),
    }).catch(() => {});
    // #endregion

    this.socket.on(
      "server:controllerJoined",
      (payload: ControllerJoinedNotice) => {
        // #region agent log
        const logData = {
          location: "AirJamClient.ts:62",
          message: "CLIENT: server:controllerJoined event received",
          data: {
            role: this.role,
            socketId: this.socket.id,
            socketConnected: this.socket.connected,
            payload: JSON.stringify(payload),
            hasPlayer: !!payload.player,
            clientInstanceId: this._clientInstanceId,
          },
          timestamp: Date.now(),
          sessionId: "debug-session",
          runId: "run1",
          hypothesisId: "CLIENT_CONTROLLER_JOINED",
        };
        console.log(`[DEBUG] ${logData.message}`, logData.data);
        fetch(
          "http://127.0.0.1:7245/ingest/77275639-c0f5-41c0-a729-c2568f3ab68e",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(logData),
          },
        ).catch(() => {});
        // #endregion
        console.log(`[AirJamClient] server:controllerJoined`, payload);
        if (payload.player) {
          // #region agent log
          fetch(
            "http://127.0.0.1:7245/ingest/77275639-c0f5-41c0-a729-c2568f3ab68e",
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                location: "AirJamClient.ts:70",
                message: "CLIENT: calling store.upsertPlayer",
                data: {
                  playerId: payload.player.id,
                  playerLabel: payload.player.label,
                  currentPlayersCount: this.store.getState().players.length,
                  clientInstanceId: this._clientInstanceId,
                },
                timestamp: Date.now(),
                sessionId: "debug-session",
                runId: "run1",
                hypothesisId: "CLIENT_CONTROLLER_JOINED",
              }),
            },
          ).catch(() => {});
          // #endregion
          this.store.getState().upsertPlayer(payload.player);
          // #region agent log
          const newPlayersCount = this.store.getState().players.length;
          fetch(
            "http://127.0.0.1:7245/ingest/77275639-c0f5-41c0-a729-c2568f3ab68e",
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                location: "AirJamClient.ts:75",
                message: "CLIENT: store.upsertPlayer completed",
                data: {
                  playerId: payload.player.id,
                  newPlayersCount,
                  clientInstanceId: this._clientInstanceId,
                },
                timestamp: Date.now(),
                sessionId: "debug-session",
                runId: "run1",
                hypothesisId: "CLIENT_CONTROLLER_JOINED",
              }),
            },
          ).catch(() => {});
          // #endregion
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

    // #region agent log
    fetch("http://127.0.0.1:7245/ingest/77275639-c0f5-41c0-a729-c2568f3ab68e", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        location: "AirJamClient.ts:59",
        message: "setupServerStateListener called",
        data: {
          role: this.role,
          socketId: this.socket.id,
          socketConnected: this.socket.connected,
          clientInstanceId: this._clientInstanceId,
        },
        timestamp: Date.now(),
        sessionId: "debug-session",
        runId: "run1",
        hypothesisId: "I",
      }),
    }).catch(() => {});
    // #endregion

    const serverStateHandler = (payload: {
      state: { gameState?: GameState; message?: string };
    }) => {
      // #region agent log
      fetch(
        "http://127.0.0.1:7245/ingest/77275639-c0f5-41c0-a729-c2568f3ab68e",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            location: "AirJamClient.ts:64",
            message: "CLIENT: server:state event received in handler",
            data: {
              role: this.role,
              gameState: payload.state.gameState,
              message: payload.state.message,
              fullPayload: JSON.stringify(payload),
              socketId: this.socket.id,
              socketConnected: this.socket.connected,
              listenerRegisteredAt: this._listenerRegisteredAt,
              clientInstanceId: this._clientInstanceId,
            },
            timestamp: Date.now(),
            sessionId: "debug-session",
            runId: "run1",
            hypothesisId: "CLIENT_RECEIVE",
          }),
        },
      ).catch(() => {});
      // #endregion
      const store = this.store.getState();
      // #region agent log
      fetch(
        "http://127.0.0.1:7245/ingest/77275639-c0f5-41c0-a729-c2568f3ab68e",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            location: "AirJamClient.ts:75",
            message: "checking gameState in payload",
            data: {
              hasGameState: !!payload.state.gameState,
              gameStateValue: payload.state.gameState,
              currentStoreState: store.gameState,
            },
            timestamp: Date.now(),
            sessionId: "debug-session",
            runId: "run1",
            hypothesisId: "B",
          }),
        },
      ).catch(() => {});
      // #endregion
      if (payload.state.gameState) {
        // #region agent log
        fetch(
          "http://127.0.0.1:7245/ingest/77275639-c0f5-41c0-a729-c2568f3ab68e",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              location: "AirJamClient.ts:77",
              message: "calling store.setGameState",
              data: {
                newGameState: payload.state.gameState,
                currentGameState: store.gameState,
              },
              timestamp: Date.now(),
              sessionId: "debug-session",
              runId: "run1",
              hypothesisId: "B",
            }),
          },
        ).catch(() => {});
        // #endregion
        store.setGameState(payload.state.gameState);
      }
      if (payload.state.message !== undefined) {
        store.setStateMessage(payload.state.message);
      }
    };
    // #region agent log
    this._listenerRegisteredAt = Date.now();
    fetch("http://127.0.0.1:7245/ingest/77275639-c0f5-41c0-a729-c2568f3ab68e", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        location: "AirJamClient.ts:91",
        message: "registering server:state listener",
        data: {
          role: this.role,
          socketId: this.socket.id,
          socketConnected: this.socket.connected,
          clientInstanceId: this._clientInstanceId,
          listenerRegisteredAt: this._listenerRegisteredAt,
        },
        timestamp: Date.now(),
        sessionId: "debug-session",
        runId: "run1",
        hypothesisId: "H",
      }),
    }).catch(() => {});
    // #endregion
    // Wrap the handler to log when it's actually attached
    const wrappedHandler = (payload: {
      state: { gameState?: GameState; message?: string };
    }) => {
      // #region agent log
      fetch(
        "http://127.0.0.1:7245/ingest/77275639-c0f5-41c0-a729-c2568f3ab68e",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            location: "AirJamClient.ts:86",
            message: "WRAPPED_HANDLER: server:state handler invoked",
            data: {
              role: this.role,
              socketId: this.socket.id,
              socketConnected: this.socket.connected,
              clientInstanceId: this._clientInstanceId,
              payload: JSON.stringify(payload),
            },
            timestamp: Date.now(),
            sessionId: "debug-session",
            runId: "run1",
            hypothesisId: "WRAPPED",
          }),
        },
      ).catch(() => {});
      // #endregion
      serverStateHandler(payload);
    };

    this.socket.on("server:state", wrappedHandler);
    // #region agent log
    const listenerCount = this.socket.listeners("server:state").length;
    fetch("http://127.0.0.1:7245/ingest/77275639-c0f5-41c0-a729-c2568f3ab68e", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        location: "AirJamClient.ts:95",
        message: "server:state listener registered - checking socket listeners",
        data: {
          role: this.role,
          socketId: this.socket.id,
          socketConnected: this.socket.connected,
          clientInstanceId: this._clientInstanceId,
          hasListeners: listenerCount > 0,
          listenerCount,
        },
        timestamp: Date.now(),
        sessionId: "debug-session",
        runId: "run1",
        hypothesisId: "H",
      }),
    }).catch(() => {});
    // #endregion
  }

  private setupListeners() {
    // #region agent log
    fetch("http://127.0.0.1:7245/ingest/77275639-c0f5-41c0-a729-c2568f3ab68e", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        location: "AirJamClient.ts:89",
        message: "setupListeners called",
        data: {
          role: this.role,
          socketId: this.socket.id,
          socketConnected: this.socket.connected,
          clientInstanceId: this._clientInstanceId,
        },
        timestamp: Date.now(),
        sessionId: "debug-session",
        runId: "run1",
        hypothesisId: "SETUP",
      }),
    }).catch(() => {});
    // #endregion
    // Handle connect event
    const onConnect = () => {
      // #region agent log
      fetch(
        "http://127.0.0.1:7245/ingest/77275639-c0f5-41c0-a729-c2568f3ab68e",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            location: "AirJamClient.ts:92",
            message: "socket connected - onConnect handler fired",
            data: {
              role: this.role,
              socketId: this.socket.id,
              clientInstanceId: this._clientInstanceId,
              listenerRegisteredAt: this._listenerRegisteredAt,
            },
            timestamp: Date.now(),
            sessionId: "debug-session",
            runId: "run1",
            hypothesisId: "G",
          }),
        },
      ).catch(() => {});
      // #endregion
      this.store.getState().setStatus("connected");
      this.store.getState().setError(undefined);
      // Re-register all listeners after connection to ensure they're active
      // This fixes the issue where listeners registered before socket connects don't work
      // #region agent log
      fetch(
        "http://127.0.0.1:7245/ingest/77275639-c0f5-41c0-a729-c2568f3ab68e",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            location: "AirJamClient.ts:98",
            message: "about to re-register all listeners in onConnect",
            data: {
              role: this.role,
              socketId: this.socket.id,
              socketConnected: this.socket.connected,
              clientInstanceId: this._clientInstanceId,
            },
            timestamp: Date.now(),
            sessionId: "debug-session",
            runId: "run1",
            hypothesisId: "G",
          }),
        },
      ).catch(() => {});
      // #endregion
      this.setupServerStateListener();
      this.setupHostListeners();
    };
    // #region agent log
    fetch("http://127.0.0.1:7245/ingest/77275639-c0f5-41c0-a729-c2568f3ab68e", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        location: "AirJamClient.ts:100",
        message: "registering connect event listener",
        data: {
          role: this.role,
          socketId: this.socket.id,
          socketConnected: this.socket.connected,
          clientInstanceId: this._clientInstanceId,
        },
        timestamp: Date.now(),
        sessionId: "debug-session",
        runId: "run1",
        hypothesisId: "SETUP",
      }),
    }).catch(() => {});
    // #endregion
    this.socket.on("connect", onConnect);

    // If socket is already connected, call handler immediately
    if (this.socket.connected) {
      // #region agent log
      fetch(
        "http://127.0.0.1:7245/ingest/77275639-c0f5-41c0-a729-c2568f3ab68e",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            location: "AirJamClient.ts:103",
            message:
              "socket already connected when listener registered - calling onConnect immediately",
            data: {
              role: this.role,
              socketId: this.socket.id,
              clientInstanceId: this._clientInstanceId,
            },
            timestamp: Date.now(),
            sessionId: "debug-session",
            runId: "run1",
            hypothesisId: "J",
          }),
        },
      ).catch(() => {});
      // #endregion
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
    // #region agent log
    fetch("http://127.0.0.1:7245/ingest/77275639-c0f5-41c0-a729-c2568f3ab68e", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        location: "AirJamClient.ts:177",
        message: "connect() method called",
        data: {
          role: this.role,
          socketId: this.socket.id,
          socketConnected: this.socket.connected,
          clientInstanceId: this._clientInstanceId,
        },
        timestamp: Date.now(),
        sessionId: "debug-session",
        runId: "run1",
        hypothesisId: "CONNECT_METHOD",
      }),
    }).catch(() => {});
    // #endregion

    // CRITICAL FIX: Check if listeners were removed by destroy() and re-register them
    // This handles React Strict Mode which calls destroy() then connect() on the same client
    const hasConnectListener = this.socket.listeners("connect").length > 0;
    if (!hasConnectListener) {
      // #region agent log
      fetch(
        "http://127.0.0.1:7245/ingest/77275639-c0f5-41c0-a729-c2568f3ab68e",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            location: "AirJamClient.ts:182",
            message:
              "connect() detected listeners removed by destroy() - re-registering all listeners",
            data: {
              role: this.role,
              socketId: this.socket.id,
              clientInstanceId: this._clientInstanceId,
            },
            timestamp: Date.now(),
            sessionId: "debug-session",
            runId: "run1",
            hypothesisId: "CONNECT_REREGISTER",
          }),
        },
      ).catch(() => {});
      // #endregion
      this.setupListeners();
    }

    if (!this.socket.connected) {
      this.store.getState().setStatus("connecting");
      // #region agent log
      fetch(
        "http://127.0.0.1:7245/ingest/77275639-c0f5-41c0-a729-c2568f3ab68e",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            location: "AirJamClient.ts:190",
            message: "calling socket.connect()",
            data: {
              role: this.role,
              socketId: this.socket.id,
              clientInstanceId: this._clientInstanceId,
            },
            timestamp: Date.now(),
            sessionId: "debug-session",
            runId: "run1",
            hypothesisId: "CONNECT_METHOD",
          }),
        },
      ).catch(() => {});
      // #endregion
      this.socket.connect();
      // #region agent log
      fetch(
        "http://127.0.0.1:7245/ingest/77275639-c0f5-41c0-a729-c2568f3ab68e",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            location: "AirJamClient.ts:192",
            message: "socket.connect() called - checking state",
            data: {
              role: this.role,
              socketId: this.socket.id,
              socketConnected: this.socket.connected,
              clientInstanceId: this._clientInstanceId,
            },
            timestamp: Date.now(),
            sessionId: "debug-session",
            runId: "run1",
            hypothesisId: "CONNECT_METHOD",
          }),
        },
      ).catch(() => {});
      // #endregion
      // CRITICAL FIX: Register listener immediately if socket connects synchronously
      // Socket.io may connect before the 'connect' event fires, so we check immediately
      // and also use a timeout as fallback
      const checkAndRegister = () => {
        if (this.socket.connected) {
          const hasListener = this.socket.listeners("server:state").length > 0;
          // #region agent log
          fetch(
            "http://127.0.0.1:7245/ingest/77275639-c0f5-41c0-a729-c2568f3ab68e",
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                location: "AirJamClient.ts:200",
                message:
                  "checkAndRegister: socket connected, checking listener",
                data: {
                  role: this.role,
                  socketId: this.socket.id,
                  hasListener,
                  clientInstanceId: this._clientInstanceId,
                },
                timestamp: Date.now(),
                sessionId: "debug-session",
                runId: "run1",
                hypothesisId: "CONNECT_METHOD",
              }),
            },
          ).catch(() => {});
          // #endregion
          if (!hasListener) {
            // #region agent log
            fetch(
              "http://127.0.0.1:7245/ingest/77275639-c0f5-41c0-a729-c2568f3ab68e",
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  location: "AirJamClient.ts:204",
                  message:
                    "socket connected but listener missing - registering now",
                  data: {
                    role: this.role,
                    socketId: this.socket.id,
                    clientInstanceId: this._clientInstanceId,
                  },
                  timestamp: Date.now(),
                  sessionId: "debug-session",
                  runId: "run1",
                  hypothesisId: "CONNECT_METHOD",
                }),
              },
            ).catch(() => {});
            // #endregion
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
      // #region agent log
      fetch(
        "http://127.0.0.1:7245/ingest/77275639-c0f5-41c0-a729-c2568f3ab68e",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            location: "AirJamClient.ts:218",
            message: "connect() called but socket already connected",
            data: {
              role: this.role,
              socketId: this.socket.id,
              clientInstanceId: this._clientInstanceId,
            },
            timestamp: Date.now(),
            sessionId: "debug-session",
            runId: "run1",
            hypothesisId: "CONNECT_METHOD",
          }),
        },
      ).catch(() => {});
      // #endregion
      // Ensure listeners are registered if socket is already connected
      if (!this.socket.listeners("server:state").length) {
        // #region agent log
        fetch(
          "http://127.0.0.1:7245/ingest/77275639-c0f5-41c0-a729-c2568f3ab68e",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              location: "AirJamClient.ts:222",
              message:
                "socket already connected but listener missing - registering now",
              data: {
                role: this.role,
                socketId: this.socket.id,
                clientInstanceId: this._clientInstanceId,
              },
              timestamp: Date.now(),
              sessionId: "debug-session",
              runId: "run1",
              hypothesisId: "CONNECT_METHOD",
            }),
          },
        ).catch(() => {});
        // #endregion
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

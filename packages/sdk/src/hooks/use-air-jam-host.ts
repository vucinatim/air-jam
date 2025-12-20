import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { DEFAULT_MAX_PLAYERS, TOGGLE_DEBOUNCE_MS } from "../constants";
import { useAirJamContext } from "../context/AirJamProvider";
import type {
  ConnectionStatus,
  ControllerInputEvent,
  ControllerStatePayload,
  GameState,
  HapticSignalPayload,
  HostRegistrationAck,
  PlayerProfile,
  RoomCode,
  RunMode,
  SignalPayload,
  SignalType,
  ToastSignalPayload,
} from "../protocol";
import {
  controllerStateSchema,
  controllerSystemSchema,
  roomCodeSchema,
} from "../protocol";
import { generateRoomCode } from "../utils/ids";
import { urlBuilder } from "../utils/url-builder";

interface AirJamHostOptions {
  roomId?: string;
  controllerPath?: string;
  controllerUrl?: string;
  publicHost?: string;
  maxPlayers?: number;
  onInput?: (event: ControllerInputEvent) => void;
  onPlayerJoin?: (player: PlayerProfile) => void;
  onPlayerLeave?: (controllerId: string) => void;
  onChildClose?: () => void;
  forceConnect?: boolean;
}

export interface AirJamHostApi {
  roomId: RoomCode;
  joinUrl: string;
  connectionStatus: ConnectionStatus;
  players: PlayerProfile[];
  lastError?: string;
  mode: RunMode;
  gameState: GameState;
  toggleGameState: () => void;
  sendState: (state: ControllerStatePayload) => boolean;
  sendSignal: {
    (type: "HAPTIC", payload: HapticSignalPayload, targetId?: string): void;
    (type: "TOAST", payload: ToastSignalPayload, targetId?: string): void;
  };
  reconnect: () => void;
  socket: any; // ReturnType<typeof useAirJamContext>["socket"]
  isChildMode: boolean;
}

export const useAirJamHost = (
  options: AirJamHostOptions = {},
): AirJamHostApi => {
  const client = useAirJamContext();
  const { socket, store } = client;

  // 1. Core State Subscription (Context-bound)
  const connectionState = store(
    useShallow((state) => {
      // #region agent log
      fetch(
        "http://127.0.0.1:7245/ingest/77275639-c0f5-41c0-a729-c2568f3ab68e",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            location: "use-air-jam-host.ts:66",
            message: "REACT: useShallow selector executing",
            data: {
              gameState: state.gameState,
              playersCount: state.players.length,
              players: state.players.map((p) => ({ id: p.id, label: p.label })),
              connectionStatus: state.connectionStatus,
              roomId: state.roomId,
            },
            timestamp: Date.now(),
            sessionId: "debug-session",
            runId: "run1",
            hypothesisId: "REACT_SELECTOR",
          }),
        },
      ).catch(() => {});
      // #endregion
      const selected = {
        connectionStatus: state.connectionStatus,
        lastError: state.lastError,
        players: state.players,
        gameState: state.gameState,
        mode: state.mode,
        roomId: state.roomId,
      };
      // #region agent log
      fetch(
        "http://127.0.0.1:7245/ingest/77275639-c0f5-41c0-a729-c2568f3ab68e",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            location: "use-air-jam-host.ts:85",
            message: "REACT: useShallow selector returning",
            data: {
              selectedGameState: selected.gameState,
              selectedPlayersCount: selected.players.length,
              selectedPlayers: selected.players.map((p) => ({
                id: p.id,
                label: p.label,
              })),
              selectedConnectionStatus: selected.connectionStatus,
            },
            timestamp: Date.now(),
            sessionId: "debug-session",
            runId: "run1",
            hypothesisId: "REACT_SELECTOR",
          }),
        },
      ).catch(() => {});
      // #endregion
      return selected;
    }),
  );

  // #region agent log
  useEffect(() => {
    fetch("http://127.0.0.1:7245/ingest/77275639-c0f5-41c0-a729-c2568f3ab68e", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        location: "use-air-jam-host.ts:75",
        message: "useAirJamHost hook re-rendered",
        data: {
          gameState: connectionState.gameState,
          playersCount: connectionState.players.length,
          connectionStatus: connectionState.connectionStatus,
        },
        timestamp: Date.now(),
        sessionId: "debug-session",
        runId: "run1",
        hypothesisId: "D",
      }),
    }).catch(() => {});
  }, [
    connectionState.gameState,
    connectionState.players,
    connectionState.connectionStatus,
  ]);
  // #endregion

  // 2. Room & Mode Logic
  const arcadeParams = useMemo(() => {
    if (typeof window === "undefined") return null;
    const params = new URLSearchParams(window.location.search);
    const room = params.get("aj_room");
    const token = params.get("aj_token");
    return room && token ? { room, token } : null;
  }, []);

  const isChildMode = !!arcadeParams;

  const [fallbackRoomId] = useState(() => generateRoomCode());

  const parsedRoomId = useMemo<RoomCode>(() => {
    if (arcadeParams)
      return roomCodeSchema.parse(arcadeParams.room.toUpperCase());

    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const paramRoom = params.get("room");
      if (paramRoom) {
        const result = roomCodeSchema.safeParse(paramRoom.toUpperCase());
        if (result.success) return result.data;
      }
    }

    return options.roomId
      ? roomCodeSchema.parse(options.roomId.toUpperCase())
      : fallbackRoomId;
  }, [options.roomId, fallbackRoomId, arcadeParams]);

  const [joinUrl, setJoinUrl] = useState<string>("");

  // 3. Callback Refs for avoiding stale closures
  const refs = useRef({
    onInput: options.onInput,
    onPlayerJoin: options.onPlayerJoin,
    onPlayerLeave: options.onPlayerLeave,
    onChildClose: options.onChildClose,
  });

  useEffect(() => {
    refs.current = {
      onInput: options.onInput,
      onPlayerJoin: options.onPlayerJoin,
      onPlayerLeave: options.onPlayerLeave,
      onChildClose: options.onChildClose,
    };
  }, [
    options.onInput,
    options.onPlayerJoin,
    options.onPlayerLeave,
    options.onChildClose,
  ]);

  // 4. Input & Control Logic
  const [lastToggle, setLastToggle] = useState(0);

  const toggleGameState = useCallback(() => {
    // #region agent log
    fetch("http://127.0.0.1:7245/ingest/77275639-c0f5-41c0-a729-c2568f3ab68e", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        location: "use-air-jam-host.ts:126",
        message: "toggleGameState called",
        data: {
          socketConnected: socket.connected,
          parsedRoomId,
          currentGameState: connectionState.gameState,
        },
        timestamp: Date.now(),
        sessionId: "debug-session",
        runId: "run1",
        hypothesisId: "F",
      }),
    }).catch(() => {});
    // #endregion
    const now = Date.now();
    if (now - lastToggle < TOGGLE_DEBOUNCE_MS) {
      // #region agent log
      fetch(
        "http://127.0.0.1:7245/ingest/77275639-c0f5-41c0-a729-c2568f3ab68e",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            location: "use-air-jam-host.ts:129",
            message: "toggleGameState debounced",
            data: { timeSinceLastToggle: now - lastToggle },
            timestamp: Date.now(),
            sessionId: "debug-session",
            runId: "run1",
            hypothesisId: "F",
          }),
        },
      ).catch(() => {});
      // #endregion
      return;
    }
    setLastToggle(now);

    if (!socket.connected) {
      // #region agent log
      fetch(
        "http://127.0.0.1:7245/ingest/77275639-c0f5-41c0-a729-c2568f3ab68e",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            location: "use-air-jam-host.ts:135",
            message: "toggleGameState aborted - socket not connected",
            data: {},
            timestamp: Date.now(),
            sessionId: "debug-session",
            runId: "run1",
            hypothesisId: "F",
          }),
        },
      ).catch(() => {});
      // #endregion
      return;
    }

    const payload = controllerSystemSchema.safeParse({
      roomId: parsedRoomId,
      command: "toggle_pause",
    });
    if (payload.success) {
      // #region agent log
      const clientInstanceId =
        (client as { _clientInstanceId?: string })._clientInstanceId ||
        "unknown";
      fetch(
        "http://127.0.0.1:7245/ingest/77275639-c0f5-41c0-a729-c2568f3ab68e",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            location: "use-air-jam-host.ts:142",
            message: "emitting host:system toggle_pause",
            data: {
              payload: payload.data,
              socketId: socket.id,
              socketConnected: socket.connected,
              clientInstanceId: clientInstanceId,
            },
            timestamp: Date.now(),
            sessionId: "debug-session",
            runId: "run1",
            hypothesisId: "F",
          }),
        },
      ).catch(() => {});
      // #endregion
      // #region agent log
      fetch(
        "http://127.0.0.1:7245/ingest/77275639-c0f5-41c0-a729-c2568f3ab68e",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            location: "use-air-jam-host.ts:273",
            message: "CLIENT: emitting host:system to server",
            data: {
              socketId: socket.id,
              socketConnected: socket.connected,
              payload: payload.data,
              clientInstanceId: clientInstanceId,
            },
            timestamp: Date.now(),
            sessionId: "debug-session",
            runId: "run1",
            hypothesisId: "CLIENT_SEND",
          }),
        },
      ).catch(() => {});
      // #endregion
      socket.emit("host:system", payload.data);
      // #region agent log
      fetch(
        "http://127.0.0.1:7245/ingest/77275639-c0f5-41c0-a729-c2568f3ab68e",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            location: "use-air-jam-host.ts:276",
            message: "CLIENT: host:system emit completed",
            data: { socketId: socket.id },
            timestamp: Date.now(),
            sessionId: "debug-session",
            runId: "run1",
            hypothesisId: "CLIENT_SEND",
          }),
        },
      ).catch(() => {});
      // #endregion
    } else {
      // #region agent log
      fetch(
        "http://127.0.0.1:7245/ingest/77275639-c0f5-41c0-a729-c2568f3ab68e",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            location: "use-air-jam-host.ts:145",
            message: "toggleGameState payload parse failed",
            data: { error: payload.error },
            timestamp: Date.now(),
            sessionId: "debug-session",
            runId: "run1",
            hypothesisId: "F",
          }),
        },
      ).catch(() => {});
      // #endregion
    }
  }, [socket, parsedRoomId, lastToggle, connectionState.gameState, client]);

  const sendState = useCallback(
    (state: ControllerStatePayload): boolean => {
      if (!socket.connected) return false;
      const payload = controllerStateSchema.safeParse({
        roomId: parsedRoomId,
        state,
      });
      if (!payload.success) return false;
      socket.emit("host:state", payload.data);
      return true;
    },
    [socket, parsedRoomId],
  );

  const sendSignal = useCallback(
    (
      type: SignalType,
      payload: HapticSignalPayload | ToastSignalPayload,
      targetId?: string,
    ): void => {
      if (!socket.connected) return;
      socket.emit("host:signal", { targetId, type, payload } as SignalPayload);
    },
    [socket],
  ) as AirJamHostApi["sendSignal"];

  // 5. Connection Lifecycle & Registration
  useEffect(() => {
    if (client.role !== "host") return;

    const handleInput = (payload: ControllerInputEvent) =>
      refs.current.onInput?.(payload);
    const handleJoin = (payload: { player?: PlayerProfile }) => {
      if (payload.player) {
        // Zustand already updated by Client engine, but we trigger callback
        setTimeout(() => refs.current.onPlayerJoin?.(payload.player!), 0);
      }
    };
    const handleLeave = (payload: { controllerId: string }) =>
      refs.current.onPlayerLeave?.(payload.controllerId);
    const handleChildClose = () => refs.current.onChildClose?.();

    socket.on("server:input", handleInput);
    socket.on("server:controllerJoined", handleJoin);
    socket.on("server:controllerLeft", handleLeave);
    socket.on("server:closeChild", handleChildClose);

    // Initial Registration
    const register = () => {
      // #region agent log
      fetch(
        "http://127.0.0.1:7245/ingest/77275639-c0f5-41c0-a729-c2568f3ab68e",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            location: "use-air-jam-host.ts:423",
            message: "CLIENT: register() called",
            data: {
              socketConnected: socket.connected,
              socketId: socket.id,
              parsedRoomId,
            },
            timestamp: Date.now(),
            sessionId: "debug-session",
            runId: "run1",
            hypothesisId: "REGISTER",
          }),
        },
      ).catch(() => {});
      console.log("[DEBUG] register() called", {
        socketConnected: socket.connected,
        socketId: socket.id,
        parsedRoomId,
      });
      // #endregion
      const handleAck = (ack: HostRegistrationAck) => {
        // #region agent log
        fetch(
          "http://127.0.0.1:7245/ingest/77275639-c0f5-41c0-a729-c2568f3ab68e",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              location: "use-air-jam-host.ts:425",
              message: "CLIENT: handleAck received",
              data: {
                ok: ack.ok,
                roomId: ack.roomId,
                playersCount: ack.players?.length ?? 0,
                players: ack.players?.map((p) => ({
                  id: p.id,
                  label: p.label,
                })),
                gameState: ack.gameState,
              },
              timestamp: Date.now(),
              sessionId: "debug-session",
              runId: "run1",
              hypothesisId: "REGISTER_ACK",
            }),
          },
        ).catch(() => {});
        console.log("[DEBUG] handleAck received", {
          ok: ack.ok,
          playersCount: ack.players?.length,
          players: ack.players,
          gameState: ack.gameState,
        });
        // #endregion
        if (ack.ok) {
          const storeState = store.getState();
          storeState.setStatus("connected");

          if (ack.roomId) {
            storeState.setRoomId(ack.roomId);
          }
          if (ack.players) {
            // #region agent log
            console.log("[DEBUG] Processing ack.players", {
              count: ack.players.length,
              players: ack.players,
            });
            fetch(
              "http://127.0.0.1:7245/ingest/77275639-c0f5-41c0-a729-c2568f3ab68e",
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  location: "use-air-jam-host.ts:435",
                  message: "CLIENT: processing ack.players",
                  data: {
                    count: ack.players.length,
                    players: ack.players.map((p) => ({
                      id: p.id,
                      label: p.label,
                    })),
                  },
                  timestamp: Date.now(),
                  sessionId: "debug-session",
                  runId: "run1",
                  hypothesisId: "REGISTER_ACK",
                }),
              },
            ).catch(() => {});
            // #endregion
            ack.players.forEach((p: PlayerProfile) =>
              storeState.upsertPlayer(p),
            );
            // #region agent log
            console.log(
              "[DEBUG] After upsertPlayer, store players count:",
              storeState.players.length,
            );
            fetch(
              "http://127.0.0.1:7245/ingest/77275639-c0f5-41c0-a729-c2568f3ab68e",
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  location: "use-air-jam-host.ts:440",
                  message: "CLIENT: after processing ack.players",
                  data: { storePlayersCount: store.getState().players.length },
                  timestamp: Date.now(),
                  sessionId: "debug-session",
                  runId: "run1",
                  hypothesisId: "REGISTER_ACK",
                }),
              },
            ).catch(() => {});
            // #endregion
          }
          if (ack.gameState) {
            storeState.setGameState(ack.gameState);
          }
        } else {
          store.getState().setError(ack.message);
        }
      };

      if (arcadeParams) {
        socket.emit(
          "host:joinAsChild",
          {
            roomId: parsedRoomId,
            joinToken: arcadeParams.token,
          },
          handleAck,
        );
      } else {
        socket.emit(
          "host:register",
          {
            roomId: parsedRoomId,
            mode: "master",
            maxPlayers: options.maxPlayers ?? DEFAULT_MAX_PLAYERS,
          },
          handleAck,
        );
      }
    };

    if (socket.connected) register();
    else socket.once("connect", register);

    return () => {
      socket.off("server:input", handleInput);
      socket.off("server:controllerJoined", handleJoin);
      socket.off("server:controllerLeft", handleLeave);
      socket.off("server:closeChild", handleChildClose);
    };
  }, [socket, parsedRoomId, arcadeParams, options.maxPlayers]);

  // 6. URL Building
  useEffect(() => {
    (async () => {
      const url = await urlBuilder.buildControllerUrl(parsedRoomId, {
        path: options.controllerPath,
        host: options.publicHost || options.controllerUrl,
      });
      setJoinUrl(url);
    })();
  }, [
    parsedRoomId,
    options.controllerPath,
    options.publicHost,
    options.controllerUrl,
  ]);

  return {
    roomId: parsedRoomId,
    joinUrl,
    connectionStatus: connectionState.connectionStatus,
    players: connectionState.players,
    lastError: connectionState.lastError,
    mode: connectionState.mode,
    gameState: connectionState.gameState,
    toggleGameState,
    sendState,
    sendSignal,
    reconnect: () => client.connect(),
    socket,
    isChildMode,
  };
};

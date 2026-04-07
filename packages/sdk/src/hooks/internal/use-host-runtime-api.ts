import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { z } from "zod";
import { z as zod } from "zod";
import { useStore } from "zustand";
import { useShallow } from "zustand/react/shallow";
import { TOGGLE_DEBOUNCE_MS } from "../../constants";
import { useAirJamContext } from "../../context/air-jam-context";
import {
  useAssertSessionScope,
  useClaimSessionRuntimeOwner,
} from "../../context/session-scope";
import { updateDevBrowserLogContext } from "../../dev/browser-log-sink";
import { emitAirJamDiagnostic } from "../../diagnostics";
import type {
  ControllerPrivilegedCapability,
  ControllerInputEvent,
  ControllerStateMessage,
  ControllerStatePayload,
  HapticSignalPayload,
  HostBootstrapAck,
  HostBootstrapPayload,
  HostRegistrationAck,
  PlayerProfile,
  RoomCode,
  SignalPayload,
  SignalType,
  ToastSignalPayload,
} from "../../protocol";
import {
  AIRJAM_DEV_LOG_EVENTS,
  controllerStateSchema,
  controllerSystemSchema,
  ErrorCode,
  hostBootstrapSchema,
  hostCreateRoomSchema,
  hostReconnectSchema,
  roomCodeSchema,
} from "../../protocol";
import type { PlayerUpdatedNotice } from "../../protocol/notices";
import { emitAirJamDevRuntimeEvent } from "../../runtime/dev-runtime-events";
import { readEmbeddedHostChildSession } from "../../runtime/embedded-runtime-adapters";
import { getHostRealtimeClient } from "../../runtime/host-realtime-client";
import type { AirJamRealtimeClient } from "../../runtime/realtime-client";
import { detectRunMode } from "../../utils/mode";
import { urlBuilder } from "../../utils/url-builder";
import type {
  AirJamHostApi,
  AirJamHostOptions,
  JoinUrlStatus,
} from "../use-air-jam-host";

export const useHostRuntimeApi = <TSchema extends z.ZodSchema = z.ZodSchema>(
  options: AirJamHostOptions,
  hookName: string,
): AirJamHostApi<TSchema> => {
  useAssertSessionScope("host", hookName);
  useClaimSessionRuntimeOwner("host-runtime", hookName);

  const { config, store, getSocket, disconnectSocket, inputManager } =
    useAirJamContext();

  const embeddedHost = useMemo(() => readEmbeddedHostChildSession(), []);

  const shouldConnect = true;
  const storeRoomId = useStore(store, (s) => s.roomId);

  const parsedRoomId = useMemo<RoomCode | null>(() => {
    if (embeddedHost) {
      return embeddedHost.roomId;
    }

    if (storeRoomId) {
      return roomCodeSchema.parse(storeRoomId.toUpperCase());
    }

    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const paramRoom = params.get("room");
      if (paramRoom) {
        const result = roomCodeSchema.safeParse(paramRoom.toUpperCase());
        if (result.success) return result.data;
      }
    }

    if (options.roomId) {
      return roomCodeSchema.parse(options.roomId.toUpperCase());
    }

    return null;
  }, [options.roomId, storeRoomId, embeddedHost]);

  const [controllerCapability, setControllerCapability] =
    useState<ControllerPrivilegedCapability | null>(null);

  const joinUrlBuildKey = useMemo(
    () =>
      parsedRoomId
        ? `${parsedRoomId}\0${config.publicHost ?? ""}\0${controllerCapability?.token ?? ""}`
        : null,
    [config.publicHost, controllerCapability?.token, parsedRoomId],
  );
  const [computedJoinUrl, setComputedJoinUrl] = useState<{
    key: string | null;
    url: string;
    error: boolean;
  }>({
    key: null,
    url: "",
    error: false,
  });

  const onPlayerJoinRef = useRef(options.onPlayerJoin);
  const onPlayerLeaveRef = useRef(options.onPlayerLeave);
  const parsedRoomIdRef = useRef<RoomCode | null>(parsedRoomId);

  useEffect(() => {
    onPlayerJoinRef.current = options.onPlayerJoin;
    onPlayerLeaveRef.current = options.onPlayerLeave;
  }, [options.onPlayerJoin, options.onPlayerLeave]);

  useEffect(() => {
    parsedRoomIdRef.current = parsedRoomId;
  }, [parsedRoomId]);

  const connectionState = useStore(
    store,
    useShallow((state) => ({
      connectionStatus: state.connectionStatus,
      lastError: state.lastError,
      players: state.players,
      gameState: state.gameState,
      mode: state.mode,
      roomId: state.roomId,
    })),
  );
  const socket = useMemo<AirJamRealtimeClient | null>(
    () =>
      shouldConnect ? getHostRealtimeClient((role) => getSocket(role)) : null,
    [shouldConnect, getSocket],
  );

  const [lastToggle, setLastToggle] = useState(0);
  const hydrateHostPlayers = useCallback(
    (players?: PlayerProfile[]) => {
      const latestState = store.getState();
      latestState.resetPlayers();
      players?.forEach((player) => {
        latestState.upsertPlayer(player);
      });
    },
    [store],
  );
  const canEmitAuthoritativeHostState = useCallback(
    (roomId: RoomCode | null): roomId is RoomCode => {
      if (!socket || !socket.connected || !roomId) {
        return false;
      }

      const latestState = store.getState();
      return (
        latestState.registeredRoomId === roomId &&
        latestState.hostArcadeRestore.phase === "idle"
      );
    },
    [socket, store],
  );

  const emitHostRuntimeEvent = useCallback(
    ({
      event,
      level = "info",
      message,
      roomId,
      data,
    }: {
      event: (typeof AIRJAM_DEV_LOG_EVENTS.runtime)[keyof typeof AIRJAM_DEV_LOG_EVENTS.runtime];
      level?: "info" | "warn" | "error";
      message: string;
      roomId?: string;
      data?: Record<string, unknown>;
    }) => {
      emitAirJamDevRuntimeEvent({
        event,
        level,
        message,
        role: "host",
        roomId,
        data,
      });
    },
    [],
  );
  const lastObservedStateVersionRef = useRef<number | null>(null);
  const emittedInvariantKeysRef = useRef<Set<string>>(new Set());
  const emitInvariantOnce = useCallback(
    ({
      code,
      roomId,
      data,
      message,
    }: {
      code: string;
      roomId?: string;
      data?: Record<string, unknown>;
      message: string;
    }) => {
      const key = `${roomId ?? "unknown"}:${code}`;
      if (emittedInvariantKeysRef.current.has(key)) {
        return;
      }
      emittedInvariantKeysRef.current.add(key);
      emitHostRuntimeEvent({
        event: AIRJAM_DEV_LOG_EVENTS.runtime.invariantViolation,
        level: "warn",
        message,
        roomId,
        data: {
          code,
          ...data,
        },
      });
    },
    [emitHostRuntimeEvent],
  );

  const toggleGameState = useCallback(() => {
    const now = Date.now();
    if (now - lastToggle < TOGGLE_DEBOUNCE_MS) {
      return;
    }
    setLastToggle(now);

    if (!socket || !socket.connected) {
      return;
    }

    if (!parsedRoomId) return;

    const payload = controllerSystemSchema.safeParse({
      roomId: parsedRoomId,
      command: "toggle_pause",
    });
    if (payload.success) {
      socket.emit("host:system", payload.data);
    }
  }, [socket, parsedRoomId, lastToggle]);

  const sendState = useCallback(
    (state: ControllerStatePayload): boolean => {
      const activeSocket = socket;
      const activeRoomId = parsedRoomIdRef.current;
      if (!activeSocket || !canEmitAuthoritativeHostState(activeRoomId)) {
        return false;
      }
      const payload = controllerStateSchema.safeParse({
        roomId: activeRoomId,
        state,
      });
      if (!payload.success) {
        return false;
      }
      activeSocket.emit("host:state", payload.data);
      return true;
    },
    [canEmitAuthoritativeHostState, socket],
  );

  const sendSignal = useCallback(
    (
      type: SignalType,
      payload: HapticSignalPayload | ToastSignalPayload,
      targetId?: string,
    ): void => {
      if (!socket || !socket.connected) {
        return;
      }
      const signal: SignalPayload = {
        targetId,
        type,
        payload,
      } as SignalPayload;
      socket.emit("host:signal", signal);
    },
    [socket],
  ) as AirJamHostApi["sendSignal"];

  const reconnect = useCallback(() => {
    socket?.disconnect();
    if (!embeddedHost) {
      disconnectSocket("host");
    }
    if (socket) {
      socket.connect();
    }
  }, [socket, embeddedHost, disconnectSocket]);

  useEffect(() => {
    if (embeddedHost?.joinUrl) {
      return;
    }
    if (!parsedRoomId || !joinUrlBuildKey) {
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        const url = await urlBuilder.buildControllerUrl(parsedRoomId, {
          host: config.publicHost,
          capabilityToken: controllerCapability?.token,
        });
        if (!cancelled) {
          setComputedJoinUrl({
            key: joinUrlBuildKey,
            url,
            error: false,
          });
        }
      } catch {
        if (!cancelled) {
          setComputedJoinUrl({
            key: joinUrlBuildKey,
            url: "",
            error: true,
          });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    parsedRoomId,
    embeddedHost?.joinUrl,
    config.publicHost,
    controllerCapability?.token,
    joinUrlBuildKey,
  ]);

  const joinUrl = embeddedHost?.joinUrl
    ? embeddedHost.joinUrl
    : computedJoinUrl.key === joinUrlBuildKey
      ? computedJoinUrl.url
      : "";

  const joinUrlStatus: JoinUrlStatus = embeddedHost?.joinUrl
    ? "ready"
    : !joinUrlBuildKey
      ? "loading"
      : computedJoinUrl.key !== joinUrlBuildKey
        ? "loading"
        : computedJoinUrl.error
          ? "unavailable"
          : computedJoinUrl.url
            ? "ready"
            : "loading";

  const setRegisteredRoomId = useStore(store, (s) => s.setRegisteredRoomId);
  const reconnectRetryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  const setDevHostTraceId = useCallback((traceId?: string) => {
    updateDevBrowserLogContext({ traceId });
  }, []);

  useEffect(() => {
    updateDevBrowserLogContext({
      role: "host",
      roomId: parsedRoomId ?? undefined,
    });
  }, [parsedRoomId]);

  useEffect(() => {
    return () => {
      updateDevBrowserLogContext({
        role: undefined,
        roomId: undefined,
        traceId: undefined,
      });
    };
  }, []);

  const hostGrantResponseSchema = useMemo(
    () =>
      zod.object({
        hostGrant: zod.string().min(1),
      }),
    [],
  );

  useEffect(() => {
    const storeState = store.getState();
    const initialRoomId = parsedRoomIdRef.current;
    storeState.setMode(detectRunMode());
    storeState.setRole("host");
    if (initialRoomId) {
      storeState.setRoomId(initialRoomId);
    }
    storeState.setStatus("connecting");
    storeState.setError(undefined);
    lastObservedStateVersionRef.current = null;
    emittedInvariantKeysRef.current.clear();

    if (!shouldConnect || !socket) {
      storeState.setStatus("idle");
      return;
    }

    const registerHost = async () => {
      if (embeddedHost) {
        const childRoomId = embeddedHost.roomId;
        const latestState = store.getState();
        latestState.setStatus("connected");
        latestState.setRoomId(childRoomId);
        hydrateHostPlayers();
        setRegisteredRoomId(childRoomId);
        setControllerCapability(null);
        return;
      }

      const resolveBootstrapPayload =
        async (): Promise<HostBootstrapPayload> => {
          if (!config.hostGrantEndpoint) {
            return hostBootstrapSchema.parse({
              appId: config.appId,
              hostSessionKind: config.hostSessionKind,
            });
          }

          const response = await fetch(config.hostGrantEndpoint, {
            method: "POST",
            credentials: "include",
            headers: {
              "content-type": "application/json",
            },
            body: JSON.stringify(config.appId ? { appId: config.appId } : {}),
          });

          if (!response.ok) {
            throw new Error(`Failed to fetch host grant (${response.status})`);
          }

          const parsed = hostGrantResponseSchema.safeParse(
            await response.json(),
          );
          if (!parsed.success) {
            throw new Error("Invalid host grant response");
          }

          return hostBootstrapSchema.parse({
            hostGrant: parsed.data.hostGrant,
            hostSessionKind: config.hostSessionKind,
          });
        };

      let bootstrapPayload: HostBootstrapPayload;
      try {
        bootstrapPayload = await resolveBootstrapPayload();
      } catch (error) {
        const latestState = store.getState();
        const message =
          error instanceof Error
            ? error.message
            : "Failed to resolve host bootstrap grant";
        emitAirJamDiagnostic({
          code: "AJ_HOST_BOOTSTRAP_FAILED",
          severity: "error",
          message,
          details: {
            stage: "resolve_bootstrap_payload",
            hasAppId: Boolean(config.appId),
            hasHostGrantEndpoint: Boolean(config.hostGrantEndpoint),
          },
        });
        latestState.setError(message);
        latestState.setStatus("disconnected");
        latestState.clearHostArcadeRestore();
        setRegisteredRoomId(null);
        setDevHostTraceId(undefined);
        setControllerCapability(null);
        return;
      }

      const bootstrapAck = await new Promise<HostBootstrapAck>((resolve) => {
        socket.emit("host:bootstrap", bootstrapPayload, resolve);
      });

      if (!bootstrapAck.ok) {
        const latestState = store.getState();
        const message = bootstrapAck.message ?? "Failed to authorize host";
        emitAirJamDiagnostic({
          code: "AJ_HOST_BOOTSTRAP_FAILED",
          severity: "error",
          message,
          details: {
            stage: "bootstrap_ack",
            ackCode: bootstrapAck.code,
            hasAppId: Boolean(config.appId),
            hasHostGrantEndpoint: Boolean(config.hostGrantEndpoint),
          },
        });
        latestState.setError(message);
        latestState.setStatus("disconnected");
        latestState.clearHostArcadeRestore();
        setRegisteredRoomId(null);
        setDevHostTraceId(undefined);
        setControllerCapability(null);
        return;
      }

      setDevHostTraceId(bootstrapAck.traceId);

      const createNewRoom = (
        reason: "bootstrap" | "reconnect_fallback" = "bootstrap",
        details?: Record<string, unknown>,
      ) => {
        const latestState = store.getState();
        latestState.clearHostArcadeRestore();
        latestState.resetPlayers();
        setRegisteredRoomId(null);
        setControllerCapability(null);
        const payload = hostCreateRoomSchema.parse({
          maxPlayers: config.maxPlayers,
        });
        emitHostRuntimeEvent({
          event: AIRJAM_DEV_LOG_EVENTS.runtime.hostCreateRoomRequested,
          message: "Host requested room creation",
          data: {
            reason,
            maxPlayers: payload.maxPlayers,
            ...details,
          },
        });

        socket.emit("host:createRoom", payload, (ack: HostRegistrationAck) => {
          const latestState = store.getState();
          if (!ack.ok) {
            latestState.setError(ack.message ?? "Failed to create room");
            latestState.setStatus("disconnected");
            setRegisteredRoomId(null);
            setDevHostTraceId(undefined);
            setControllerCapability(null);
            return;
          }

          if (ack.roomId) {
            latestState.setStatus("connected");
            latestState.setRoomId(ack.roomId);
            latestState.clearHostArcadeRestore();
            hydrateHostPlayers(ack.players);
            setRegisteredRoomId(ack.roomId);
            setControllerCapability(ack.controllerCapability ?? null);

            if (typeof window !== "undefined") {
              sessionStorage.setItem("airjam_room_id", ack.roomId);
            }
            return;
          }

          latestState.setError("Server did not return room ID");
          latestState.setStatus("disconnected");
          setDevHostTraceId(undefined);
          setControllerCapability(null);
        });
      };

      if (typeof window !== "undefined") {
        const savedRoomId = sessionStorage.getItem("airjam_room_id");
        if (savedRoomId) {
          const reconnectPayload = hostReconnectSchema.parse({
            roomId: savedRoomId,
          });

          const maxReconnectAttempts = 12;
          const reconnectRetryDelayMs = 250;

          const attemptReconnect = (attempt: number) => {
            store.getState().setHostArcadeRestore({
              phase: "awaiting_ack",
              session: null,
            });
            emitHostRuntimeEvent({
              event: AIRJAM_DEV_LOG_EVENTS.runtime.hostReconnectRequested,
              message: "Host requested room reconnect",
              roomId: reconnectPayload.roomId,
              data: {
                attempt,
                source: "session_storage_restore",
              },
            });
            socket.emit(
              "host:reconnect",
              reconnectPayload,
              (ack: HostRegistrationAck) => {
                const latestState = store.getState();
                if (ack.ok && ack.roomId) {
                  latestState.setStatus("connected");
                  latestState.setRoomId(ack.roomId);
                hydrateHostPlayers(ack.players);
                setControllerCapability(ack.controllerCapability ?? null);
                latestState.setHostArcadeRestore(
                    ack.arcadeSession
                      ? {
                          phase: "pending_restore",
                          session: ack.arcadeSession,
                        }
                      : {
                          phase: "idle",
                          session: null,
                        },
                  );
                  setRegisteredRoomId(ack.roomId);
                  return;
                }

                if (
                  ack.code === ErrorCode.ALREADY_CONNECTED &&
                  attempt < maxReconnectAttempts
                ) {
                  emitHostRuntimeEvent({
                    event:
                      AIRJAM_DEV_LOG_EVENTS.runtime.hostReconnectRetryScheduled,
                    message: "Host reconnect retry scheduled",
                    roomId: reconnectPayload.roomId,
                    data: {
                      attempt,
                      nextAttempt: attempt + 1,
                      retryDelayMs: reconnectRetryDelayMs,
                      ackCode: ack.code,
                    },
                  });
                  reconnectRetryTimeoutRef.current = setTimeout(() => {
                    reconnectRetryTimeoutRef.current = null;
                    attemptReconnect(attempt + 1);
                  }, reconnectRetryDelayMs);
                  return;
                }

                latestState.clearHostArcadeRestore();
                if (typeof window !== "undefined") {
                  sessionStorage.removeItem("airjam_room_id");
                }
                setControllerCapability(null);
                createNewRoom("reconnect_fallback", {
                  attempt,
                  ackCode: ack.code,
                  ackMessage: ack.message,
                });
              },
            );
          };

          attemptReconnect(0);
          return;
        }
      }

      createNewRoom();
    };

    const handleConnect = (): void => {
      emitHostRuntimeEvent({
        event: AIRJAM_DEV_LOG_EVENTS.runtime.socketConnected,
        message: "Host socket connected",
        roomId: parsedRoomIdRef.current ?? undefined,
        data: {
          socketId: socket.id,
          connected: socket.connected,
        },
      });
      store.getState().setStatus("connecting");
      void registerHost();
    };

    const handleDisconnect = (reason: string): void => {
      emitHostRuntimeEvent({
        event: AIRJAM_DEV_LOG_EVENTS.runtime.socketDisconnected,
        message: "Host socket disconnected",
        roomId: parsedRoomIdRef.current ?? undefined,
        data: {
          socketId: socket.id,
          reason,
        },
      });
      store.getState().setStatus("disconnected");
      store.getState().resetPlayers();
      store.getState().resetGameState();
      lastObservedStateVersionRef.current = null;
      setRegisteredRoomId(null);
      setDevHostTraceId(undefined);
    };

    const handleConnectError = (error: Error): void => {
      emitAirJamDevRuntimeEvent({
        event: AIRJAM_DEV_LOG_EVENTS.runtime.socketConnectError,
        level: "warn",
        message: "Host socket connect error",
        role: "host",
        roomId: parsedRoomIdRef.current ?? undefined,
        data: {
          message: error.message,
          name: error.name,
        },
      });
    };

    const handleJoin = (payload: {
      controllerId: string;
      nickname?: string;
      player?: PlayerProfile;
    }): void => {
      if (!payload.player) {
        return;
      }
      store.getState().upsertPlayer(payload.player);
      setTimeout(() => {
        onPlayerJoinRef.current?.(payload.player!);
      }, 0);
    };

    const handleLeave = (payload: { controllerId: string }): void => {
      store.getState().removePlayer(payload.controllerId);
      onPlayerLeaveRef.current?.(payload.controllerId);
    };

    const handlePlayerUpdated = (payload: PlayerUpdatedNotice): void => {
      store.getState().upsertPlayer(payload.player);
    };

    const handleInput = (payload: ControllerInputEvent): void => {
      if (inputManager) {
        inputManager.handleInput(payload);
      }
    };

    const handleState = (payload: ControllerStateMessage): void => {
      const activeRoomId = parsedRoomIdRef.current;
      if (!activeRoomId || payload.roomId !== activeRoomId) return;

      emitHostRuntimeEvent({
        event: AIRJAM_DEV_LOG_EVENTS.runtime.hostStateReceived,
        message: "Host received state update",
        roomId: payload.roomId,
        data: {
          gameState: payload.state.gameState,
          orientation: payload.state.orientation,
          stateVersion: payload.state.stateVersion,
          hasMessage: payload.state.message !== undefined,
        },
      });

      const latestState = store.getState();
      const previousGameState = latestState.gameState;
      const nextGameState = payload.state.gameState ?? previousGameState;
      const incomingVersion = payload.state.stateVersion;
      const previousVersion = lastObservedStateVersionRef.current;
      if (typeof incomingVersion === "number") {
        if (previousVersion === null) {
          emitHostRuntimeEvent({
            event: AIRJAM_DEV_LOG_EVENTS.runtime.stateVersionReceived,
            message: "Host received initial room state version",
            roomId: payload.roomId,
            data: {
              stateVersion: incomingVersion,
              relation: "initial",
            },
          });
        } else if (incomingVersion <= previousVersion) {
          emitHostRuntimeEvent({
            event: AIRJAM_DEV_LOG_EVENTS.runtime.stateVersionReceived,
            level: "warn",
            message: "Host received non-monotonic room state version",
            roomId: payload.roomId,
            data: {
              stateVersion: incomingVersion,
              previousStateVersion: previousVersion,
              relation: "non_monotonic",
            },
          });
          emitInvariantOnce({
            code: "state_version_non_monotonic",
            roomId: payload.roomId,
            message: "Received non-monotonic room state version in host runtime",
            data: {
              stateVersion: incomingVersion,
              previousStateVersion: previousVersion,
            },
          });
        } else if (incomingVersion !== previousVersion + 1) {
          emitHostRuntimeEvent({
            event: AIRJAM_DEV_LOG_EVENTS.runtime.stateVersionReceived,
            message: "Host detected room state version gap",
            roomId: payload.roomId,
            data: {
              stateVersion: incomingVersion,
              previousStateVersion: previousVersion,
              relation: "gap",
            },
          });
        }
        lastObservedStateVersionRef.current =
          previousVersion === null
            ? incomingVersion
            : Math.max(previousVersion, incomingVersion);
      }
      if (
        typeof incomingVersion === "number" &&
        nextGameState !== previousGameState
      ) {
        emitHostRuntimeEvent({
          event: AIRJAM_DEV_LOG_EVENTS.runtime.phaseTransition,
          message: "Host runtime phase transition",
          roomId: payload.roomId,
          data: {
            from: previousGameState,
            to: nextGameState,
            source: "server_state",
            stateVersion: incomingVersion,
          },
        });
      }
      if (payload.state.gameState) {
        latestState.setGameState(payload.state.gameState);
      }
      if (payload.state.orientation) {
        latestState.setControllerOrientation(payload.state.orientation);
      }
      if (payload.state.message !== undefined) {
        latestState.setStateMessage(payload.state.message);
      }
    };

    const handleError = (payload: { message: string }): void => {
      store.getState().setError(payload.message);
    };

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("connect_error", handleConnectError);
    socket.on("server:controllerJoined", handleJoin);
    socket.on("server:controllerLeft", handleLeave);
    socket.on("server:playerUpdated", handlePlayerUpdated);
    socket.on("server:input", handleInput);
    socket.on("server:error", handleError);
    socket.on("server:state", handleState);

    if (socket.connected) {
      handleConnect();
    } else {
      socket.connect();
    }

    return () => {
      if (reconnectRetryTimeoutRef.current) {
        clearTimeout(reconnectRetryTimeoutRef.current);
        reconnectRetryTimeoutRef.current = null;
      }
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("connect_error", handleConnectError);
      socket.off("server:controllerJoined", handleJoin);
      socket.off("server:controllerLeft", handleLeave);
      socket.off("server:playerUpdated", handlePlayerUpdated);
      socket.off("server:input", handleInput);
      socket.off("server:error", handleError);
      socket.off("server:state", handleState);
      setDevHostTraceId(undefined);
    };
  }, [
    config.maxPlayers,
    config.appId,
    config.hostGrantEndpoint,
    config.hostSessionKind,
    embeddedHost,
    shouldConnect,
    socket,
    store,
    inputManager,
    setRegisteredRoomId,
    setDevHostTraceId,
    hostGrantResponseSchema,
    emitHostRuntimeEvent,
    emitInvariantOnce,
    hydrateHostPlayers,
  ]);

  const getInput = useCallback(
    (controllerId: string): z.infer<TSchema> | undefined => {
      if (!inputManager) {
        return undefined;
      }
      return inputManager.getInput(controllerId) as
        | z.infer<TSchema>
        | undefined;
    },
    [inputManager],
  );

  return {
    roomId: parsedRoomId ?? ("" as RoomCode),
    joinUrl,
    joinUrlStatus,
    connectionStatus: connectionState.connectionStatus,
    players: connectionState.players,
    lastError: connectionState.lastError,
    mode: connectionState.mode,
    gameState: connectionState.gameState,
    toggleGameState,
    sendState,
    sendSignal,
    reconnect,
    socket: socket ?? getHostRealtimeClient((role) => getSocket(role)),
    getInput,
  };
};

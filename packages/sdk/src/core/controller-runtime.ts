import type { StoreApi } from "zustand/vanilla";
import type { AirJamSocket } from "../context/socket-manager";
import type {
  ControllerJoinAck,
  ControllerLeaveAck,
  ControllerStateMessage,
  ControllerStatePayload,
  ControllerUpdatePlayerProfileAck,
  PlayerProfile,
  PlayerProfilePatch,
  RoomCode,
  SignalPayload,
} from "../protocol";
import {
  AIRJAM_DEV_LOG_EVENTS,
  controllerJoinSchema,
  controllerLeaveSchema,
  controllerSystemSchema,
  ErrorCode,
  playerProfilePatchSchema,
  roomCodeSchema,
} from "../protocol";
import type {
  ControllerJoinedNotice,
  ControllerLeftNotice,
  ControllerWelcomePayload,
  PlayerUpdatedNotice,
} from "../protocol/notices";
import {
  resolveAdmissionRetry,
  type AdmissionRetryDecision,
} from "../runtime/admission-retry";
import type { AirJamRealtimeClient } from "../runtime/realtime-client";
import { generateControllerId } from "../utils/ids";
import type { AirJamConnectionState } from "./connection-store";
import type { AirJamDevRuntimeEventDetail } from "./dev-events";
import type {
  AirJamControllerEnvironment,
  ControllerRoomBinding,
} from "./environment";
import type { AttachableStore } from "./replicated-store";

const HOST_LEFT_RECONNECT_DELAY_MS = 1000;

/** Options that decide which seat a controller takes. */
export interface ControllerRuntimeIdentityOptions {
  roomId?: string;
  controllerId?: string;
  capabilityToken?: string | null;
}

export interface ControllerRuntimeDependencies {
  store: StoreApi<AirJamConnectionState>;
  getSocket: (role: "controller") => AirJamSocket;
  disconnectSocket: (role: "controller") => void;
  environment: AirJamControllerEnvironment;
  /** The game's replicated stores; they mirror the host while the runtime runs. */
  stores: readonly AttachableStore[];
}

export type ControllerJoinSource = "embedded" | "options" | "url" | "unknown";

export const resolveControllerJoinSource = ({
  embeddedRoomId,
  optionRoomId,
  urlRoomId,
}: {
  embeddedRoomId?: string | null;
  optionRoomId?: string | null;
  urlRoomId?: string | null;
}): ControllerJoinSource => {
  if (embeddedRoomId) return "embedded";
  if (optionRoomId) return "options";
  if (urlRoomId) return "url";
  return "unknown";
};

const HAPTIC_PATTERNS = {
  light: 10,
  medium: 30,
  heavy: [50, 20, 50],
  success: [10, 30, 10],
  failure: [50, 50, 50, 50],
} as const;

/**
 * One controller seat in an Air Jam room: it joins or resumes the seat,
 * follows the room's players and runtime state, and sends profile changes and
 * system commands. It owns no rendering; bindings subscribe to its store.
 */
export class ControllerRuntime {
  readonly store: StoreApi<AirJamConnectionState>;
  /** The room this controller joins, or null when none was given. */
  readonly roomId: RoomCode | null;
  readonly controllerId: string;
  readonly socket: AirJamRealtimeClient | null;
  private readonly environment: AirJamControllerEnvironment;
  private readonly disconnectSocket: (role: "controller") => void;
  private readonly stores: readonly AttachableStore[];
  private readonly capabilityToken: string | null;
  private readonly joinSource: ControllerJoinSource;
  private nickname = "";
  private avatarId = "";
  private onState: ((state: ControllerStatePayload) => void) | undefined;
  // Recovery authority kept even when storage is unavailable. Never pass it
  // through the embedded game bridge, public player state or runtime logs.
  private resumeBinding: ControllerRoomBinding | null = null;
  private lastObservedStateVersion: number | null = null;
  private readonly emittedInvariantKeys = new Set<string>();
  private leaveIssued = false;
  private running = false;
  private releaseSession: (() => void) | null = null;
  private hostLeftTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor(
    dependencies: ControllerRuntimeDependencies,
    identity: ControllerRuntimeIdentityOptions = {},
  ) {
    const environment = dependencies.environment;
    this.store = dependencies.store;
    this.environment = environment;
    this.disconnectSocket = dependencies.disconnectSocket;
    this.stores = dependencies.stores;
    const embedded = environment.embedded;
    this.capabilityToken =
      identity.capabilityToken === undefined
        ? environment.capabilityToken
        : identity.capabilityToken;
    this.joinSource = resolveControllerJoinSource({
      embeddedRoomId: embedded?.roomId,
      optionRoomId: identity.roomId ?? null,
      urlRoomId: environment.requestedRoomId,
    });
    const code =
      embedded?.roomId ?? identity.roomId ?? environment.requestedRoomId;
    const parsed = code ? roomCodeSchema.safeParse(code.toUpperCase()) : null;
    this.roomId = parsed?.success ? parsed.data : null;
    this.controllerId =
      embedded?.controllerId ??
      identity.controllerId ??
      environment.requestedControllerId ??
      (this.roomId
        ? environment.readBinding(this.roomId)?.controllerId
        : undefined) ??
      generateControllerId();
    this.socket = this.roomId
      ? environment.transport(dependencies.getSocket)
      : null;
  }

  /** Whether an embedding shell admitted this controller. */
  get isEmbedded(): boolean {
    return this.environment.embedded !== null;
  }

  /** Called with every runtime state the host sends. */
  setStateListener(
    listener: ((state: ControllerStatePayload) => void) | undefined,
  ): void {
    this.onState = listener;
  }

  /** Joins the seat and keeps it until the returned stop is called. */
  start(): () => void {
    if (this.running) throw new Error("Controller runtime is already running.");
    this.running = true;
    this.updateDevLogContext();
    const unsubscribe = this.store.subscribe((state, previous) => {
      if (state.controllerId !== previous.controllerId)
        this.updateDevLogContext();
    });
    const handleSignal = (signal: SignalPayload) => this.vibrate(signal);
    this.socket?.on("server:signal", handleSignal);
    const socket = this.socket;
    const detachStores = socket
      ? this.stores.map((store) =>
          store.attach({
            socket,
            connection: this.store,
            defaultStoreDomain: this.environment.defaultStoreDomain,
            controlTarget: null,
          }),
        )
      : [];
    this.releaseSession = this.startSession();
    return () => {
      unsubscribe();
      this.socket?.off("server:signal", handleSignal);
      if (this.hostLeftTimeout) clearTimeout(this.hostLeftTimeout);
      this.hostLeftTimeout = null;
      this.releaseSession?.();
      this.releaseSession = null;
      for (const detach of detachStores) detach();
      this.leaveOnStop();
      this.environment.setDevLogContext({
        role: undefined,
        roomId: undefined,
        controllerId: undefined,
      });
      this.running = false;
    };
  }

  readonly setNickname = (value: string): void => {
    this.nickname = value;
  };

  readonly setAvatarId = (value: string): void => {
    this.avatarId = value;
  };

  readonly reconnect = (): void => {
    if (!this.roomId || !this.running) return;
    this.socket?.disconnect();
    if (!this.environment.embedded) this.disconnectSocket("controller");
    this.restartSession();
  };

  readonly leave = async (): Promise<ControllerLeaveAck> => {
    const socket = this.socket;
    const roomId = this.roomId;
    const controllerId = this.store.getState().controllerId;
    if (!socket || !roomId || !controllerId)
      return { ok: false, message: "Not connected" };
    if (!socket.connected) return { ok: true };
    const payload = controllerLeaveSchema.safeParse({ roomId, controllerId });
    if (!payload.success) return { ok: false, message: payload.error.message };

    const applyLocalLeave = () => {
      this.environment.clearBinding(roomId, controllerId);
      const state = this.store.getState();
      state.removePlayer(controllerId);
      state.setControllerId(null);
      state.setStatus("disconnected");
      state.resetRuntimeState();
    };
    this.leaveIssued = true;
    if (this.environment.embedded) {
      socket.emit("controller:leave", payload.data);
      applyLocalLeave();
      return { ok: true };
    }
    return new Promise<ControllerLeaveAck>((resolve) => {
      socket.emit(
        "controller:leave",
        payload.data,
        (ack: ControllerLeaveAck) => {
          if (ack.ok) applyLocalLeave();
          resolve(ack);
        },
      );
    });
  };

  readonly updatePlayerProfile = (
    patch: PlayerProfilePatch,
  ): Promise<ControllerUpdatePlayerProfileAck> => {
    const parsedPatch = playerProfilePatchSchema.safeParse(patch);
    if (!parsedPatch.success)
      return Promise.resolve({ ok: false, message: parsedPatch.error.message });
    const socket = this.socket;
    if (!socket || !this.roomId)
      return Promise.resolve({ ok: false, message: "Not connected" });
    const controllerId = this.store.getState().controllerId;
    if (!controllerId)
      return Promise.resolve({ ok: false, message: "No controller id" });
    const payload = {
      roomId: this.roomId,
      controllerId,
      patch: parsedPatch.data,
    };
    if (this.environment.embedded) {
      socket.emit("controller:updatePlayerProfile", payload);
      return Promise.resolve({ ok: true });
    }
    return new Promise((resolve) => {
      socket.emit(
        "controller:updatePlayerProfile",
        payload,
        (ack: ControllerUpdatePlayerProfileAck) => resolve(ack),
      );
    });
  };

  readonly sendSystemCommand = (command: "exit" | "pause" | "resume"): void => {
    const socket = this.socket;
    if (!this.roomId || !this.store.getState().controllerId || !socket) return;
    if (!socket.connected) return;
    const payload = controllerSystemSchema.safeParse({
      roomId: this.roomId,
      command,
    });
    if (payload.success) socket.emit("controller:system", payload.data);
  };

  private restartSession(): void {
    this.releaseSession?.();
    this.releaseSession = this.startSession();
  }

  private leaveOnStop(): void {
    const socket = this.socket;
    const controllerId = this.store.getState().controllerId;
    if (
      !this.environment.leaveOnStop ||
      this.environment.embedded ||
      !socket ||
      !this.roomId ||
      this.leaveIssued ||
      !controllerId ||
      !socket.connected
    )
      return;
    this.leaveIssued = true;
    socket.emit(
      "controller:leave",
      { roomId: this.roomId, controllerId },
      () => {},
    );
  }

  private vibrate(signal: SignalPayload): void {
    if (signal.type !== "HAPTIC") return;
    const payload = signal.payload;
    if (payload.pattern === "custom") {
      const sequence = payload.sequence;
      if (Array.isArray(sequence) || typeof sequence === "number")
        this.environment.vibrate(sequence);
      return;
    }
    const pattern = HAPTIC_PATTERNS[payload.pattern];
    this.environment.vibrate(
      typeof pattern === "number" ? pattern : [...pattern],
    );
  }

  private updateDevLogContext(): void {
    this.environment.setDevLogContext({
      role: "controller",
      traceId: undefined,
      roomId: this.roomId ?? undefined,
      controllerId: this.store.getState().controllerId ?? this.controllerId,
    });
  }

  private emitRuntimeEvent({
    level = "info",
    ...detail
  }: Omit<AirJamDevRuntimeEventDetail, "role" | "event" | "controllerId"> & {
    event: (typeof AIRJAM_DEV_LOG_EVENTS.runtime)[keyof typeof AIRJAM_DEV_LOG_EVENTS.runtime];
  }): void {
    this.environment.emitDevEvent({
      ...detail,
      level,
      role: "controller",
      controllerId: this.controllerId,
    });
  }

  private emitInvariantOnce({
    code,
    roomId,
    data,
    message,
  }: {
    code: string;
    roomId?: string;
    data?: Record<string, unknown>;
    message: string;
  }): void {
    const key = `${roomId ?? "unknown"}:${code}`;
    if (this.emittedInvariantKeys.has(key)) return;
    this.emittedInvariantKeys.add(key);
    this.emitRuntimeEvent({
      event: AIRJAM_DEV_LOG_EVENTS.runtime.invariantViolation,
      level: "warn",
      message,
      roomId,
      data: { code, ...data },
    });
  }

  private startSession(): () => void {
    const store = this.store;
    const initial = store.getState();
    const roomId = this.roomId;
    const socket = this.socket;
    const controllerId = this.controllerId;
    const embedded = this.environment.embedded;
    initial.setMode(this.environment.runMode);
    initial.setRole("controller");
    initial.setRoomId(roomId);
    initial.setStatus(roomId ? "connecting" : "idle");
    initial.setError(undefined);
    this.lastObservedStateVersion = null;
    this.emittedInvariantKeys.clear();

    if (!roomId || !socket) {
      initial.setStatus("idle");
      return () => {};
    }

    let disposed = false;
    let joinEpoch = 0;
    let joinRetryTimeout: ReturnType<typeof setTimeout> | null = null;
    const clearJoinRetry = () => {
      if (joinRetryTimeout) clearTimeout(joinRetryTimeout);
      joinRetryTimeout = null;
    };

    initial.setControllerId(controllerId);
    if (embedded?.playerProfile?.label || embedded?.playerProfile?.avatarId) {
      const avatarId = embedded.playerProfile.avatarId || this.avatarId;
      const fallbackPlayer: PlayerProfile = {
        id: controllerId,
        label: embedded.playerProfile.label || this.nickname || "Player",
        ...(avatarId ? { avatarId } : {}),
      };
      initial.upsertPlayer(fallbackPlayer);
    }

    const attemptJoin = (
      completedRetries: number,
      epoch: number,
      retry?: AdmissionRetryDecision,
    ): void => {
      if (disposed || epoch !== joinEpoch || !socket.connected || embedded)
        return;
      const resumeBinding =
        this.resumeBinding ??
        this.environment.readBinding(roomId, controllerId);
      const payload = controllerJoinSchema.parse({
        roomId,
        controllerId,
        deviceId: this.environment.deviceId ?? undefined,
        nickname: this.nickname || undefined,
        avatarId: this.avatarId || undefined,
        capabilityToken: this.capabilityToken ?? undefined,
        resumeCapabilityToken:
          resumeBinding?.controllerId === controllerId
            ? resumeBinding.resumeCapabilityToken
            : undefined,
      });
      this.emitRuntimeEvent({
        event: AIRJAM_DEV_LOG_EVENTS.runtime.controllerJoinRequested,
        message:
          completedRetries === 0
            ? "Controller requested room join"
            : "Controller retried room join after admission denial",
        roomId: payload.roomId,
        data: {
          joinSource: this.joinSource,
          controllerId: payload.controllerId,
          hasNickname: Boolean(payload.nickname),
          hasAvatarId: Boolean(payload.avatarId),
          hasCapabilityToken: Boolean(payload.capabilityToken),
          admissionAttempt: completedRetries + 1,
          ...(retry
            ? {
                retryReasonCode: retry.code,
                retryAfterSeconds: retry.retryAfterSeconds,
              }
            : {}),
        },
      });
      socket.emit("controller:join", payload, (ack: ControllerJoinAck) => {
        if (disposed || epoch !== joinEpoch) return;
        const state = store.getState();
        if (!ack.ok) {
          if (ack.code === ErrorCode.ROOM_NOT_FOUND)
            this.environment.clearBinding(roomId);
          state.setError(ack.message ?? "Unable to join room");
          state.resetRuntimeState();
          const decision = resolveAdmissionRetry(ack, completedRetries);
          if (decision) {
            state.setStatus("connecting");
            clearJoinRetry();
            joinRetryTimeout = setTimeout(() => {
              joinRetryTimeout = null;
              attemptJoin(completedRetries + 1, epoch, decision);
            }, decision.delayMs);
            return;
          }
          state.setStatus("disconnected");
          return;
        }
        if (ack.controllerId) {
          state.setControllerId(ack.controllerId);
          if (ack.resumeCapabilityToken) {
            const binding = {
              controllerId: ack.controllerId,
              resumeCapabilityToken: ack.resumeCapabilityToken,
            };
            this.resumeBinding = binding;
            this.environment.writeBinding(roomId, binding);
          }
        }
        state.setError(undefined);
        state.setStatus("connected");
      });
    };

    const handleConnect = (): void => {
      clearJoinRetry();
      joinEpoch += 1;
      const epoch = joinEpoch;
      this.emitRuntimeEvent({
        event: AIRJAM_DEV_LOG_EVENTS.runtime.socketConnected,
        message: "Controller socket connected",
        roomId,
        data: { socketId: socket.id, connected: socket.connected },
      });
      store.getState().setStatus("connected");
      if (embedded) return;
      attemptJoin(0, epoch);
    };

    const handleDisconnect = (reason?: string): void => {
      joinEpoch += 1;
      clearJoinRetry();
      this.emitRuntimeEvent({
        event: AIRJAM_DEV_LOG_EVENTS.runtime.socketDisconnected,
        message: "Controller socket disconnected",
        roomId,
        data: { socketId: socket.id, reason },
      });
      const state = store.getState();
      if (reason) state.setError(reason);
      state.setStatus("disconnected");
      state.resetRuntimeState();
      this.lastObservedStateVersion = null;
    };

    const handleConnectError = (error: Error): void => {
      this.emitRuntimeEvent({
        event: AIRJAM_DEV_LOG_EVENTS.runtime.socketConnectError,
        level: "warn",
        message: "Controller socket connect error",
        roomId,
        data: { message: error.message, name: error.name },
      });
    };

    const handleWelcome = (payload: ControllerWelcomePayload): void => {
      const state = store.getState();
      const storeRoomId = state.roomId;
      if (
        storeRoomId &&
        payload.roomId.toUpperCase() !== storeRoomId.toUpperCase()
      )
        return;
      if (!storeRoomId && payload.roomId) state.setRoomId(payload.roomId);
      if (Array.isArray(payload.players)) {
        state.resetPlayers();
        payload.players.forEach((player) => state.upsertPlayer(player));
      }
      if (!payload.player) {
        state.setError(
          "Welcome message received but no player profile included.",
        );
        return;
      }
      state.upsertPlayer(payload.player);
    };

    const handleControllerJoined = (payload: ControllerJoinedNotice): void => {
      if (payload.player) store.getState().upsertPlayer(payload.player);
    };

    const handleControllerLeft = (payload: ControllerLeftNotice): void => {
      store.getState().removePlayer(payload.controllerId);
    };

    const handleState = (payload: ControllerStateMessage): void => {
      if (payload.roomId !== roomId) return;
      this.observeRoomState(payload);
    };

    const handleHostLeft = (payload: { reason: string }): void => {
      const state = store.getState();
      this.environment.clearBinding(roomId);
      state.setError(payload.reason);
      state.setStatus("disconnected");
      state.resetRuntimeState();
      this.lastObservedStateVersion = null;
      this.hostLeftTimeout = setTimeout(() => {
        this.hostLeftTimeout = null;
        socket.disconnect();
        if (!embedded) this.disconnectSocket("controller");
        this.restartSession();
      }, HOST_LEFT_RECONNECT_DELAY_MS);
    };

    const handleError = (payload: { message: string }): void => {
      store.getState().setError(payload.message);
    };

    const handlePlayerUpdated = (payload: PlayerUpdatedNotice): void => {
      store.getState().upsertPlayer(payload.player);
    };

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("connect_error", handleConnectError);
    socket.on("server:welcome", handleWelcome);
    socket.on("server:controllerJoined", handleControllerJoined);
    socket.on("server:controllerLeft", handleControllerLeft);
    socket.on("server:state", handleState);
    socket.on("server:hostLeft", handleHostLeft);
    socket.on("server:error", handleError);
    socket.on("server:playerUpdated", handlePlayerUpdated);

    if (socket.connected) handleConnect();
    else socket.connect();

    return () => {
      disposed = true;
      joinEpoch += 1;
      clearJoinRetry();
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("connect_error", handleConnectError);
      socket.off("server:welcome", handleWelcome);
      socket.off("server:controllerJoined", handleControllerJoined);
      socket.off("server:controllerLeft", handleControllerLeft);
      socket.off("server:state", handleState);
      socket.off("server:hostLeft", handleHostLeft);
      socket.off("server:error", handleError);
      socket.off("server:playerUpdated", handlePlayerUpdated);
    };
  }

  private observeRoomState(payload: ControllerStateMessage): void {
    this.emitRuntimeEvent({
      event: AIRJAM_DEV_LOG_EVENTS.runtime.controllerStateReceived,
      message: "Controller received state update",
      roomId: payload.roomId,
      data: {
        runtimeState: payload.state.runtimeState,
        orientation: payload.state.orientation,
        stateVersion: payload.state.stateVersion,
        hasMessage: payload.state.message !== undefined,
      },
    });

    const state = this.store.getState();
    const previousRuntimeState = state.runtimeState;
    const nextRuntimeState = payload.state.runtimeState ?? previousRuntimeState;
    const incomingVersion = payload.state.stateVersion;
    const previousVersion = this.lastObservedStateVersion;
    if (typeof incomingVersion === "number") {
      if (previousVersion === null) {
        this.emitRuntimeEvent({
          event: AIRJAM_DEV_LOG_EVENTS.runtime.stateVersionReceived,
          message: "Controller received initial room state version",
          roomId: payload.roomId,
          data: { stateVersion: incomingVersion, relation: "initial" },
        });
      } else if (incomingVersion <= previousVersion) {
        this.emitRuntimeEvent({
          event: AIRJAM_DEV_LOG_EVENTS.runtime.stateVersionReceived,
          level: "warn",
          message: "Controller received non-monotonic room state version",
          roomId: payload.roomId,
          data: {
            stateVersion: incomingVersion,
            previousStateVersion: previousVersion,
            relation: "non_monotonic",
          },
        });
        this.emitInvariantOnce({
          code: "state_version_non_monotonic",
          roomId: payload.roomId,
          message:
            "Received non-monotonic room state version in controller runtime",
          data: {
            stateVersion: incomingVersion,
            previousStateVersion: previousVersion,
          },
        });
      } else if (incomingVersion !== previousVersion + 1) {
        this.emitRuntimeEvent({
          event: AIRJAM_DEV_LOG_EVENTS.runtime.stateVersionReceived,
          message: "Controller detected room state version gap",
          roomId: payload.roomId,
          data: {
            stateVersion: incomingVersion,
            previousStateVersion: previousVersion,
            relation: "gap",
          },
        });
      }
      this.lastObservedStateVersion =
        previousVersion === null
          ? incomingVersion
          : Math.max(previousVersion, incomingVersion);
    }
    if (
      typeof incomingVersion === "number" &&
      nextRuntimeState !== previousRuntimeState
    ) {
      this.emitRuntimeEvent({
        event: AIRJAM_DEV_LOG_EVENTS.runtime.phaseTransition,
        message: "Controller runtime phase transition",
        roomId: payload.roomId,
        data: {
          from: previousRuntimeState,
          to: nextRuntimeState,
          source: "server_state",
          stateVersion: incomingVersion,
        },
      });
    }
    if (payload.state.runtimeState)
      state.setRuntimeState(payload.state.runtimeState);
    if (payload.state.orientation)
      state.setControllerOrientation(payload.state.orientation);
    if (payload.state.message !== undefined)
      state.setStateMessage(payload.state.message);
    if (payload.state.roomSettings)
      state.setRoomSettings(payload.state.roomSettings);
    this.onState?.(payload.state);
  }
}

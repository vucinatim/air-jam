import type { z } from "zod";
import type { StoreApi } from "zustand/vanilla";
import type { AirJamSocket } from "../context/socket-manager";
import { emitAirJamDiagnostic } from "../diagnostics";
import type { InputManager } from "../internal/input-manager";
import type {
  ControllerInputEvent,
  ControllerJoinedNotice,
  ControllerPresenceNotice,
  ControllerPrivilegedCapability,
  ControllerStateMessage,
  ControllerStatePayload,
  HapticSignalPayload,
  HostBootstrapAck,
  HostBootstrapPayload,
  HostControllerActionAck,
  HostRegistrationAck,
  PlayerProfile,
  RoomCode,
  RuntimeState,
  SignalPayload,
  SignalType,
  ToastSignalPayload,
} from "../protocol";
import {
  AIRJAM_DEV_LOG_EVENTS,
  controllerStateSchema,
  ErrorCode,
  hostBootstrapSchema,
  hostCreateRoomSchema,
  hostReconnectSchema,
  hostRemoveControllerSchema,
  hostResetRoomSchema,
  roomCodeSchema,
} from "../protocol";
import {
  controllerLeasedControlSchema,
  type ControllerLeasedControlAck,
} from "../protocol/leased-control";
import type { PlayerUpdatedNotice } from "../protocol/notices";
import {
  resolveAdmissionRetry,
  type AdmissionRetryDecision,
} from "../runtime/admission-retry";
import {
  applyHostRuntimeLeasedControl,
  clearHostRuntimeParticipant,
  hostRuntimeDocumentId,
  registerHostRuntimeParticipantReceiver,
} from "../runtime/contracts/control";
import { trackHostSimulation } from "../runtime/host-pace";
import type { AirJamRealtimeClient } from "../runtime/realtime-client";
import type { AirJamConfig } from "./config";
import type { AirJamConnectionState } from "./connection-store";
import type { AirJamDevRuntimeEventDetail } from "./dev-events";
import type { AirJamHostEnvironment } from "./environment";
import type { AttachableStore } from "./replicated-store";
import { SimulationClock, type AirJamSimulation } from "./simulation";

const HOST_BOOTSTRAP_TIMEOUT_MESSAGE =
  "Host bootstrap timed out. The deployed Air Jam server may be out of sync with this client.";
const HOST_RESET_CANCELLED_MESSAGE =
  "Host room reset was cancelled because the host session changed.";
const MAX_RECONNECT_ATTEMPTS = 12;
const RECONNECT_RETRY_DELAY_MS = 250;

export interface HostRuntimeOptions {
  roomId?: string;
  /** Seeds the simulation; a recorded seed and inputs replay the same game. */
  seed?: number;
  onPlayerJoin?: (player: PlayerProfile) => void;
  onPlayerLeave?: (controllerId: string) => void;
}

export interface HostRuntimeDependencies<
  TSchema extends z.ZodSchema = z.ZodSchema,
> {
  config: AirJamConfig;
  store: StoreApi<AirJamConnectionState>;
  getSocket: (role: "host") => AirJamSocket;
  disconnectSocket: (role: "host") => void;
  inputManager: InputManager<TSchema> | null;
  environment: AirJamHostEnvironment;
  /** The game's replicated stores; they sync while the runtime runs. */
  stores: readonly AttachableStore[];
  /** The game's simulation, advanced on the SDK clock while the runtime runs. */
  simulation?: AirJamSimulation<unknown, unknown, unknown>;
}

interface PendingHostReset {
  roomId: RoomCode;
  retryTimeout: ReturnType<typeof setTimeout> | null;
  resolve: (ack: HostRegistrationAck) => void;
}

/**
 * The host side of one Air Jam room: it admits the host, creates, resumes or
 * joins the room, tracks players and controllers, receives input and relays
 * runtime state and signals. It owns no rendering; bindings subscribe to its
 * connection store.
 */
export class HostRuntime<TSchema extends z.ZodSchema = z.ZodSchema> {
  readonly socket: AirJamRealtimeClient;
  /** The game's simulation clock, or null when the game declares none. */
  readonly simulation: SimulationClock<unknown, unknown, unknown> | null;
  readonly store: StoreApi<AirJamConnectionState>;
  readonly inputManager: InputManager<TSchema> | null;
  private readonly config: AirJamConfig;
  private readonly environment: AirJamHostEnvironment;
  private readonly disconnectSocket: (role: "host") => void;
  private readonly stores: readonly AttachableStore[];
  private options: HostRuntimeOptions;
  private controllerCapability: ControllerPrivilegedCapability | null = null;
  private pendingReset: PendingHostReset | null = null;
  private lastObservedStateVersion: number | null = null;
  private readonly emittedInvariantKeys = new Set<string>();
  private reconnectRetryTimeout: ReturnType<typeof setTimeout> | null = null;
  private admissionRetryTimeout: ReturnType<typeof setTimeout> | null = null;
  private admissionEpoch = 0;
  private running = false;
  private watchedRoomId: RoomCode | null = null;
  private joinUrlKey: string | null = null;
  private releaseRoomControl: (() => void) | null = null;
  private releaseSession: (() => void) | null = null;

  constructor(
    dependencies: HostRuntimeDependencies<TSchema>,
    options: HostRuntimeOptions = {},
  ) {
    this.config = dependencies.config;
    this.store = dependencies.store;
    this.inputManager = dependencies.inputManager;
    this.environment = dependencies.environment;
    this.disconnectSocket = dependencies.disconnectSocket;
    this.stores = dependencies.stores;
    this.options = options;
    this.socket = dependencies.environment.transport(dependencies.getSocket);
    this.simulation = dependencies.simulation
      ? new SimulationClock<unknown, unknown, unknown>(
          dependencies.simulation,
          {
            input: (controllerId): unknown => this.getInput(controllerId),
            players: () => this.store.getState().players,
            runtimeState: () => this.store.getState().runtimeState,
          },
          options.seed ?? dependencies.environment.seed(),
        )
      : null;
  }

  /** The room this host is in or asking for, if any. */
  get roomId(): RoomCode | null {
    const embedded = this.environment.embedded;
    if (embedded) return embedded.roomId;
    const storeRoomId = this.store.getState().roomId;
    if (storeRoomId) return roomCodeSchema.parse(storeRoomId.toUpperCase());
    if (this.environment.requestedRoomId)
      return this.environment.requestedRoomId;
    if (this.options.roomId)
      return roomCodeSchema.parse(this.options.roomId.toUpperCase());
    return null;
  }

  setOptions(options: HostRuntimeOptions): void {
    this.options = options;
    this.handleRoomChange();
  }

  /** Connects and keeps the room until the returned stop is called. */
  start(): () => void {
    if (this.running) throw new Error("Host runtime is already running.");
    this.running = true;
    this.watchedRoomId = this.roomId;
    this.environment.setDevLogContext({
      role: "host",
      roomId: this.watchedRoomId ?? undefined,
    });
    const detachStores = this.stores.map((store) =>
      store.attach({
        socket: this.socket,
        connection: this.store,
        defaultStoreDomain: this.environment.defaultStoreDomain,
        controlTarget: this.environment.controlTarget,
      }),
    );
    this.releaseSession = this.startSession();
    this.bindRoomControl();
    this.refreshJoinUrl();
    const unsubscribe = this.store.subscribe(() => this.handleRoomChange());
    const stopFrames = this.startFrames();
    return () => {
      stopFrames();
      unsubscribe();
      this.releaseSession?.();
      this.releaseSession = null;
      for (const detach of detachStores) detach();
      this.releaseRoomControl?.();
      this.releaseRoomControl = null;
      this.cancelPendingReset();
      this.joinUrlKey = null;
      this.environment.setDevLogContext({
        role: undefined,
        roomId: undefined,
        traceId: undefined,
      });
      this.running = false;
    };
  }

  readonly getInput = (controllerId: string): z.infer<TSchema> | undefined =>
    this.inputManager?.getInput(controllerId) as z.infer<TSchema> | undefined;

  readonly sendState = (state: ControllerStatePayload): boolean => {
    const roomId = this.roomId;
    if (!this.canEmitAuthoritativeHostState(roomId)) return false;
    const payload = controllerStateSchema.safeParse({ roomId, state });
    if (!payload.success) return false;
    this.socket.emit("host:state", payload.data);
    return true;
  };

  readonly setRuntimeState = (runtimeState: RuntimeState): void => {
    if (this.store.getState().runtimeState === runtimeState) return;
    if (!this.canEmitAuthoritativeHostState(this.roomId)) return;
    this.sendState({ runtimeState });
  };

  readonly pauseRuntime = (): void => this.setRuntimeState("paused");

  readonly resumeRuntime = (): void => this.setRuntimeState("playing");

  readonly sendSignal = ((
    type: SignalType,
    payload: HapticSignalPayload | ToastSignalPayload,
    targetId?: string,
  ): void => {
    if (!this.socket.connected) return;
    this.socket.emit("host:signal", {
      targetId,
      type,
      payload,
    } as SignalPayload);
  }) as {
    (type: "HAPTIC", payload: HapticSignalPayload, targetId?: string): void;
    (type: "TOAST", payload: ToastSignalPayload, targetId?: string): void;
  };

  readonly reconnect = (): void => {
    this.socket.disconnect();
    if (!this.environment.embedded) this.disconnectSocket("host");
    this.socket.connect();
  };

  readonly removeController = async (
    controllerId: string,
  ): Promise<HostControllerActionAck> => {
    const roomId = this.roomId;
    if (!roomId)
      return { ok: false, message: "Host is not connected to a room." };
    return this.socket.emitWithAck<HostControllerActionAck>(
      "host:removeController",
      hostRemoveControllerSchema.parse({ roomId, controllerId }),
    );
  };

  readonly resetRoom = (): Promise<HostRegistrationAck> => {
    const roomId = this.roomId;
    if (!this.socket.connected || !roomId)
      return Promise.resolve({
        ok: false,
        code: ErrorCode.CONNECTION_FAILED,
        message: "Host is not connected to a room.",
      });
    const payload = hostResetRoomSchema.parse({ roomId });
    this.cancelPendingReset();

    return new Promise<HostRegistrationAck>((resolve) => {
      const operation: PendingHostReset = {
        roomId,
        retryTimeout: null,
        resolve,
      };
      this.pendingReset = operation;

      const isCurrent = () =>
        this.pendingReset === operation &&
        this.roomId === operation.roomId &&
        this.socket.connected;
      const cancelIfOwned = () => {
        if (this.pendingReset === operation) this.cancelPendingReset();
      };
      const finish = (ack: HostRegistrationAck) => {
        if (this.pendingReset !== operation) return;
        this.pendingReset = null;
        if (operation.retryTimeout) clearTimeout(operation.retryTimeout);
        operation.retryTimeout = null;
        resolve(ack);
      };

      const attempt = (
        completedRetries = 0,
        retry?: AdmissionRetryDecision,
      ) => {
        if (!isCurrent()) {
          cancelIfOwned();
          return;
        }
        this.emitRuntimeEvent({
          event: AIRJAM_DEV_LOG_EVENTS.runtime.hostResetRoomRequested,
          message:
            completedRetries === 0
              ? "Host requested local room reset"
              : "Host retried local room reset after admission denial",
          roomId,
          data: {
            admissionAttempt: completedRetries + 1,
            ...(retry
              ? {
                  retryReasonCode: retry.code,
                  retryAfterSeconds: retry.retryAfterSeconds,
                }
              : {}),
          },
        });
        void this.socket
          .emitWithAck<HostRegistrationAck>("host:resetRoom", payload)
          .then(
            (ack) => {
              if (!isCurrent()) {
                cancelIfOwned();
                return;
              }
              if (!ack.ok) {
                const decision = resolveAdmissionRetry(ack, completedRetries);
                if (decision) {
                  operation.retryTimeout = setTimeout(() => {
                    operation.retryTimeout = null;
                    attempt(completedRetries + 1, decision);
                  }, decision.delayMs);
                  return;
                }
                finish(ack);
                return;
              }
              if (!ack.roomId) {
                finish(ack);
                return;
              }
              // Detach first: the room this reset assigns must not cancel it.
              this.pendingReset = null;
              const state = this.store.getState();
              state.setStatus("connected");
              state.setRoomId(ack.roomId);
              state.setError(undefined);
              state.clearHostArcadeRestore();
              state.resetRuntimeState();
              this.hydrateRoster(ack.players, ack.controllers);
              state.setRegisteredRoomId(ack.roomId);
              this.setControllerCapability(ack.controllerCapability ?? null);
              this.persistResume(ack);
              resolve(ack);
            },
            (error: unknown) => {
              if (!isCurrent()) {
                cancelIfOwned();
                return;
              }
              finish({
                ok: false,
                code: ErrorCode.CONNECTION_FAILED,
                message:
                  error instanceof Error
                    ? error.message
                    : "Host room reset failed because the realtime connection was interrupted.",
              });
            },
          );
      };

      attempt();
    });
  };

  private startFrames(): () => void {
    const clock = this.simulation;
    const frames = this.environment.frames;
    if (!clock || !frames) return () => {};
    clock.rest();
    const tracked = trackHostSimulation(clock.pace);
    const stop = frames((now) => clock.frame(now));
    return () => {
      stop();
      tracked.release();
    };
  }

  private handleRoomChange(): void {
    if (!this.running) return;
    const roomId = this.roomId;
    if (roomId === this.watchedRoomId) return;
    this.watchedRoomId = roomId;
    this.cancelPendingReset();
    this.environment.setDevLogContext({
      role: "host",
      roomId: roomId ?? undefined,
    });
    this.bindRoomControl();
    this.refreshJoinUrl();
  }

  private setControllerCapability(
    capability: ControllerPrivilegedCapability | null,
  ): void {
    if (this.controllerCapability?.token === capability?.token) {
      this.controllerCapability = capability;
      return;
    }
    this.controllerCapability = capability;
    this.refreshJoinUrl();
  }

  private refreshJoinUrl(): void {
    if (!this.running) return;
    const state = this.store.getState();
    const embeddedJoinUrl = this.environment.embedded?.joinUrl;
    if (embeddedJoinUrl) {
      this.joinUrlKey = null;
      state.setJoinUrl(embeddedJoinUrl, "ready");
      return;
    }
    const roomId = this.roomId;
    if (!roomId) {
      this.joinUrlKey = null;
      state.setJoinUrl("", "loading");
      return;
    }
    const capabilityToken = this.controllerCapability?.token;
    const key = `${roomId}\0${capabilityToken ?? ""}`;
    if (key === this.joinUrlKey) return;
    this.joinUrlKey = key;
    state.setJoinUrl("", "loading");
    this.environment.controllerUrl(roomId, capabilityToken).then(
      (url) => {
        if (this.joinUrlKey === key)
          this.store.getState().setJoinUrl(url, "ready");
      },
      () => {
        if (this.joinUrlKey === key)
          this.store.getState().setJoinUrl("", "unavailable");
      },
    );
  }

  private cancelPendingReset(): void {
    const pending = this.pendingReset;
    if (!pending) return;
    this.pendingReset = null;
    if (pending.retryTimeout) clearTimeout(pending.retryTimeout);
    pending.resolve({
      ok: false,
      code: ErrorCode.CONNECTION_FAILED,
      message: HOST_RESET_CANCELLED_MESSAGE,
    });
  }

  private hydrateRoster(
    players?: PlayerProfile[],
    controllers?: ControllerPresenceNotice[],
  ): void {
    const state = this.store.getState();
    state.resetPlayers();
    players?.forEach((player) => state.upsertPlayer(player));
    state.resetControllerSessions();
    controllers?.forEach((controller) =>
      state.upsertControllerSession(controller),
    );
  }

  private canEmitAuthoritativeHostState(
    roomId: RoomCode | null,
  ): roomId is RoomCode {
    if (!this.socket.connected || !roomId) return false;
    const state = this.store.getState();
    return (
      state.registeredRoomId === roomId &&
      state.hostArcadeRestore.phase === "idle"
    );
  }

  private persistResume(ack: HostRegistrationAck): void {
    this.environment.writeResume(
      ack.roomId && ack.hostResumeCapability
        ? { roomId: ack.roomId, token: ack.hostResumeCapability.token }
        : null,
    );
  }

  private emitRuntimeEvent({
    level = "info",
    ...detail
  }: Omit<AirJamDevRuntimeEventDetail, "role" | "event"> & {
    event: (typeof AIRJAM_DEV_LOG_EVENTS.runtime)[keyof typeof AIRJAM_DEV_LOG_EVENTS.runtime];
  }): void {
    this.environment.emitDevEvent({ ...detail, level, role: "host" });
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

  private setTraceId(traceId: string | undefined): void {
    this.environment.setDevLogContext({ traceId });
  }

  /** Admission control for controllers this host leases to agents and tools. */
  private bindRoomControl(): void {
    this.releaseRoomControl?.();
    this.releaseRoomControl = null;
    const roomId = this.roomId;
    if (!roomId) return;
    const target = this.environment.controlTarget;
    const unregister = registerHostRuntimeParticipantReceiver(target, roomId, {
      input: this.inputManager ?? undefined,
      readState: () => {
        const state = this.store.getState();
        return {
          runtimeState: state.runtimeState,
          connectionStatus: state.connectionStatus,
        };
      },
      isParticipant: (controllerId) =>
        this.store
          .getState()
          .controllerSessions.some(
            (controller) =>
              controller.controllerId === controllerId && controller.connected,
          ),
    });
    const handleLeasedControl = (
      payload: unknown,
      acknowledge?: (ack: ControllerLeasedControlAck) => void,
    ) => {
      if (typeof acknowledge !== "function") return;
      const parsed = controllerLeasedControlSchema.safeParse(payload);
      if (!parsed.success) {
        acknowledge({ status: "rejected", reason: "invalid_request" });
        return;
      }
      if (
        parsed.data.roomId !== roomId ||
        parsed.data.expected.documentId !== hostRuntimeDocumentId(target)
      )
        return;
      try {
        acknowledge(applyHostRuntimeLeasedControl(target, parsed.data));
      } catch (error) {
        acknowledge({ status: "unconfirmed", reason: "runtime_unavailable" });
        emitAirJamDiagnostic({
          code: "AJ_PARTICIPANT_CONTROL_RUNTIME_UNAVAILABLE",
          severity: "error",
          message:
            error instanceof Error
              ? error.message
              : "Participant control runtime is unavailable.",
          details: { roomId },
        });
      }
    };
    this.socket.on("server:leasedControl", handleLeasedControl);
    this.releaseRoomControl = () => {
      this.socket.off("server:leasedControl", handleLeasedControl);
      unregister();
    };
  }

  private failAdmission(message: string): void {
    const state = this.store.getState();
    state.setError(message);
    state.setStatus("disconnected");
    state.clearHostArcadeRestore();
    state.setRegisteredRoomId(null);
    this.setTraceId(undefined);
    this.setControllerCapability(null);
  }

  private async resolveBootstrapPayload(): Promise<HostBootstrapPayload> {
    if (!this.config.hostGrantEndpoint)
      return hostBootstrapSchema.parse({
        appId: this.config.appId,
        hostSessionKind: this.config.hostSessionKind,
      });
    return hostBootstrapSchema.parse({
      hostGrant: await this.environment.requestHostGrant(
        this.config.hostGrantEndpoint,
        this.config.appId,
      ),
      hostSessionKind: this.config.hostSessionKind,
    });
  }

  private startSession(): () => void {
    const socket = this.socket;
    const store = this.store;
    let disposed = false;
    const isStale = (epoch: number) =>
      disposed || epoch !== this.admissionEpoch;
    const clearAdmissionRetry = () => {
      if (this.admissionRetryTimeout) clearTimeout(this.admissionRetryTimeout);
      this.admissionRetryTimeout = null;
    };

    const initial = store.getState();
    const initialRoomId = this.roomId;
    initial.setMode(this.environment.runMode);
    initial.setRole("host");
    if (initialRoomId) initial.setRoomId(initialRoomId);
    initial.setStatus("connecting");
    initial.setError(undefined);
    this.lastObservedStateVersion = null;
    this.emittedInvariantKeys.clear();

    const bootstrapDetails = () => ({
      hasAppId: Boolean(this.config.appId),
      hasHostGrantEndpoint: Boolean(this.config.hostGrantEndpoint),
    });

    const registerHost = async (epoch: number) => {
      const embedded = this.environment.embedded;
      if (embedded) {
        const state = store.getState();
        state.setStatus("connected");
        state.setRoomId(embedded.roomId);
        this.hydrateRoster();
        state.setRegisteredRoomId(embedded.roomId);
        this.setControllerCapability(null);
        return;
      }

      let bootstrapPayload: HostBootstrapPayload;
      try {
        bootstrapPayload = await this.resolveBootstrapPayload();
      } catch (error) {
        if (isStale(epoch)) return;
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
            ...bootstrapDetails(),
          },
        });
        this.failAdmission(message);
        return;
      }
      if (isStale(epoch) || !socket.connected) return;

      let bootstrapAck: HostBootstrapAck;
      try {
        bootstrapAck = await socket.emitWithAck<HostBootstrapAck>(
          "host:bootstrap",
          bootstrapPayload,
        );
      } catch (error) {
        if (isStale(epoch)) return;
        const message =
          error instanceof Error &&
          error.message.includes(
            'Timed out waiting for acknowledgement for realtime event "host:bootstrap".',
          )
            ? HOST_BOOTSTRAP_TIMEOUT_MESSAGE
            : error instanceof Error
              ? error.message
              : "Failed to authorize host";
        emitAirJamDiagnostic({
          code: "AJ_HOST_BOOTSTRAP_FAILED",
          severity: "error",
          message,
          details: { stage: "bootstrap_ack_timeout", ...bootstrapDetails() },
        });
        this.failAdmission(message);
        return;
      }
      if (isStale(epoch) || !socket.connected) return;

      if (!bootstrapAck.ok) {
        const message = bootstrapAck.message ?? "Failed to authorize host";
        emitAirJamDiagnostic({
          code: "AJ_HOST_BOOTSTRAP_FAILED",
          severity: "error",
          message,
          details: {
            stage: "bootstrap_ack",
            ackCode: bootstrapAck.code,
            ...bootstrapDetails(),
          },
        });
        this.failAdmission(message);
        return;
      }

      this.setTraceId(bootstrapAck.traceId);

      const createNewRoom = (
        reason: "bootstrap" | "reconnect_fallback" = "bootstrap",
        details?: Record<string, unknown>,
        completedRetries = 0,
        retry?: AdmissionRetryDecision,
      ): void => {
        if (isStale(epoch) || !socket.connected) return;
        const state = store.getState();
        state.clearHostArcadeRestore();
        state.resetPlayers();
        state.setRegisteredRoomId(null);
        this.setControllerCapability(null);
        const payload = hostCreateRoomSchema.parse({
          maxPlayers: this.config.maxPlayers,
        });
        this.emitRuntimeEvent({
          event: AIRJAM_DEV_LOG_EVENTS.runtime.hostCreateRoomRequested,
          message:
            completedRetries === 0
              ? "Host requested room creation"
              : "Host retried room creation after admission denial",
          data: {
            reason,
            maxPlayers: payload.maxPlayers,
            admissionAttempt: completedRetries + 1,
            ...(retry
              ? {
                  retryReasonCode: retry.code,
                  retryAfterSeconds: retry.retryAfterSeconds,
                }
              : {}),
            ...details,
          },
        });

        socket.emit("host:createRoom", payload, (ack: HostRegistrationAck) => {
          if (isStale(epoch)) return;
          const state = store.getState();
          if (!ack.ok) {
            state.setError(ack.message ?? "Failed to create room");
            state.setRegisteredRoomId(null);
            this.setControllerCapability(null);
            const decision = resolveAdmissionRetry(ack, completedRetries);
            if (decision) {
              state.setStatus("connecting");
              clearAdmissionRetry();
              this.admissionRetryTimeout = setTimeout(() => {
                this.admissionRetryTimeout = null;
                createNewRoom(reason, details, completedRetries + 1, decision);
              }, decision.delayMs);
              return;
            }
            state.setStatus("disconnected");
            this.setTraceId(undefined);
            return;
          }
          if (ack.roomId) {
            state.setStatus("connected");
            state.setRoomId(ack.roomId);
            state.setError(undefined);
            state.clearHostArcadeRestore();
            this.hydrateRoster(ack.players, ack.controllers);
            state.setRegisteredRoomId(ack.roomId);
            this.setControllerCapability(ack.controllerCapability ?? null);
            this.persistResume(ack);
            return;
          }
          state.setError("Server did not return room ID");
          state.setStatus("disconnected");
          this.setTraceId(undefined);
          this.setControllerCapability(null);
        });
      };

      const resume = this.environment.readResume();
      if (resume) {
        const reconnectPayload = hostReconnectSchema.parse({
          roomId: resume.roomId,
          resumeCapabilityToken: resume.token,
        });
        const attemptReconnect = (attempt: number) => {
          if (isStale(epoch) || !socket.connected) return;
          store.getState().setHostArcadeRestore({
            phase: "awaiting_ack",
            session: null,
            surfaceCheckpoint: null,
          });
          this.emitRuntimeEvent({
            event: AIRJAM_DEV_LOG_EVENTS.runtime.hostReconnectRequested,
            message: "Host requested room reconnect",
            roomId: reconnectPayload.roomId,
            data: { attempt, source: "session_storage_restore" },
          });
          socket.emit(
            "host:reconnect",
            reconnectPayload,
            (ack: HostRegistrationAck) => {
              if (isStale(epoch)) return;
              const state = store.getState();
              if (ack.ok && ack.roomId) {
                state.setStatus("connected");
                state.setRoomId(ack.roomId);
                this.hydrateRoster(ack.players, ack.controllers);
                this.setControllerCapability(ack.controllerCapability ?? null);
                const surfaceCheckpoint =
                  ack.arcadeSurfaceCheckpoint ??
                  (ack.arcadeSession ? { epoch: 1, revision: 0 } : null);
                state.setHostArcadeRestore(
                  surfaceCheckpoint
                    ? {
                        phase: "pending_restore",
                        session: ack.arcadeSession ?? null,
                        surfaceCheckpoint,
                      }
                    : { phase: "idle", session: null, surfaceCheckpoint: null },
                );
                state.setRegisteredRoomId(ack.roomId);
                this.persistResume(ack);
                return;
              }
              if (
                ack.code === ErrorCode.ALREADY_CONNECTED &&
                attempt < MAX_RECONNECT_ATTEMPTS
              ) {
                this.emitRuntimeEvent({
                  event:
                    AIRJAM_DEV_LOG_EVENTS.runtime.hostReconnectRetryScheduled,
                  message: "Host reconnect retry scheduled",
                  roomId: reconnectPayload.roomId,
                  data: {
                    attempt,
                    nextAttempt: attempt + 1,
                    retryDelayMs: RECONNECT_RETRY_DELAY_MS,
                    ackCode: ack.code,
                  },
                });
                this.reconnectRetryTimeout = setTimeout(() => {
                  this.reconnectRetryTimeout = null;
                  attemptReconnect(attempt + 1);
                }, RECONNECT_RETRY_DELAY_MS);
                return;
              }
              state.clearHostArcadeRestore();
              this.environment.writeResume(null);
              this.setControllerCapability(null);
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

      createNewRoom();
    };

    const handleConnect = (): void => {
      clearAdmissionRetry();
      this.admissionEpoch += 1;
      const epoch = this.admissionEpoch;
      this.emitRuntimeEvent({
        event: AIRJAM_DEV_LOG_EVENTS.runtime.socketConnected,
        message: "Host socket connected",
        roomId: this.roomId ?? undefined,
        data: { socketId: socket.id, connected: socket.connected },
      });
      store.getState().setStatus("connecting");
      void registerHost(epoch);
    };

    const handleDisconnect = (reason: string): void => {
      this.admissionEpoch += 1;
      clearAdmissionRetry();
      this.emitRuntimeEvent({
        event: AIRJAM_DEV_LOG_EVENTS.runtime.socketDisconnected,
        message: "Host socket disconnected",
        roomId: this.roomId ?? undefined,
        data: { socketId: socket.id, reason },
      });
      const state = store.getState();
      state.setStatus("disconnected");
      state.resetPlayers();
      state.resetRuntimeState();
      this.lastObservedStateVersion = null;
      state.setRegisteredRoomId(null);
      this.setTraceId(undefined);
    };

    const handleConnectError = (error: Error): void => {
      this.emitRuntimeEvent({
        event: AIRJAM_DEV_LOG_EVENTS.runtime.socketConnectError,
        level: "warn",
        message: "Host socket connect error",
        roomId: this.roomId ?? undefined,
        data: { message: error.message, name: error.name },
      });
    };

    const handleJoin = (payload: ControllerJoinedNotice): void => {
      store.getState().upsertControllerSession(payload);
      const player = payload.player;
      if (!player) return;
      store.getState().upsertPlayer(player);
      setTimeout(() => this.options.onPlayerJoin?.(player), 0);
    };

    const handleLeave = (payload: { controllerId: string }): void => {
      this.inputManager?.clearInput(payload.controllerId);
      const roomId = this.roomId;
      if (roomId)
        clearHostRuntimeParticipant(
          this.environment.controlTarget,
          roomId,
          payload.controllerId,
        );
      const state = store.getState();
      state.removePlayer(payload.controllerId);
      state.removeControllerSession(payload.controllerId);
      this.options.onPlayerLeave?.(payload.controllerId);
    };

    const handlePlayerUpdated = (payload: PlayerUpdatedNotice): void => {
      const state = store.getState();
      state.upsertPlayer(payload.player);
      const existing = state.controllerSessions.find(
        (controller) => controller.controllerId === payload.player.id,
      );
      if (existing)
        state.upsertControllerSession({ ...existing, player: payload.player });
    };

    const handleInput = (payload: ControllerInputEvent): void => {
      this.inputManager?.handleInput(payload);
    };

    const handleState = (payload: ControllerStateMessage): void => {
      if (payload.roomId !== this.roomId) return;
      this.observeRoomState(payload);
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

    if (socket.connected) handleConnect();
    else socket.connect();

    return () => {
      disposed = true;
      this.admissionEpoch += 1;
      clearAdmissionRetry();
      if (this.reconnectRetryTimeout) clearTimeout(this.reconnectRetryTimeout);
      this.reconnectRetryTimeout = null;
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("connect_error", handleConnectError);
      socket.off("server:controllerJoined", handleJoin);
      socket.off("server:controllerLeft", handleLeave);
      socket.off("server:playerUpdated", handlePlayerUpdated);
      socket.off("server:input", handleInput);
      socket.off("server:error", handleError);
      socket.off("server:state", handleState);
      this.setTraceId(undefined);
    };
  }

  private observeRoomState(payload: ControllerStateMessage): void {
    this.emitRuntimeEvent({
      event: AIRJAM_DEV_LOG_EVENTS.runtime.hostStateReceived,
      message: "Host received state update",
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
          message: "Host received initial room state version",
          roomId: payload.roomId,
          data: { stateVersion: incomingVersion, relation: "initial" },
        });
      } else if (incomingVersion <= previousVersion) {
        this.emitRuntimeEvent({
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
        this.emitInvariantOnce({
          code: "state_version_non_monotonic",
          roomId: payload.roomId,
          message: "Received non-monotonic room state version in host runtime",
          data: {
            stateVersion: incomingVersion,
            previousStateVersion: previousVersion,
          },
        });
      } else if (incomingVersion !== previousVersion + 1) {
        this.emitRuntimeEvent({
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
        message: "Host runtime phase transition",
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
  }
}

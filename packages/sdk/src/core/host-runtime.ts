import type { StoreApi } from "zustand/vanilla";
import type { AnyAirJamAgentContract } from "../agent/agent-contract";
import { emitAirJamDiagnostic } from "../diagnostics";
import type { AirJamPlayer, RoomCode } from "../protocol";
import { AIRJAM_DEV_LOG_EVENTS } from "../protocol";
import {
  controllerLeasedControlSchema,
  leasedControlRequestSchema,
  type ControllerLeasedControlAck,
} from "../protocol/leased-control";
import {
  AIRJAM_CONTROL_CHANNEL,
  AIRJAM_LEASED_CONTROL_REQUEST,
  presentationRequestSchema,
  roomCodeSchema,
  type ChannelCopy,
  type HapticSignalPayload,
  type PresentationDocument,
  type RuntimeState,
  type SeatId,
  type SoundSignalPayload,
  type StateDocument,
  type ToastSignalPayload,
} from "../room-protocol";
import type { PublishOptions } from "../room-session/channel-state";
import type { HostRoom, RoomRequest } from "../room-session/host-room-session";
import type { RoomSessionStatus } from "../room-session/session-link";
import {
  applyHostRuntimeLeasedControl,
  clearHostRuntimeParticipant,
  registerHostAgentContract,
  registerHostRuntimeParticipantReceiver,
} from "../runtime/contracts/control";
import type {
  HostObservationSurface,
  HostRuntimeFault,
} from "../runtime/contracts/observation";
import { HostClipRecorder } from "../runtime/host-clip-recorder";
import { registerHostObservationSurface } from "../runtime/host-observation";
import { trackHostSimulation } from "../runtime/host-pace";
import {
  describeHostRuntimeFault,
  hostRuntimeFault,
} from "../runtime/host-runtime-fault";
import { HostTimeline } from "../runtime/host-timeline";
import type { AirJamConfig } from "./config";
import {
  getReconnectingPlayerIds,
  type AirJamConnectionState,
} from "./connection-store";
import type { AirJamDevRuntimeEventDetail } from "./dev-events";
import type { AirJamHostEnvironment } from "./environment";
import { HostInput } from "./host-input";
import type { AirJamInput } from "./input";
import {
  InputRecorder,
  type AirJamInputLog,
  type AirJamInputLogCut,
  type AirJamInputLogEvent,
} from "./input-log";
import type {
  AirJamStoreRequest,
  AirJamStoreRoom,
  AttachableStore,
  StoreActionCall,
} from "./replicated-store";
import {
  HostSettings,
  type AirJamSettings,
  type SettingsValues,
} from "./settings";
import {
  SimulationClock,
  type AirJamSimulation,
  type AirJamSimulationDeclaration,
} from "./simulation";

export interface HostRuntimeOptions {
  roomId?: string;
  /** Seeds the simulation; a recorded seed and inputs replay the same game. */
  seed?: number;
  settings?: SettingsValues;
  onPlayerJoin?: (player: AirJamPlayer) => void;
  onPlayerLeave?: (controllerId: string) => void;
}

export interface HostRuntimeDependencies {
  config: AirJamConfig;
  store: StoreApi<AirJamConnectionState>;
  /** The orientation fixed by the game declaration, if any. */
  fixedControllerOrientation?: "landscape" | null;
  /** The game's declared controls, read in simulation steps. */
  input?: AirJamInput;
  settings?: AirJamSettings;
  environment: AirJamHostEnvironment;
  /** The game's replicated stores; they sync while the runtime runs. */
  stores: readonly AttachableStore[];
  /** The game's simulation, advanced on the SDK clock while the runtime runs. */
  simulation?: AirJamSimulationDeclaration<
    unknown,
    unknown,
    unknown,
    SettingsValues
  >;
  /** The game's agent contract, published for its room while the runtime runs. */
  agent?: { contract: AnyAirJamAgentContract; gameId: string };
}

/** Builds a game's host core from what its platform provides. */
export type HostRuntimeFactory = (
  dependencies: Omit<
    HostRuntimeDependencies,
    | "stores"
    | "simulation"
    | "agent"
    | "input"
    | "settings"
    | "fixedControllerOrientation"
  >,
  options?: HostRuntimeOptions,
) => HostRuntime;

export type HostObservationCapture = NonNullable<
  HostObservationSurface["capture"]
>;

/** Closes that mean this host's room is gone, so it opens a new one. */
const ROOM_GONE = new Set<string>(["not-found", "closed"]);

/**
 * The host side of one Air Jam room: it opens or reclaims the room, follows
 * its players, receives their input and answers their requests, and
 * publishes the room's presentation and the game's stores. It owns no
 * rendering; bindings subscribe to its connection store.
 */
export class HostRuntime {
  /**
   * Settles once the declared simulation is loaded, at once when it needs no
   * loading, and rejects if loading fails.
   */
  readonly ready: Promise<void>;
  readonly store: StoreApi<AirJamConnectionState>;
  /** The input lane; null when the game declares no controls. */
  readonly input: HostInput | null;
  private readonly hostSettings: HostSettings;
  readonly settings: Pick<HostSettings, "declaration" | "read" | "subscribe">;
  private timeline: HostTimeline | null = null;
  private stepAt = 0;
  private readonly recorder: InputRecorder | null;
  private readonly seed: number;
  private readonly config: AirJamConfig;
  private readonly orientation: "portrait" | "landscape";
  private readonly environment: AirJamHostEnvironment;
  private readonly stores: readonly AttachableStore[];
  private readonly declaresSimulation: boolean;
  private simulationDeclaration: AirJamSimulation<
    unknown,
    unknown,
    unknown,
    SettingsValues
  > | null = null;
  private clock: SimulationClock<
    unknown,
    unknown,
    unknown,
    SettingsValues
  > | null = null;
  private frameFault: HostRuntimeFault | null = null;
  private stopFrames: (() => void) | null = null;
  private readonly agent: HostRuntimeDependencies["agent"];
  private capture: HostObservationCapture | null = null;
  private readonly clips = new HostClipRecorder({
    capture: () => this.capture,
    now: () => this.environment.now(),
    onCaptureError: (error) =>
      this.emitRuntimeEvent({
        event: AIRJAM_DEV_LOG_EVENTS.runtime.clipCaptureFailed,
        code: "clip_capture_failed",
        level: "error",
        message: error instanceof Error ? error.message : String(error),
        roomId: this.roomId ?? undefined,
      }),
  });
  private options: HostRuntimeOptions;
  private running = false;
  private currentRoom: HostRoom | null = null;
  private releaseRoom: (() => void) | null = null;
  /** The room's copies from this page's first welcome, taken back once. */
  private restorable: ReadonlyMap<string, ChannelCopy> | null = null;
  private readonly restorers = new Map<string, (copy: ChannelCopy) => void>();
  private readonly answerers = new Map<
    string,
    (request: AirJamStoreRequest) => unknown
  >();
  /** Every channel's latest document, so a new room starts with all of them. */
  private readonly published = new Map<
    string,
    { document: StateDocument; options: PublishOptions }
  >();
  private knownSeats = new Map<SeatId, AirJamPlayer>();
  private joinUrlKey: string | null = null;
  private releaseRoomControl: (() => void) | null = null;
  private releaseObservation: (() => void) | null = null;

  constructor(
    dependencies: HostRuntimeDependencies,
    options: HostRuntimeOptions = {},
  ) {
    this.hostSettings = new HostSettings(
      dependencies.settings,
      options.settings,
    );
    this.settings = Object.freeze({
      declaration: this.hostSettings.declaration,
      read: this.hostSettings.read,
      subscribe: this.hostSettings.subscribe,
    });
    this.config = dependencies.config;
    this.store = dependencies.store;
    if (dependencies.input && !dependencies.simulation)
      throw new Error(
        "A game reads its declared input in simulation steps. Declare a simulation with defineAirJamGame({ simulation }).",
      );
    this.input = dependencies.input
      ? new HostInput(dependencies.input, () => this.environment.now())
      : null;
    this.recorder = dependencies.simulation ? new InputRecorder() : null;
    this.timeline = dependencies.simulation
      ? new HostTimeline(Date.now())
      : null;
    this.environment = dependencies.environment;
    this.stores = dependencies.stores;
    this.agent = dependencies.agent;
    this.options = options;
    this.orientation = dependencies.fixedControllerOrientation ?? "portrait";
    const seed = options.seed ?? dependencies.environment.seed();
    this.seed = seed;
    const install = (
      simulation: AirJamSimulation<unknown, unknown, unknown, SettingsValues>,
    ): void => {
      this.simulationDeclaration = simulation;
      this.timeline?.start(Date.now());
      const clock = new SimulationClock<
        unknown,
        unknown,
        unknown,
        SettingsValues
      >(
        simulation,
        {
          beginStep: (tick) => {
            this.stepAt = Date.now();
            const changes = this.input?.sample() ?? [];
            this.recorder?.flush(
              tick,
              changes.map(({ controllerId, input }) => ({
                event: "input" as const,
                payload: structuredClone({ seat: controllerId, input }),
              })),
              simulation.stepMs,
            );
          },
          input: (controllerId) => this.input?.read(controllerId) ?? {},
          players: () => this.store.getState().players,
          reconnectingPlayerIds: () =>
            getReconnectingPlayerIds(this.store.getState().players),
          settings: () => this.settings.read().values,
          runtimeState: () => this.store.getState().runtimeState,
        },
        seed,
      );
      this.clock = clock;
      clock.onEvent((event) => {
        this.timeline?.moment(
          simulation.moment?.(event),
          clock.ticks,
          this.stepAt,
        );
      });
    };
    const declared = dependencies.simulation;
    this.declaresSimulation = Boolean(declared);
    if (typeof declared === "function")
      this.ready = declared().then((simulation) => {
        install(simulation);
        if (!this.running) return;
        this.stopFrames = this.startFrames();
        const roomId = this.roomId;
        if (roomId) this.bindObservation(roomId);
      });
    else {
      if (declared) install(declared);
      this.ready = Promise.resolve();
    }
  }

  /** The exception that stopped this host's display loop, if any. */
  get fault(): HostRuntimeFault | null {
    return this.frameFault;
  }

  /** The game's simulation clock; null while it loads or when the game declares none. */
  get simulation(): SimulationClock<
    unknown,
    unknown,
    unknown,
    SettingsValues
  > | null {
    return this.clock;
  }

  /**
   * The room this host holds while it runs: what a launcher serves its
   * embedded game's frame from, and what it tells which activity is on screen.
   */
  get room(): HostRoom | null {
    return this.currentRoom;
  }

  /**
   * Game time in milliseconds: the simulation's time when the game declares
   * one (zero while it loads), else the host's clock.
   */
  readonly now = (): number =>
    this.declaresSimulation
      ? (this.clock?.timeMs ?? 0)
      : this.environment.now();

  /** Whether this match's input log has reached its time or entry limit. */
  get inputLogFull(): boolean {
    return this.recorder?.full ?? false;
  }

  /** Everything that reached this simulated game, from its real seed. */
  inputLog(cut?: AirJamInputLogCut): AirJamInputLog {
    if (!this.recorder)
      throw new Error(
        "replay_unsupported: This game has no simulation, so its matches cannot be replayed; record a clip instead.",
      );
    const simulation = this.simulationDeclaration;
    if (!simulation)
      throw new Error(
        "replay_loading: This game's simulation is still loading.",
      );
    return this.recorder.log(
      {
        seed: this.seed,
        settings: this.hostSettings.initial,
        stepMs: simulation.stepMs,
        storeDomain: this.environment.defaultStoreDomain,
      },
      cut,
    );
  }

  readonly updateSettings = (
    patch: SettingsValues,
    expectedRevision: number,
  ) => {
    if (this.clock?.stepping)
      throw new Error(
        "AJ_SETTING_INVALID: Settings change between simulation steps.",
      );
    // The input log starts from the settings the simulation was created with.
    if (this.declaresSimulation && !this.clock)
      throw new Error(
        "AJ_SETTING_INVALID: Settings change once the game's simulation has loaded.",
      );
    return this.hostSettings.update(patch, expectedRevision, (revision) => {
      this.recordRoomEvent("settings", { patch: { ...patch }, revision });
    });
  };

  /** The room this host is in or asking for, if any. */
  get roomId(): RoomCode | null {
    return this.currentRoom?.code ?? this.requestedCode ?? null;
  }

  /** The code the page asked for, which a local server honours. */
  private get requestedCode(): RoomCode | undefined {
    if (this.environment.requestedRoomId)
      return this.environment.requestedRoomId;
    if (this.options.roomId)
      return roomCodeSchema.parse(this.options.roomId.toUpperCase());
    return undefined;
  }

  setOptions(options: HostRuntimeOptions): void {
    this.options = options;
  }

  /** Opens or reclaims the room and keeps it until the returned stop is called. */
  start(): () => void {
    if (this.running) throw new Error("Host runtime is already running.");
    this.running = true;
    const initial = this.store.getState();
    initial.setMode(this.environment.runMode);
    initial.setRole("host");
    initial.setError(undefined);
    this.environment.setDevLogContext({
      role: "host",
      roomId: this.roomId ?? undefined,
    });
    const storeRoom = this.storeRoom();
    const detachStores = this.stores.map((store) =>
      store.attach({
        room: storeRoom,
        connection: this.store,
        defaultStoreDomain: this.environment.defaultStoreDomain,
        controlTarget: this.environment.controlTarget,
        now: this.now,
        emitDevEvent: (detail) => this.environment.emitDevEvent(detail),
        settings: () => this.settings.read().values,
      }),
    );
    this.publishPresentation();
    const stopRecordingActions = this.recordActions();
    this.openRoom(this.environment.readResume());
    this.refreshJoinUrl();
    this.stopFrames = this.startFrames();
    return () => {
      this.clips.dispose();
      for (const stop of stopRecordingActions) stop();
      this.stopFrames?.();
      this.stopFrames = null;
      this.closeRoom();
      for (const detach of detachStores) detach();
      this.releaseRoomControl?.();
      this.releaseRoomControl = null;
      this.joinUrlKey = null;
      this.environment.setDevLogContext({
        role: undefined,
        roomId: undefined,
        traceId: undefined,
      });
      this.running = false;
    };
  }

  /**
   * Lets agents receive an image of what the host draws. Pass null when the
   * drawing surface goes away.
   */
  readonly setObservationCapture = (
    capture: HostObservationCapture | null,
  ): void => {
    if (capture !== this.capture) this.clips.dispose();
    if (Boolean(capture) === Boolean(this.capture)) {
      this.capture = capture;
      return;
    }
    this.capture = capture;
    const roomId = this.roomId;
    if (this.running && roomId) this.bindObservation(roomId);
  };

  readonly setRuntimeState = (runtimeState: RuntimeState): void => {
    const state = this.store.getState();
    const previous = state.runtimeState;
    if (previous === runtimeState) return;
    state.setRuntimeState(runtimeState);
    this.recordRoomEvent("runtime", { runtimeState });
    this.emitRuntimeEvent({
      event: AIRJAM_DEV_LOG_EVENTS.runtime.phaseTransition,
      message: "Host runtime phase transition",
      roomId: this.roomId ?? undefined,
      data: { from: previous, to: runtimeState },
    });
    this.publishPresentation();
  };

  readonly pauseRuntime = (): void => this.setRuntimeState("paused");

  readonly resumeRuntime = (): void => this.setRuntimeState("playing");

  readonly sendSignal = ((
    type: "HAPTIC" | "TOAST",
    payload: HapticSignalPayload | ToastSignalPayload,
    targetId?: string,
  ): void => {
    this.currentRoom?.signal(
      type === "HAPTIC" ? "haptic" : "toast",
      payload,
      targetId,
    );
  }) as {
    (type: "HAPTIC", payload: HapticSignalPayload, targetId?: string): void;
    (type: "TOAST", payload: ToastSignalPayload, targetId?: string): void;
  };

  /** Plays a sound on one phone or every phone. */
  readonly playSoundOnControllers = (
    sound: SoundSignalPayload,
    targetId?: string,
  ): void => {
    this.currentRoom?.signal("sound", sound, targetId);
  };

  /** Frees a player's seat and closes their phone for good. */
  readonly removeController = (controllerId: string): void => {
    this.currentRoom?.remove(controllerId);
  };

  /** Applies an action a recorded match applied between steps, as a replay does. */
  readonly replayAction = (call: StoreActionCall): void => {
    for (const store of this.stores) store.replayAction(call);
  };

  /** Ends this room for every device and opens a new one with a new code. */
  readonly resetRoom = (): void => {
    if (!this.running) return;
    this.emitRuntimeEvent({
      event: AIRJAM_DEV_LOG_EVENTS.runtime.hostResetRoomRequested,
      message: "Host ended its room to open a new one",
      roomId: this.roomId ?? undefined,
    });
    this.currentRoom?.end();
    this.closeRoom();
    this.environment.writeResume(null);
    this.followSeats([]);
    this.store.getState().resetRuntimeState();
    this.publishPresentation();
    this.openRoom(null);
  };

  /** The view replicated stores have of this host's room. */
  private storeRoom(): AirJamStoreRoom {
    return {
      role: "host",
      publish: (channel, document, options) => {
        this.published.set(channel, { document, options });
        this.currentRoom?.publish(channel, document, options);
      },
      onRestore: (channel, restore) => {
        this.restorers.set(channel, restore);
        return () => this.restorers.delete(channel);
      },
      answer: (channel, answer) => {
        this.answerers.set(channel, answer);
        return () => this.answerers.delete(channel);
      },
    };
  }

  private publishPresentation(): void {
    const { runtimeState } = this.store.getState();
    const document: PresentationDocument = {
      runtimeState,
      orientation: this.orientation,
    };
    this.store.getState().setControllerOrientation(this.orientation);
    const channel = this.environment.presentationChannel;
    this.published.set(channel, { document, options: {} });
    this.currentRoom?.publish(channel, document, {});
  }

  /** Opens a session to a new room, or to the one `resume` names. */
  private openRoom(resume: ReturnType<AirJamHostEnvironment["readResume"]>) {
    const endpoint = this.config.hostGrantEndpoint;
    const key = resume?.key ?? this.environment.createKey();
    const room = this.environment.openRoom({
      key,
      code: resume?.code ?? this.requestedCode,
      instance: resume?.instance,
      seats: this.config.maxPlayers,
      ...(this.input ? { input: this.input.declaration } : {}),
      ...(endpoint
        ? {
            credential: () =>
              this.environment.requestHostGrant(endpoint, this.config.appId),
          }
        : {}),
    });
    this.currentRoom = room;
    this.restorable = null;
    for (const [channel, { document, options }] of this.published)
      room.publish(channel, document, options);
    const releases = [
      room.on("status", (status) => this.followStatus(room, key, status)),
      room.on("seats", (seats) => this.followSeats(seats)),
      room.on("input", ({ seat, state }) => this.input?.receive(seat, state)),
      // A seat's new page counts its presses from zero again.
      room.on("inputBaseline", (seat) => this.input?.clearInput(seat)),
      room.on("request", (request) => this.answer(room, request)),
    ];
    this.releaseRoom = () => {
      for (const release of releases) release();
      room.close();
    };
    this.followStatus(room, key, room.status);
  }

  private closeRoom(): void {
    this.releaseRoom?.();
    this.releaseRoom = null;
    this.currentRoom = null;
  }

  private followStatus(
    room: HostRoom,
    key: string,
    status: RoomSessionStatus,
  ): void {
    if (room !== this.currentRoom) return;
    const state = this.store.getState();
    this.emitRuntimeEvent({
      event: AIRJAM_DEV_LOG_EVENTS.runtime.roomStatus,
      message: `Host room ${status.phase}`,
      roomId: room.code ?? undefined,
      data: { ...status },
    });
    switch (status.phase) {
      case "connecting":
        state.setStatus("connecting");
        return;
      case "waiting":
        state.setStatus("connecting");
        state.setQueuePosition(status.position);
        return;
      case "reconnecting":
        state.setStatus("reconnecting");
        return;
      case "open": {
        const code = room.code;
        const instance = room.instance;
        if (!code || !instance) return;
        state.setQueuePosition(null);
        state.setError(undefined);
        state.setRoomId(code);
        state.setStatus("connected");
        this.environment.writeResume({ key, code, instance });
        this.environment.setDevLogContext({ role: "host", roomId: code });
        if (this.restorable === null) {
          this.restorable = new Map(
            room.roomCopies.map((copy) => [copy.channel, copy]),
          );
          for (const [channel, restore] of this.restorers) {
            const copy = this.restorable.get(channel);
            if (copy) restore(copy);
          }
        }
        this.bindRoomControl();
        this.refreshJoinUrl();
        return;
      }
      case "closed": {
        state.setStatus("disconnected");
        state.setQueuePosition(null);
        if (status.reason === "owner") return;
        // An embedded host's room is its parent's; the parent replaces it.
        if (
          ROOM_GONE.has(status.reason) &&
          this.running &&
          !this.environment.embedded
        ) {
          this.closeRoom();
          this.environment.writeResume(null);
          this.followSeats([]);
          this.openRoom(null);
          return;
        }
        const message = `The room closed the connection: ${status.reason}.`;
        emitAirJamDiagnostic({
          code: "AJ_HOST_BOOTSTRAP_FAILED",
          severity: "error",
          message,
          details: { reason: status.reason, roomId: room.code ?? null },
        });
        state.setError(message);
        return;
      }
    }
  }

  private followSeats(seats: readonly AirJamPlayer[]): void {
    const roomId = this.roomId;
    const next = new Map(seats.map((seat) => [seat.id, seat]));
    for (const seat of seats) {
      const known = this.knownSeats.get(seat.id);
      if (JSON.stringify(known) === JSON.stringify(seat)) continue;
      this.recordRoomEvent("seat", { seat });
      if (!seat.connected) this.input?.clearInput(seat.id);
      if (!known) setTimeout(() => this.options.onPlayerJoin?.(seat), 0);
    }
    for (const id of this.knownSeats.keys()) {
      if (next.has(id)) continue;
      this.recordRoomEvent("left", { seat: id });
      this.input?.clearInput(id);
      if (roomId)
        clearHostRuntimeParticipant(this.environment.controlTarget, roomId, id);
      this.options.onPlayerLeave?.(id);
    }
    this.knownSeats = next;
    this.store.getState().setPlayers(seats);
  }

  /** Answers a phone's request on a channel this host holds; others are not its to answer. */
  private answer(room: HostRoom, request: RoomRequest): void {
    const respond = (result: unknown) =>
      room.respond(request.seat, request.id, result);
    if (request.channel === this.environment.presentationChannel) {
      const parsed = presentationRequestSchema.safeParse(request.name);
      if (!parsed.success) return respond({ ok: false });
      this.setRuntimeState(parsed.data === "pause" ? "paused" : "playing");
      return respond({ runtimeState: this.store.getState().runtimeState });
    }
    if (request.channel === AIRJAM_CONTROL_CHANNEL) {
      if (request.name !== AIRJAM_LEASED_CONTROL_REQUEST) return;
      return respond(this.applyLeasedControl(request));
    }
    const answer = this.answerers.get(request.channel);
    if (!answer) return;
    respond(
      answer({
        seat: request.seat,
        name: request.name,
        payload: request.payload,
      }),
    );
  }

  private applyLeasedControl(request: RoomRequest): ControllerLeasedControlAck {
    const roomId = this.roomId;
    const parsed = leasedControlRequestSchema.safeParse(request.payload);
    if (!parsed.success || !roomId)
      return { status: "rejected", reason: "invalid_request" };
    const control = controllerLeasedControlSchema.safeParse({
      ...parsed.data,
      roomId,
      controllerId: request.seat,
    });
    if (!control.success)
      return { status: "rejected", reason: "invalid_request" };
    try {
      return applyHostRuntimeLeasedControl(
        this.environment.controlTarget,
        control.data,
      );
    } catch (error) {
      emitAirJamDiagnostic({
        code: "AJ_PARTICIPANT_CONTROL_RUNTIME_UNAVAILABLE",
        severity: "error",
        message:
          error instanceof Error
            ? error.message
            : "Participant control runtime is unavailable.",
        details: { roomId },
      });
      return { status: "unconfirmed", reason: "runtime_unavailable" };
    }
  }

  private startFrames(): () => void {
    const clock = this.simulation;
    const frames = this.environment.frames;
    if (!clock || !frames || this.frameFault) return () => {};
    clock.rest();
    const tracked = trackHostSimulation(clock.pace);
    const stop = frames((now) => {
      if (this.frameFault) return;
      try {
        clock.frame(now);
        this.timeline?.frame(Date.now(), clock.pace);
      } catch (error) {
        this.frameFault = hostRuntimeFault(error);
        stop();
        this.emitRuntimeEvent({
          event: AIRJAM_DEV_LOG_EVENTS.runtime.hostFrameFault,
          level: "error",
          message: describeHostRuntimeFault(this.frameFault),
          roomId: this.roomId ?? undefined,
          data: { fault: this.frameFault },
        });
      }
    });
    return () => {
      stop();
      tracked.release();
    };
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
    const roomId = this.currentRoom?.code ?? null;
    if (!roomId) {
      this.joinUrlKey = null;
      state.setJoinUrl("", "loading");
      return;
    }
    if (roomId === this.joinUrlKey) return;
    this.joinUrlKey = roomId;
    state.setJoinUrl("", "loading");
    this.environment.controllerUrl(roomId).then(
      (url) => {
        if (this.joinUrlKey === roomId)
          this.store.getState().setJoinUrl(url, "ready");
      },
      () => {
        if (this.joinUrlKey === roomId)
          this.store.getState().setJoinUrl("", "unavailable");
      },
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

  /** Wall time belongs only to entries the bounded recorder actually accepted. */
  private recordRoomEvent(event: AirJamInputLogEvent, payload: object): void {
    const recorder = this.recorder;
    if (!recorder) return;
    const index = recorder.entryCount;
    recorder.record(event, payload);
    if (recorder.entryCount > index) this.timeline?.record(index, Date.now());
  }

  /** Records store actions applied between steps; a step's own actions replay with it. */
  private recordActions(): (() => void)[] {
    const recorder = this.recorder;
    if (!recorder) return [];
    return this.stores.map((store) =>
      store.subscribeHostActions(
        ({ actionName, payload, storeDomain, context }) => {
          if (this.clock?.stepping) return;
          this.recordRoomEvent("action", {
            actionName,
            payload,
            storeDomain,
            actor: { id: context.actorId, role: context.role },
          });
        },
        { includeRejected: true },
      ),
    );
  }

  /** Admission control for controllers this host leases to agents and tools. */
  private bindRoomControl(): void {
    const roomId = this.roomId;
    if (!roomId) return;
    this.releaseRoomControl?.();
    this.releaseRoomControl = null;
    const target = this.environment.controlTarget;
    const unregisterContract = this.agent
      ? registerHostAgentContract(target, {
          roomId,
          gameId: this.agent.gameId,
          contract: this.agent.contract,
          players: () => this.store.getState().players,
          settings: { read: this.settings.read, update: this.updateSettings },
        })
      : null;
    this.bindObservation(roomId);
    const unregister = registerHostRuntimeParticipantReceiver(target, roomId, {
      seats: () => {
        const room = this.currentRoom;
        return room?.instance
          ? { instance: room.instance, seats: this.store.getState().players }
          : null;
      },
      now: this.now,
      clips: this.clips,
      timeline: () =>
        this.timeline && this.simulationDeclaration
          ? {
              status: "available" as const,
              ...this.timeline.read(this.inputLog(), Date.now()),
            }
          : {
              status: "unavailable" as const,
              reason: this.declaresSimulation
                ? ("simulation-loading" as const)
                : ("no-simulation" as const),
            },
      inputLog: (cut) => this.inputLog(cut),
      inputLogFull: () => this.inputLogFull,
      input: this.input ?? undefined,
      readState: () => {
        const state = this.store.getState();
        return {
          runtimeState: state.runtimeState,
          connectionStatus: state.connectionStatus,
          fault: this.frameFault,
        };
      },
      isParticipant: (controllerId) =>
        this.store
          .getState()
          .players.some(
            (player) => player.id === controllerId && player.connected,
          ),
    });
    this.releaseRoomControl = () => {
      unregister();
      this.releaseObservation?.();
      this.releaseObservation = null;
      unregisterContract?.();
    };
  }

  /** Publishes what the simulation declares agents see, and the host's image. */
  private bindObservation(roomId: RoomCode): void {
    this.clips.dispose();
    this.releaseObservation?.();
    this.releaseObservation = null;
    const simulation = this.simulationDeclaration;
    const clock = this.simulation;
    if (!clock && !this.capture) return;
    this.releaseObservation = registerHostObservationSurface(
      this.environment.controlTarget,
      roomId,
      {
        read: (context) =>
          simulation?.observe && clock
            ? {
                state: simulation.observe(clock.sim, {
                  ...context,
                  settings: this.settings.read().values,
                }),
                tick: clock.ticks,
              }
            : { state: {}, ...(clock ? { tick: clock.ticks } : {}) },
        ...(this.capture
          ? { capture: (options) => this.capture?.(options) ?? null }
          : {}),
      },
    );
  }
}

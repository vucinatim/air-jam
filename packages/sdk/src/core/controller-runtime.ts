import type { StoreApi } from "zustand/vanilla";
import type { PlayerProfilePatch, RoomCode } from "../protocol";
import { AIRJAM_DEV_LOG_EVENTS, playerProfilePatchSchema } from "../protocol";
import {
  parseAirJamSignal,
  presentationDocumentSchema,
  roomCodeSchema,
  type HapticSignalPayload,
  type StateDocument,
} from "../room-protocol";
import type { PhoneRoomSession } from "../room-session/phone-room-session";
import type { RoomSessionStatus } from "../room-session/session-link";
import type { AirJamConnectionState } from "./connection-store";
import { ControllerInput } from "./controller-input";
import type { AirJamDevRuntimeEventDetail } from "./dev-events";
import type { AirJamControllerEnvironment } from "./environment";
import type { AirJamInput } from "./input";
import type { AirJamStoreRoom, AttachableStore } from "./replicated-store";

/** Options that decide which room a controller joins. */
export interface ControllerRuntimeIdentityOptions {
  roomId?: string;
}

export interface ControllerRuntimeDependencies {
  store: StoreApi<AirJamConnectionState>;
  environment: AirJamControllerEnvironment;
  /** The game's replicated stores; they mirror the host while the runtime runs. */
  stores: readonly AttachableStore[];
  /** The game's declared controls; this controller sends them while it runs. */
  input?: AirJamInput;
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
 * One phone's seat in an Air Jam room: it joins or resumes the seat, follows
 * the room's players and presentation, sends the player's controls and
 * profile, and asks the host to pause or resume. It owns no rendering;
 * bindings subscribe to its store.
 */
export class ControllerRuntime {
  readonly store: StoreApi<AirJamConnectionState>;
  /** The room this controller joins, or null when none was given. */
  readonly roomId: RoomCode | null;
  /** This player's controls; null when the game declares none. */
  readonly input: ControllerInput | null;
  private readonly environment: AirJamControllerEnvironment;
  private readonly stores: readonly AttachableStore[];
  private readonly declaredInput: AirJamInput | undefined;
  private readonly joinSource: ControllerJoinSource;
  private nickname = "";
  private avatarId = "";
  private currentSession: PhoneRoomSession | null = null;
  private running = false;

  constructor(
    dependencies: ControllerRuntimeDependencies,
    identity: ControllerRuntimeIdentityOptions = {},
  ) {
    const environment = dependencies.environment;
    this.store = dependencies.store;
    this.environment = environment;
    this.stores = dependencies.stores;
    this.declaredInput = dependencies.input;
    const embedded = environment.embedded;
    this.joinSource = resolveControllerJoinSource({
      embeddedRoomId: embedded?.roomId,
      optionRoomId: identity.roomId ?? null,
      urlRoomId: environment.requestedRoomId,
    });
    const code =
      embedded?.roomId ?? identity.roomId ?? environment.requestedRoomId;
    const parsed = code ? roomCodeSchema.safeParse(code.toUpperCase()) : null;
    this.roomId = parsed?.success ? parsed.data : null;
    this.input = dependencies.input
      ? new ControllerInput(dependencies.input, {
          send: (state) => this.currentSession?.sendInput(state),
          requestFrame: (callback) => environment.requestFrame(callback),
        })
      : null;
  }

  /** Whether an embedding shell holds this phone's seat. */
  get isEmbedded(): boolean {
    return this.environment.embedded !== null;
  }

  /** The seat's session while the runtime runs. */
  get session(): PhoneRoomSession | null {
    return this.currentSession;
  }

  /** Joins the seat and keeps it until the returned stop is called. */
  start(): () => void {
    if (this.running) throw new Error("Controller runtime is already running.");
    this.running = true;
    const roomId = this.roomId;
    const state = this.store.getState();
    state.setMode(this.environment.runMode);
    state.setRole("controller");
    state.setRoomId(roomId);
    state.setError(undefined);
    this.updateDevLogContext();
    if (!roomId) {
      state.setStatus("idle");
      return () => {
        this.running = false;
      };
    }
    state.setStatus("connecting");
    const binding = this.environment.readBinding(roomId);
    const key = binding?.key ?? this.environment.createKey();
    const profile = this.joinProfile();
    this.emitRuntimeEvent({
      event: AIRJAM_DEV_LOG_EVENTS.runtime.roomStatus,
      message: binding ? "Controller resuming its seat" : "Controller joining",
      roomId,
      data: { joinSource: this.joinSource, resume: Boolean(binding) },
    });
    const session = this.environment.joinRoom({
      key,
      code: roomId,
      kind: this.environment.seatKind,
      ...(binding ? { instance: binding.instance } : {}),
      ...(profile ? { profile } : {}),
      ...(this.declaredInput ? { input: this.declaredInput } : {}),
    });
    this.currentSession = session;
    const presentation = this.environment.presentationChannel;
    const applyPresentation = (document: StateDocument) => {
      const parsed = presentationDocumentSchema.safeParse(document);
      if (!parsed.success) return;
      const current = this.store.getState();
      if (current.runtimeState !== parsed.data.runtimeState)
        this.emitRuntimeEvent({
          event: AIRJAM_DEV_LOG_EVENTS.runtime.phaseTransition,
          message: "Controller runtime phase transition",
          roomId,
          data: {
            from: current.runtimeState,
            to: parsed.data.runtimeState,
          },
        });
      current.setRuntimeState(parsed.data.runtimeState);
      current.setControllerOrientation(parsed.data.orientation);
    };
    const releases = [
      session.on("status", (status) => this.followStatus(roomId, key, status)),
      session.on("seats", (seats) => this.store.getState().setPlayers(seats)),
      session.on("state", ({ channel, document }) => {
        if (channel === presentation) applyPresentation(document);
      }),
      session.on("signal", (signal) => {
        const parsed = parseAirJamSignal(signal);
        if (parsed?.kind === "haptic") this.vibrate(parsed.payload);
      }),
    ];
    const storeRoom = this.storeRoom(session);
    const detachStores = this.stores.map((store) =>
      store.attach({
        room: storeRoom,
        connection: this.store,
        defaultStoreDomain: this.environment.defaultStoreDomain,
        controlTarget: null,
        now: () => performance.now(),
      }),
    );
    return () => {
      for (const release of releases) release();
      for (const detach of detachStores) detach();
      session.close();
      this.currentSession = null;
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

  /** Gives the seat up for good. */
  readonly leave = (): void => {
    const roomId = this.roomId;
    if (!this.currentSession || !roomId) return;
    this.environment.clearBinding(roomId);
    this.currentSession.leave();
    const state = this.store.getState();
    state.setControllerId(null);
    state.setStatus("disconnected");
    state.resetRuntimeState();
  };

  /** Changes this player's name or avatar; the room tells every device. */
  readonly updatePlayerProfile = (patch: PlayerProfilePatch): boolean => {
    const parsed = playerProfilePatchSchema.safeParse(patch);
    if (!parsed.success || !this.currentSession) return false;
    if (parsed.data.label === undefined && parsed.data.avatarId === undefined)
      return false;
    this.currentSession.setProfile(parsed.data);
    return true;
  };

  /** Asks the host to pause or resume play. */
  readonly sendSystemCommand = (command: "pause" | "resume"): void => {
    void this.currentSession?.request(
      this.environment.presentationChannel,
      command,
    );
  };

  /** The view replicated stores have of this phone's room. */
  private storeRoom(session: PhoneRoomSession): AirJamStoreRoom {
    return {
      role: "controller",
      document: (channel) => session.channel(channel),
      onDocument: (channel, listener) =>
        session.on("state", (state) => {
          if (state.channel === channel) listener(state.document);
        }),
      request: (channel, name, payload) =>
        session.request(channel, name, payload),
    };
  }

  private joinProfile() {
    const embedded = this.environment.embedded?.playerProfile;
    const label = embedded?.label || this.nickname;
    const avatarId = embedded?.avatarId || this.avatarId;
    const localSeatLabel = this.environment.localSeatLabel;
    if (!label && !avatarId && !localSeatLabel) return null;
    return {
      ...(label ? { label: label.slice(0, 24) } : {}),
      ...(avatarId ? { avatarId } : {}),
      ...(localSeatLabel ? { localSeatLabel } : {}),
    };
  }

  private followStatus(
    roomId: RoomCode,
    key: string,
    status: RoomSessionStatus,
  ): void {
    const state = this.store.getState();
    const session = this.currentSession;
    this.emitRuntimeEvent({
      event: AIRJAM_DEV_LOG_EVENTS.runtime.roomStatus,
      message: `Controller room ${status.phase}`,
      roomId,
      data: { ...status },
    });
    switch (status.phase) {
      case "connecting":
      case "waiting":
        state.setStatus("connecting");
        return;
      case "reconnecting":
        state.setStatus("reconnecting");
        return;
      case "open": {
        const instance = session?.instance;
        const seat = session?.seat ?? null;
        if (instance) this.environment.writeBinding(roomId, { key, instance });
        state.setControllerId(seat);
        state.setError(undefined);
        state.setStatus("connected");
        this.updateDevLogContext();
        return;
      }
      case "closed":
        if (status.reason !== "owner" && status.reason !== "restarting")
          this.environment.clearBinding(roomId);
        state.setStatus("disconnected");
        state.resetRuntimeState();
        if (status.reason !== "owner" && status.reason !== "left")
          state.setError(`The room closed the connection: ${status.reason}.`);
        return;
    }
  }

  private vibrate(payload: HapticSignalPayload): void {
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
      controllerId: this.store.getState().controllerId ?? undefined,
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
      controllerId: this.store.getState().controllerId ?? undefined,
    });
  }
}

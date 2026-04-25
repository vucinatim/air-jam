import type { HostSocketAuthority, RoomCode } from "@air-jam/sdk/protocol";
import type { RoomAnalyticsState, RoomSession } from "../types.js";

export type HostVerificationMode = NonNullable<
  HostSocketAuthority["verifiedVia"]
>;

export type RuntimeUsageEventKind =
  | "host_bootstrap_verified"
  | "room_created"
  | "room_registered"
  | "game_launch_started"
  | "game_became_active"
  | "game_returned_to_system"
  | "controller_joined"
  | "controller_disconnected"
  | "controller_left"
  | "room_closed";

export interface RuntimeUsageEvent {
  id: string;
  kind: RuntimeUsageEventKind;
  occurredAt: number;
  runtimeSessionId?: string;
  runtimeSessionStartedAt?: number;
  roomId?: RoomCode;
  appId?: string;
  gameId?: string;
  hostVerifiedVia?: HostVerificationMode;
  hostVerifiedOrigin?: string;
  payload?: Record<string, unknown>;
}

export interface RuntimeUsagePublisher {
  publish: (event: RuntimeUsageEvent) => void;
}

export const createNoopRuntimeUsagePublisher = (): RuntimeUsagePublisher => ({
  publish: () => {
    // Phase 0 seam: storage and projection attach later.
  },
});

export const createRoomAnalyticsState = (
  authority?: HostSocketAuthority,
  now = Date.now(),
): RoomAnalyticsState => ({
  runtimeSessionId: crypto.randomUUID(),
  startedAt: now,
  appId: authority?.appId,
  gameId: authority?.gameId,
  hostVerifiedVia: authority?.verifiedVia,
  hostVerifiedOrigin: authority?.verifiedOrigin,
  hostSessionKind: authority?.hostSessionKind ?? "system",
});

export const syncRoomAnalyticsState = (
  analytics: RoomAnalyticsState,
  authority?: HostSocketAuthority,
): void => {
  if (!authority) {
    return;
  }

  if (analytics.appId === undefined && authority.appId) {
    analytics.appId = authority.appId;
  }
  if (analytics.gameId === undefined && authority.gameId) {
    analytics.gameId = authority.gameId;
  }
  if (analytics.hostVerifiedVia === undefined && authority.verifiedVia) {
    analytics.hostVerifiedVia = authority.verifiedVia;
  }
  if (
    analytics.hostVerifiedOrigin === undefined &&
    authority.verifiedOrigin !== undefined
  ) {
    analytics.hostVerifiedOrigin = authority.verifiedOrigin;
  }
  analytics.hostSessionKind = authority.hostSessionKind;
};

export const createRuntimeUsageEvent = (
  event: Omit<RuntimeUsageEvent, "id" | "occurredAt"> & {
    occurredAt?: number;
  },
): RuntimeUsageEvent => ({
  id: crypto.randomUUID(),
  occurredAt: event.occurredAt ?? Date.now(),
  ...event,
});

export const createRoomRuntimeUsageEvent = (
  session: RoomSession,
  event: Omit<
    RuntimeUsageEvent,
    | "id"
    | "occurredAt"
    | "runtimeSessionId"
    | "roomId"
    | "appId"
    | "gameId"
    | "hostVerifiedVia"
  > & {
    occurredAt?: number;
    gameId?: string;
  },
): RuntimeUsageEvent =>
  createRuntimeUsageEvent({
    ...event,
    runtimeSessionId: session.analytics.runtimeSessionId,
    runtimeSessionStartedAt: session.analytics.startedAt,
    roomId: session.roomId,
    appId: session.analytics.appId,
    gameId: event.gameId ?? session.activeGameId ?? session.analytics.gameId,
    hostVerifiedVia: session.analytics.hostVerifiedVia,
    hostVerifiedOrigin: session.analytics.hostVerifiedOrigin,
  });

export type RealtimeAdmissionDenialReason =
  | "authority_unavailable"
  | "instance_draining"
  | "lane_paused"
  | "budget_protection"
  | "global_capacity_exceeded"
  | "creator_quota_exceeded"
  | "game_quota_exceeded"
  | "room_full"
  | "room_conflict"
  | "controller_conflict"
  | "operation_in_progress"
  | "operation_cancelled";

export type RealtimeAdmissionDenial = {
  ok: false;
  reason: RealtimeAdmissionDenialReason;
  message: string;
  retryAfterSeconds: number | null;
};

export type RealtimeRoomLease = {
  roomId: string;
  leaseToken: string;
};

export type RealtimeControllerLease = {
  roomId: string;
  controllerId: string;
  leaseToken: string;
};

export type RealtimeAdmissionDecision<TLease> =
  | { ok: true; lease: TLease }
  | RealtimeAdmissionDenial;

export type RealtimeAdmissionStatus = {
  contractVersion: 1;
  authority: "database" | "local" | "unavailable";
  budgetRequirement: "required" | "not_applicable";
  instanceId: string;
  acceptingNewWork: boolean;
  draining: boolean;
  terminalAuthorityLost: boolean;
  pendingReconciliations: number;
  lastHeartbeatAt: string | null;
  lastError: string | null;
};

export interface RealtimeAdmissionService {
  start: () => Promise<void>;
  beginDrain: () => Promise<void>;
  stop: () => Promise<void>;
  admitRoom: (input: {
    roomId: string;
    appId?: string;
    gameId?: string;
    creatorId?: string;
    maxControllers: number;
    replacingLease?: RealtimeRoomLease;
  }) => Promise<RealtimeAdmissionDecision<RealtimeRoomLease>>;
  releaseRoom: (lease: RealtimeRoomLease) => Promise<void>;
  admitController: (input: {
    roomLease: RealtimeRoomLease;
    controllerId: string;
    existingLease?: RealtimeControllerLease;
    replacingLease?: RealtimeControllerLease;
  }) => Promise<RealtimeAdmissionDecision<RealtimeControllerLease>>;
  markControllerDisconnected: (
    lease: RealtimeControllerLease,
    resumeLeaseMs: number | null,
  ) => Promise<void>;
  releaseController: (lease: RealtimeControllerLease) => Promise<void>;
  getStatus: () => RealtimeAdmissionStatus;
  onTerminalAuthorityLoss: (
    listener: (failure: RealtimeAdmissionTerminalFailure) => void,
  ) => () => void;
}

export type RealtimeAdmissionTerminalFailure = {
  code: "instance_lease_lost";
  message: string;
};

const denial = (
  reason: RealtimeAdmissionDenialReason,
  message: string,
  retryAfterSeconds: number | null = 15,
): RealtimeAdmissionDenial => ({
  ok: false,
  reason,
  message,
  retryAfterSeconds,
});

const createLeaseToken = (): string => crypto.randomUUID();

export const createLocalRealtimeAdmissionService = ({
  instanceId = `local-${crypto.randomUUID()}`,
}: {
  instanceId?: string;
} = {}): RealtimeAdmissionService => {
  type LocalRoomAdmission = {
    lease: RealtimeRoomLease;
    maxControllers: number;
    controllers: Map<string, RealtimeControllerLease>;
  };

  let draining = false;
  const rooms = new Map<string, LocalRoomAdmission>();

  const readRoom = (lease: RealtimeRoomLease): LocalRoomAdmission | null => {
    const room = rooms.get(lease.roomId);
    return room?.lease.leaseToken === lease.leaseToken ? room : null;
  };

  const readController = (
    lease: RealtimeControllerLease,
  ): RealtimeControllerLease | null => {
    const controller = rooms
      .get(lease.roomId)
      ?.controllers.get(lease.controllerId);
    return controller?.leaseToken === lease.leaseToken ? controller : null;
  };

  const deleteController = (lease: RealtimeControllerLease): void => {
    if (!readController(lease)) return;
    rooms.get(lease.roomId)?.controllers.delete(lease.controllerId);
  };

  return {
    start: async () => undefined,
    beginDrain: async () => {
      draining = true;
    },
    stop: async () => {
      draining = true;
      rooms.clear();
    },
    admitRoom: async ({ roomId, maxControllers, replacingLease }) => {
      if (draining) {
        return denial(
          "instance_draining",
          "This server is draining. Please try again.",
        );
      }
      if (rooms.has(roomId)) {
        return denial(
          "room_conflict",
          "That room code is already in use. Please try again.",
          1,
        );
      }
      if (replacingLease && !readRoom(replacingLease)) {
        return denial(
          "authority_unavailable",
          "The previous room reservation could not be replaced safely.",
        );
      }

      const lease = { roomId, leaseToken: createLeaseToken() };
      if (replacingLease) rooms.delete(replacingLease.roomId);
      rooms.set(roomId, {
        lease,
        maxControllers,
        controllers: new Map(),
      });
      return { ok: true, lease };
    },
    releaseRoom: async (lease) => {
      if (readRoom(lease)) rooms.delete(lease.roomId);
    },
    admitController: async ({
      roomLease,
      controllerId,
      existingLease,
      replacingLease,
    }) => {
      if (draining && !existingLease) {
        return denial(
          "instance_draining",
          "This server is draining. Please try again.",
        );
      }

      const room = readRoom(roomLease);
      if (!room) {
        return denial(
          "authority_unavailable",
          "Room capacity authority expired. Please retry from the host.",
        );
      }

      const current = room.controllers.get(controllerId);
      if (
        current &&
        (!existingLease || current.leaseToken !== existingLease.leaseToken)
      ) {
        return denial(
          "controller_conflict",
          "Controller slot is unavailable.",
          null,
        );
      }
      if (existingLease && !readController(existingLease)) {
        return denial(
          "controller_conflict",
          "Controller slot is unavailable.",
          null,
        );
      }
      if (replacingLease && !readController(replacingLease)) {
        return denial(
          "authority_unavailable",
          "The previous controller reservation could not be replaced safely.",
        );
      }

      const lease = {
        roomId: roomLease.roomId,
        controllerId,
        leaseToken: createLeaseToken(),
      };
      if (current && existingLease) {
        room.controllers.set(controllerId, lease);
        if (
          replacingLease &&
          replacingLease.leaseToken !== existingLease.leaseToken
        ) {
          deleteController(replacingLease);
        }
        return { ok: true, lease };
      }

      const replacementUsesTargetRoom =
        replacingLease?.roomId === roomLease.roomId;
      const effectiveControllerCount =
        room.controllers.size - (replacementUsesTargetRoom ? 1 : 0);
      if (effectiveControllerCount >= room.maxControllers) {
        return denial("room_full", "Room full", null);
      }

      if (replacingLease) deleteController(replacingLease);
      room.controllers.set(controllerId, lease);
      return { ok: true, lease };
    },
    markControllerDisconnected: async () => undefined,
    releaseController: async (lease) => {
      deleteController(lease);
    },
    getStatus: () => ({
      contractVersion: 1,
      authority: "local",
      budgetRequirement: "not_applicable",
      instanceId,
      acceptingNewWork: !draining,
      draining,
      terminalAuthorityLost: false,
      pendingReconciliations: 0,
      lastHeartbeatAt: null,
      lastError: null,
    }),
    onTerminalAuthorityLoss: () => () => undefined,
  };
};

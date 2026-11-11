import { DEFAULT_ROOM_PLATFORM_SETTINGS } from "@air-jam/sdk";
import { describe, expect, it, vi } from "vitest";
import { registerRealtimeHandlers } from "../src/gateway/handlers/register-realtime-handlers";
import type { SocketHandlerContext } from "../src/gateway/socket-handler-context";
import { createServerLogger } from "../src/logging/logger";
import { RoomManager } from "../src/services/room-manager";
import type { RoomSession } from "../src/types";

const setup = () => {
  const roomManager = new RoomManager();
  const session: RoomSession = {
    roomId: "ABCD",
    masterHostSocketId: "host",
    hostResumeCapability: { token: "host-resume-token" },
    analytics: {
      runtimeSessionId: "runtime-session",
      startedAt: 0,
      hostSessionKind: "system",
    },
    focus: "SYSTEM",
    controllers: new Map(),
    replicatedStoreSnapshots: new Map(),
    maxPlayers: 8,
    runtimeState: "paused",
    stateVersion: 0,
    controllerOrientation: "portrait",
    roomSettings: DEFAULT_ROOM_PLATFORM_SETTINGS,
    lifecycleState: "SYSTEM_IDLE",
    admissionLease: { roomId: "ABCD", leaseToken: "lease" },
  };
  roomManager.setRoom(session.roomId, session);
  const deliver = vi.fn();
  const handlers = new Map<string, (payload: unknown) => void>();
  const socket = {
    id: "host",
    on: (event: string, handler: (payload: unknown) => void) =>
      handlers.set(event, handler),
  };
  registerRealtimeHandlers({
    socket,
    roomManager,
    io: {
      to: (target: string) => ({
        emit: (event: string, payload: unknown) =>
          deliver(target, event, payload),
      }),
    },
    logger: createServerLogger(undefined, undefined, undefined, {
      level: "silent",
    }),
    isHostAuthorizedForRoom: (roomId: string) =>
      roomId === session.roomId && socket.id === session.masterHostSocketId,
    isControllerAuthorizedForRoom: () => true,
  } as unknown as SocketHandlerContext);
  return {
    session,
    socket,
    deliver,
    send: (event: string, payload: unknown) => handlers.get(event)?.(payload),
  };
};

describe("private replicated state delivery", () => {
  it("keeps full restore data in the host-only cache and sends only public data to the room", () => {
    const { session, send, deliver } = setup();
    const entries = { a: ["moonfruit"], b: ["stardust"] };
    send("host:state_sync", {
      roomId: "ABCD",
      storeDomain: "game",
      revision: 1,
      data: { round: 1, secrets: entries },
      privateState: { field: "secrets", entries },
    });
    expect(session.replicatedStoreSnapshots.get("game")?.data).toEqual({
      round: 1,
      secrets: entries,
    });
    expect(deliver).toHaveBeenCalledExactlyOnceWith(
      "ABCD",
      "airjam:state_sync",
      { roomId: "ABCD", storeDomain: "game", revision: 1, data: { round: 1 } },
    );
  });

  it("routes an entry only to its controller in the authorized host's room, with no broadcast fallback", () => {
    const { session, socket, send, deliver } = setup();
    session.controllers.set("a", {
      controllerId: "a",
      socketId: "phone-a",
    } as RoomSession["controllers"] extends Map<string, infer Entry>
      ? Entry
      : never);
    const payload = {
      roomId: "ABCD",
      storeDomain: "game",
      controllerId: "a",
      revision: 2,
      entry: ["moonfruit"],
    };
    send("host:private_state_sync", payload);
    expect(deliver).toHaveBeenCalledExactlyOnceWith(
      "phone-a",
      "airjam:private_state_sync",
      payload,
    );
    deliver.mockClear();
    send(
      "host:private_state_sync",
      JSON.parse(JSON.stringify({ ...payload, revision: 3, entry: undefined })),
    );
    expect(deliver).toHaveBeenCalledExactlyOnceWith(
      "phone-a",
      "airjam:private_state_sync",
      { roomId: "ABCD", storeDomain: "game", controllerId: "a", revision: 3 },
    );
    deliver.mockClear();
    send("host:private_state_sync", { ...payload, controllerId: "missing" });
    send("host:private_state_sync", { ...payload, roomId: "WXYZ" });
    socket.id = "intruder";
    send("host:private_state_sync", payload);
    expect(deliver).not.toHaveBeenCalled();
  });
});

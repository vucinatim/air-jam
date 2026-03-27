import { describe, expect, it } from "vitest";
import { ErrorCode } from "@air-jam/sdk/protocol";
import type { AuthService } from "../src/services/auth-service";
import { setupServerTestHarness } from "./helpers/server-test-harness";

type HostCreateRoomAck = {
  ok: boolean;
  roomId?: string;
  message?: string;
  code?: ErrorCode | string;
  players?: Array<{
    id: string;
    label: string;
    color?: string;
    avatarId?: string;
  }>;
};

type ControllerJoinAck = {
  ok: boolean;
  controllerId?: string;
  roomId?: string;
  message?: string;
  code?: ErrorCode | string;
};

const allowAllAuthService = {
  verifyHostBootstrap: async ({ appId }: { appId?: string }) => ({
    isVerified: true,
    appId,
    verifiedVia: "appId" as const,
  }),
} as AuthService;

describe("server room lifecycle", () => {
  const harness = setupServerTestHarness({
    server: { authService: allowAllAuthService },
  });

  it("allows host reconnect after disconnect", async () => {
    const host = await harness.connectSocket();
    expect((await harness.bootstrapHost(host)).ok).toBe(true);
    const createAck = await harness.emitWithAck<HostCreateRoomAck>(
      host,
      "host:createRoom",
      { maxPlayers: 4 },
    );

    expect(createAck.ok).toBe(true);
    expect(createAck.roomId).toBeTypeOf("string");

    const roomId = createAck.roomId!;
    host.disconnect();
    await harness.delay(30);

    const reconnectedHost = await harness.connectSocket();
    expect((await harness.bootstrapHost(reconnectedHost)).ok).toBe(true);
    const reconnectAck = await harness.emitWithAck<HostCreateRoomAck>(
      reconnectedHost,
      "host:reconnect",
      { roomId },
    );

    expect(reconnectAck.ok).toBe(true);
    expect(reconnectAck.roomId).toBe(roomId);
  });

  it("returns the current controller roster in the host reconnect ack", async () => {
    const host = await harness.connectSocket();
    expect((await harness.bootstrapHost(host)).ok).toBe(true);
    const createAck = await harness.emitWithAck<HostCreateRoomAck>(
      host,
      "host:createRoom",
      { maxPlayers: 4 },
    );

    expect(createAck.ok).toBe(true);
    const roomId = createAck.roomId!;

    const controller = await harness.connectSocket();
    const joinAck = await harness.emitWithAck<ControllerJoinAck>(
      controller,
      "controller:join",
      { roomId, controllerId: "ctrl_existing_1", nickname: "Existing" },
    );
    expect(joinAck.ok).toBe(true);

    host.disconnect();
    await harness.delay(30);

    const reconnectedHost = await harness.connectSocket();
    expect((await harness.bootstrapHost(reconnectedHost)).ok).toBe(true);
    const reconnectAck = await harness.emitWithAck<HostCreateRoomAck>(
      reconnectedHost,
      "host:reconnect",
      { roomId },
    );

    expect(reconnectAck.ok).toBe(true);
    expect(reconnectAck.players).toEqual([
      expect.objectContaining({
        id: "ctrl_existing_1",
        label: "Existing",
      }),
    ]);
  });

  it("routes controller join/leave/rejoin notices to the host", async () => {
    const host = await harness.connectSocket();
    expect((await harness.bootstrapHost(host)).ok).toBe(true);
    const createAck = await harness.emitWithAck<HostCreateRoomAck>(
      host,
      "host:createRoom",
      { maxPlayers: 4 },
    );

    expect(createAck.ok).toBe(true);
    const roomId = createAck.roomId!;

    const controllerA = await harness.connectSocket();
    const joinedNoticePromise = harness.waitForEvent<{ controllerId: string }>(
      host,
      "server:controllerJoined",
    );
    const joinAck = await harness.emitWithAck<ControllerJoinAck>(
      controllerA,
      "controller:join",
      { roomId, controllerId: "ctrl_rejoin_1", nickname: "First" },
    );

    expect(joinAck.ok).toBe(true);
    const joinedNotice = await joinedNoticePromise;
    expect(joinedNotice.controllerId).toBe("ctrl_rejoin_1");

    const leftNoticePromise = harness.waitForEvent<{ controllerId: string }>(
      host,
      "server:controllerLeft",
    );
    controllerA.emit("controller:leave", {
      roomId,
      controllerId: "ctrl_rejoin_1",
    });
    const leftNotice = await leftNoticePromise;
    expect(leftNotice.controllerId).toBe("ctrl_rejoin_1");

    const controllerB = await harness.connectSocket();
    const rejoinedNoticePromise = harness.waitForEvent<{ controllerId: string }>(
      host,
      "server:controllerJoined",
    );
    const rejoinAck = await harness.emitWithAck<ControllerJoinAck>(
      controllerB,
      "controller:join",
      { roomId, controllerId: "ctrl_rejoin_1", nickname: "Second" },
    );

    expect(rejoinAck.ok).toBe(true);
    const rejoinedNotice = await rejoinedNoticePromise;
    expect(rejoinedNotice.controllerId).toBe("ctrl_rejoin_1");
  });

  it("replaces the previous controller identity when the same socket rejoins with a new controller id", async () => {
    const host = await harness.connectSocket();
    expect((await harness.bootstrapHost(host)).ok).toBe(true);
    const createAck = await harness.emitWithAck<HostCreateRoomAck>(
      host,
      "host:createRoom",
      { maxPlayers: 4 },
    );

    expect(createAck.ok).toBe(true);
    const roomId = createAck.roomId!;

    const controller = await harness.connectSocket();
    const firstJoinAck = await harness.emitWithAck<ControllerJoinAck>(
      controller,
      "controller:join",
      { roomId, controllerId: "ctrl_old_1", nickname: "Old" },
    );
    expect(firstJoinAck.ok).toBe(true);

    const leftNoticePromise = harness.waitForEvent<{ controllerId: string }>(
      host,
      "server:controllerLeft",
      2_000,
    );
    const secondJoinAck = await harness.emitWithAck<ControllerJoinAck>(
      controller,
      "controller:join",
      { roomId, controllerId: "ctrl_new_1", nickname: "New" },
    );

    expect(secondJoinAck.ok).toBe(true);
    expect((await leftNoticePromise).controllerId).toBe("ctrl_old_1");

    const session = harness.getRoomManager().getRoom(roomId)!;
    expect(Array.from(session.controllers.keys())).toEqual(["ctrl_new_1"]);

    controller.disconnect();
    await harness.delay(30);
    expect(Array.from(session.controllers.keys())).toEqual([]);
  });

  it("cleans up room state after host disconnect timeout", async () => {
    const host = await harness.connectSocket();
    expect((await harness.bootstrapHost(host)).ok).toBe(true);

    const createAck = await harness.emitWithAck<HostCreateRoomAck>(
      host,
      "host:createRoom",
      { maxPlayers: 4 },
    );

    expect(createAck.ok).toBe(true);
    expect(harness.getRoomManager().getAllRooms().size).toBe(1);

    host.disconnect();
    await harness.delay(3_250);

    expect(harness.getRoomManager().getAllRooms().size).toBe(0);
  });
});

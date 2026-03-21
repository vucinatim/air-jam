import { describe, expect, it } from "vitest";
import { ErrorCode } from "@air-jam/sdk/protocol";
import type { AuthService } from "../src/services/auth-service";
import { setupServerTestHarness } from "./helpers/server-test-harness";

type HostCreateRoomAck = {
  ok: boolean;
  roomId?: string;
  message?: string;
  code?: ErrorCode | string;
};

type ControllerJoinAck = {
  ok: boolean;
  controllerId?: string;
  roomId?: string;
  message?: string;
  code?: ErrorCode | string;
};

const allowAllAuthService = {
  verifyApiKey: async () => ({ isVerified: true }),
} as AuthService;

describe("server room lifecycle", () => {
  const harness = setupServerTestHarness({
    server: { authService: allowAllAuthService },
  });

  it("allows host reconnect after disconnect", async () => {
    const host = await harness.connectSocket();
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
    const reconnectAck = await harness.emitWithAck<HostCreateRoomAck>(
      reconnectedHost,
      "host:reconnect",
      { roomId },
    );

    expect(reconnectAck.ok).toBe(true);
    expect(reconnectAck.roomId).toBe(roomId);
  });

  it("routes controller join/leave/rejoin notices to the host", async () => {
    const host = await harness.connectSocket();
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

  it("cleans up room state after host disconnect timeout", async () => {
    const host = await harness.connectSocket();

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

import { describe, expect, it } from "vitest";
import type { AuthService } from "../src/services/auth-service";
import { setupServerTestHarness } from "./helpers/server-test-harness";

type HostCreateRoomAck = {
  ok: boolean;
  roomId?: string;
};

const allowAllAuthService = {
  verifyApiKey: async () => ({ isVerified: true }),
} as AuthService;

describe("server state sync", () => {
  const harness = setupServerTestHarness({
    server: { authService: allowAllAuthService },
  });

  it("broadcasts host state sync to all controllers in the room", async () => {
    const host = await harness.connectSocket();
    const controllerA = await harness.connectSocket();
    const controllerB = await harness.connectSocket();

    const createAck = await harness.emitWithAck<HostCreateRoomAck>(
      host,
      "host:createRoom",
      { maxPlayers: 4 },
    );

    expect(createAck.ok).toBe(true);
    const roomId = createAck.roomId!;

    const joinAckA = await harness.emitWithAck<{ ok: boolean }>(
      controllerA,
      "controller:join",
      { roomId, controllerId: "ctrl_sync_a", nickname: "A" },
    );
    const joinAckB = await harness.emitWithAck<{ ok: boolean }>(
      controllerB,
      "controller:join",
      { roomId, controllerId: "ctrl_sync_b", nickname: "B" },
    );

    expect(joinAckA.ok).toBe(true);
    expect(joinAckB.ok).toBe(true);

    host.emit("host:state_sync", {
      roomId,
      data: { phase: "playing", score: 5 },
    });

    const payloadA = await harness.waitForEvent<{
      roomId: string;
      data: Record<string, unknown>;
    }>(controllerA, "airjam:state_sync");
    const payloadB = await harness.waitForEvent<{
      roomId: string;
      data: Record<string, unknown>;
    }>(controllerB, "airjam:state_sync");

    expect(payloadA.roomId).toBe(roomId);
    expect(payloadB.roomId).toBe(roomId);
    expect(payloadA.data).toEqual({ phase: "playing", score: 5 });
    expect(payloadB.data).toEqual({ phase: "playing", score: 5 });
  });

  it("ignores forged host state sync from non-host sockets", async () => {
    const host = await harness.connectSocket();
    const controller = await harness.connectSocket();
    const attacker = await harness.connectSocket();

    const createAck = await harness.emitWithAck<HostCreateRoomAck>(
      host,
      "host:createRoom",
      { maxPlayers: 4 },
    );
    expect(createAck.ok).toBe(true);

    const roomId = createAck.roomId!;

    const joinAck = await harness.emitWithAck<{ ok: boolean }>(
      controller,
      "controller:join",
      { roomId, controllerId: "ctrl_sync_guard", nickname: "Guard" },
    );
    expect(joinAck.ok).toBe(true);

    attacker.emit("host:state_sync", {
      roomId,
      data: { hacked: true },
    });

    await harness.expectNoEvent(controller, "airjam:state_sync");
  });

  it("updates player profile and notifies host + controller", async () => {
    const host = await harness.connectSocket();
    const controller = await harness.connectSocket();

    const createAck = await harness.emitWithAck<HostCreateRoomAck>(
      host,
      "host:createRoom",
      { maxPlayers: 4 },
    );
    expect(createAck.ok).toBe(true);
    const roomId = createAck.roomId!;

    const joinAck = await harness.emitWithAck<{ ok: boolean }>(
      controller,
      "controller:join",
      {
        roomId,
        controllerId: "ctrl_profile_1",
        nickname: "Old",
        avatarId: "aj-1",
      },
    );
    expect(joinAck.ok).toBe(true);

    const hostNoticePromise = harness.waitForEvent<{
      player: { id: string; label: string; avatarId?: string };
    }>(host, "server:playerUpdated");
    const selfNoticePromise = harness.waitForEvent<{
      player: { id: string; label: string; avatarId?: string };
    }>(controller, "server:playerUpdated");

    const updateAck = await harness.emitWithAck<{
      ok: boolean;
      player?: { id: string; label: string; avatarId?: string };
    }>(controller, "controller:updatePlayerProfile", {
      roomId,
      controllerId: "ctrl_profile_1",
      patch: { label: "NewName", avatarId: "aj-2" },
    });

    expect(updateAck.ok).toBe(true);
    expect(updateAck.player?.label).toBe("NewName");
    expect(updateAck.player?.avatarId).toBe("aj-2");

    const hostNotice = await hostNoticePromise;
    const selfNotice = await selfNoticePromise;
    expect(hostNotice.player.label).toBe("NewName");
    expect(selfNotice.player.id).toBe("ctrl_profile_1");
  });
});

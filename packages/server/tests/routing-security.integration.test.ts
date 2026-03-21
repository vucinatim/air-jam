import { describe, expect, it } from "vitest";
import type { AuthService } from "../src/services/auth-service";
import { setupServerTestHarness } from "./helpers/server-test-harness";

type HostCreateRoomAck = {
  ok: boolean;
  roomId?: string;
};

type ControllerJoinAck = {
  ok: boolean;
};

type LaunchGameAck = {
  ok: boolean;
  joinToken?: string;
};

const allowAllAuthService = {
  verifyApiKey: async () => ({ isVerified: true }),
} as AuthService;

describe("server routing and security", () => {
  const harness = setupServerTestHarness({
    server: { authService: allowAllAuthService },
  });

  it("routes controller input to active host based on focus", async () => {
    const masterHost = await harness.connectSocket();
    const controller = await harness.connectSocket();

    const createAck = await harness.emitWithAck<HostCreateRoomAck>(
      masterHost,
      "host:createRoom",
      { maxPlayers: 4 },
    );
    expect(createAck.ok).toBe(true);

    const roomId = createAck.roomId!;

    const joinAck = await harness.emitWithAck<ControllerJoinAck>(
      controller,
      "controller:join",
      { roomId, controllerId: "ctrl_focus_1", nickname: "Focus" },
    );
    expect(joinAck.ok).toBe(true);

    controller.emit("controller:input", {
      roomId,
      controllerId: "ctrl_focus_1",
      input: { vector: { x: 1, y: 0 }, action: true },
    });

    const systemRouted = await harness.waitForEvent<{ controllerId: string }>(
      masterHost,
      "server:input",
    );
    expect(systemRouted.controllerId).toBe("ctrl_focus_1");

    const launchAck = await harness.emitWithAck<LaunchGameAck>(
      masterHost,
      "system:launchGame",
      {
        roomId,
        gameId: "pong",
        gameUrl: "https://example.com/pong",
      },
    );

    expect(launchAck.ok).toBe(true);
    expect(launchAck.joinToken).toBeTypeOf("string");

    const childHost = await harness.connectSocket();
    const childJoinAck = await harness.emitWithAck<{ ok: boolean }>(
      childHost,
      "host:joinAsChild",
      {
        roomId,
        joinToken: launchAck.joinToken,
      },
    );
    expect(childJoinAck.ok).toBe(true);

    controller.emit("controller:input", {
      roomId,
      controllerId: "ctrl_focus_1",
      input: { vector: { x: 0, y: -1 }, action: true },
    });

    const gameRouted = await harness.waitForEvent<{ controllerId: string }>(
      childHost,
      "server:input",
    );
    expect(gameRouted.controllerId).toBe("ctrl_focus_1");

    await harness.expectNoEvent(masterHost, "server:input");
  });

  it("blocks spoofed action RPC calls from sockets that do not own controllerId", async () => {
    const host = await harness.connectSocket();
    const legitController = await harness.connectSocket();
    const attacker = await harness.connectSocket();

    const createAck = await harness.emitWithAck<HostCreateRoomAck>(
      host,
      "host:createRoom",
      { maxPlayers: 4 },
    );
    expect(createAck.ok).toBe(true);

    const roomId = createAck.roomId!;
    const joinAck = await harness.emitWithAck<ControllerJoinAck>(
      legitController,
      "controller:join",
      { roomId, controllerId: "ctrl_legit_1", nickname: "Legit" },
    );
    expect(joinAck.ok).toBe(true);

    attacker.emit("controller:action_rpc", {
      roomId,
      controllerId: "ctrl_legit_1",
      actionName: "joinTeam",
      args: ["team1"],
    });

    await harness.expectNoEvent(host, "airjam:action_rpc");

    legitController.emit("controller:action_rpc", {
      roomId,
      controllerId: "ctrl_legit_1",
      actionName: "joinTeam",
      args: ["team1"],
    });

    const forwarded = await harness.waitForEvent<{
      actionName: string;
      args: unknown[];
      controllerId: string;
    }>(host, "airjam:action_rpc");

    expect(forwarded.actionName).toBe("joinTeam");
    expect(forwarded.controllerId).toBe("ctrl_legit_1");
    expect(forwarded.args).toEqual(["team1"]);
  });

  it("never forwards internal action names over action RPC", async () => {
    const host = await harness.connectSocket();
    const controller = await harness.connectSocket();

    const createAck = await harness.emitWithAck<HostCreateRoomAck>(
      host,
      "host:createRoom",
      { maxPlayers: 4 },
    );

    expect(createAck.ok).toBe(true);
    const roomId = createAck.roomId!;

    const joinAck = await harness.emitWithAck<ControllerJoinAck>(
      controller,
      "controller:join",
      { roomId, controllerId: "ctrl_internal_1", nickname: "Internal" },
    );
    expect(joinAck.ok).toBe(true);

    controller.emit("controller:action_rpc", {
      roomId,
      controllerId: "ctrl_internal_1",
      actionName: "_syncState",
      args: [{ any: "payload" }],
    });

    await harness.expectNoEvent(host, "airjam:action_rpc");
  });

  it("blocks unauthorized host:play_sound events", async () => {
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
    const joinAck = await harness.emitWithAck<ControllerJoinAck>(
      controller,
      "controller:join",
      { roomId, controllerId: "ctrl_sound_1", nickname: "Sound" },
    );
    expect(joinAck.ok).toBe(true);

    attacker.emit("host:play_sound", {
      roomId,
      targetControllerId: "ctrl_sound_1",
      soundId: "hack_sound",
      volume: 0.5,
      loop: false,
    });

    await harness.expectNoEvent(controller, "server:playSound");

    host.emit("host:play_sound", {
      roomId,
      targetControllerId: "ctrl_sound_1",
      soundId: "valid_sound",
      volume: 0.5,
      loop: false,
    });

    const received = await harness.waitForEvent<{ id: string }>(
      controller,
      "server:playSound",
    );

    expect(received.id).toBe("valid_sound");
  });
});

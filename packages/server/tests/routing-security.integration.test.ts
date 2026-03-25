import { ErrorCode } from "@air-jam/sdk/protocol";
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
  code?: ErrorCode | string;
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
      actionName: "joinTeam",
      payload: { team: "team1" },
      storeDomain: "default",
    });

    await harness.expectNoEvent(host, "airjam:action_rpc");

    legitController.emit("controller:action_rpc", {
      roomId,
      actionName: "joinTeam",
      payload: { team: "team1" },
      storeDomain: "default",
    });

    const forwarded = await harness.waitForEvent<{
      actionName: string;
      payload: unknown;
      storeDomain: string;
      actor: { id: string; role: "controller" | "host" };
    }>(host, "airjam:action_rpc");

    expect(forwarded.actionName).toBe("joinTeam");
    expect(forwarded.storeDomain).toBe("default");
    expect(forwarded.actor).toEqual({
      id: "ctrl_legit_1",
      role: "controller",
    });
    expect(forwarded.payload).toEqual({ team: "team1" });
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
      actionName: "_syncState",
      payload: { any: "payload" },
      storeDomain: "default",
    });

    await harness.expectNoEvent(host, "airjam:action_rpc");
  });

  it("routes namespaced arcade actions to master host during game focus", async () => {
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
      { roomId, controllerId: "ctrl_arcade_1", nickname: "ArcadeCtrl" },
    );
    expect(joinAck.ok).toBe(true);

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

    controller.emit("controller:action_rpc", {
      roomId,
      actionName: "airjam.arcade.toggle_qr",
      payload: null,
      storeDomain: "arcade.surface",
    });

    const forwarded = await harness.waitForEvent<{
      actionName: string;
      payload: unknown;
      storeDomain: string;
      actor: { id: string; role: "controller" | "host" };
    }>(masterHost, "airjam:action_rpc");

    expect(forwarded.actionName).toBe("airjam.arcade.toggle_qr");
    expect(forwarded.storeDomain).toBe("arcade.surface");
    expect(forwarded.actor).toEqual({
      id: "ctrl_arcade_1",
      role: "controller",
    });
    expect(forwarded.payload).toBeNull();

    await harness.expectNoEvent(childHost, "airjam:action_rpc");
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

  it("blocks unauthorized launch and close transitions", async () => {
    const masterHost = await harness.connectSocket();
    const attacker = await harness.connectSocket();
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
      { roomId, controllerId: "ctrl_transition_1", nickname: "Transit" },
    );
    expect(joinAck.ok).toBe(true);

    const forgedLaunchAck = await harness.emitWithAck<LaunchGameAck>(
      attacker,
      "system:launchGame",
      {
        roomId,
        gameId: "pong",
        gameUrl: "https://example.com/pong",
      },
    );

    expect(forgedLaunchAck.ok).toBe(false);
    expect(forgedLaunchAck.code).toBe(ErrorCode.UNAUTHORIZED);
    await harness.expectNoEvent(controller, "client:loadUi");

    const validLaunchAck = await harness.emitWithAck<LaunchGameAck>(
      masterHost,
      "system:launchGame",
      {
        roomId,
        gameId: "pong",
        gameUrl: "https://example.com/pong",
      },
    );
    expect(validLaunchAck.ok).toBe(true);
    const controllerLoadUi = await harness.waitForEvent<{ url: string }>(
      controller,
      "client:loadUi",
    );
    expect(controllerLoadUi.url).toBe("https://example.com/pong");

    const childHost = await harness.connectSocket();
    const childJoinAck = await harness.emitWithAck<{ ok: boolean }>(
      childHost,
      "host:joinAsChild",
      {
        roomId,
        joinToken: validLaunchAck.joinToken,
      },
    );
    expect(childJoinAck.ok).toBe(true);

    attacker.emit("system:closeGame", { roomId });
    await harness.expectNoEvent(controller, "client:unloadUi");
    await harness.expectNoEvent(childHost, "disconnect");

    masterHost.emit("system:closeGame", { roomId });
    await harness.waitForEvent(controller, "client:unloadUi", 2_000);
  });

  it("blocks forged host:state mutation attempts", async () => {
    const masterHost = await harness.connectSocket();
    const attacker = await harness.connectSocket();
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
      { roomId, controllerId: "ctrl_state_1", nickname: "State" },
    );
    expect(joinAck.ok).toBe(true);

    await harness.delay(25);
    const initialSession = harness.getRoomManager().getRoom(roomId);
    expect(initialSession?.gameState).toBe("paused");

    attacker.emit("host:state", {
      roomId,
      state: { gameState: "playing" },
    });

    await harness.delay(50);
    const afterForgedUpdate = harness.getRoomManager().getRoom(roomId);
    expect(afterForgedUpdate?.gameState).toBe("paused");

    masterHost.emit("host:state", {
      roomId,
      state: { gameState: "playing" },
    });

    await harness.delay(50);
    const afterValidUpdate = harness.getRoomManager().getRoom(roomId);
    expect(afterValidUpdate?.gameState).toBe("playing");
  });
});

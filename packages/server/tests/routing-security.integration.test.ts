import { ErrorCode } from "@air-jam/sdk/protocol";
import { describe, expect, it } from "vitest";
import type { AuthService } from "../src/services/auth-service";
import { setupServerTestHarness } from "./helpers/server-test-harness";

type HostCreateRoomAck = {
  ok: boolean;
  roomId?: string;
  controllerCapability?: {
    token: string;
    expiresAt: number;
    grants: string[];
  };
};

type ControllerJoinAck = {
  ok: boolean;
};

type LaunchGameAck = {
  ok: boolean;
  launchCapability?: { token: string; expiresAt: number };
  code?: ErrorCode | string;
};

const allowAllAuthService = {
  verifyHostBootstrap: async ({ appId }: { appId?: string }) => ({
    isVerified: true,
    appId,
    verifiedVia: "appId" as const,
  }),
} as AuthService;

describe("server routing and security", () => {
  const harness = setupServerTestHarness({
    server: { authService: allowAllAuthService },
  });

  it("routes controller input to active host based on focus", async () => {
    const masterHost = await harness.connectSocket();
    expect((await harness.bootstrapHost(masterHost)).ok).toBe(true);
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
      },
    );

    expect(launchAck.ok).toBe(true);
    expect(launchAck.launchCapability?.token).toBeTypeOf("string");

    const childHost = await harness.connectSocket();
    const childJoinAck = await harness.emitWithAck<{ ok: boolean }>(
      childHost,
      "host:joinAsChild",
      {
        roomId,
        capabilityToken: launchAck.launchCapability?.token,
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
    expect((await harness.bootstrapHost(host)).ok).toBe(true);
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
      {
        roomId,
        controllerId: "ctrl_legit_1",
        nickname: "Legit",
        capabilityToken: createAck.controllerCapability?.token,
      },
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
    expect((await harness.bootstrapHost(host)).ok).toBe(true);
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
      {
        roomId,
        controllerId: "ctrl_internal_1",
        nickname: "Internal",
        capabilityToken: createAck.controllerCapability?.token,
      },
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
    expect((await harness.bootstrapHost(masterHost)).ok).toBe(true);
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
      {
        roomId,
        controllerId: "ctrl_arcade_1",
        nickname: "ArcadeCtrl",
        capabilityToken: createAck.controllerCapability?.token,
      },
    );
    expect(joinAck.ok).toBe(true);

    const launchAck = await harness.emitWithAck<LaunchGameAck>(
      masterHost,
      "system:launchGame",
      {
        roomId,
        gameId: "pong",
      },
    );
    expect(launchAck.ok).toBe(true);
    expect(launchAck.launchCapability?.token).toBeTypeOf("string");

    const childHost = await harness.connectSocket();
    const childJoinAck = await harness.emitWithAck<{ ok: boolean }>(
      childHost,
      "host:joinAsChild",
      {
        roomId,
        capabilityToken: launchAck.launchCapability?.token,
      },
    );
    expect(childJoinAck.ok).toBe(true);

    controller.emit("controller:action_rpc", {
      roomId,
      actionName: "airjam.arcade.toggle_qr",
      payload: undefined,
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
    expect(forwarded.payload).toBeUndefined();

    await harness.expectNoEvent(childHost, "airjam:action_rpc");
  });

  it("blocks unauthorized host:play_sound events", async () => {
    const host = await harness.connectSocket();
    expect((await harness.bootstrapHost(host)).ok).toBe(true);
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

  it("blocks privileged controller channels for room-code-only joins", async () => {
    const host = await harness.connectSocket();
    expect((await harness.bootstrapHost(host)).ok).toBe(true);
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
      { roomId, controllerId: "ctrl_basic_1", nickname: "Basic" },
    );
    expect(joinAck.ok).toBe(true);

    controller.emit("controller:play_sound", {
      roomId,
      soundId: "blocked_sound",
      volume: 0.4,
      loop: false,
    });
    controller.emit("controller:action_rpc", {
      roomId,
      actionName: "joinTeam",
      payload: { team: "team1" },
      storeDomain: "default",
    });
    controller.emit("controller:system", {
      roomId,
      command: "toggle_pause",
    });

    await harness.expectNoEvent(host, "server:playSound");
    await harness.expectNoEvent(host, "airjam:action_rpc");
    await harness.delay(50);
    expect(harness.getRoomManager().getRoom(roomId)?.gameState).toBe("paused");
  });

  it("allows privileged controller system and sound events with the official capability", async () => {
    const host = await harness.connectSocket();
    expect((await harness.bootstrapHost(host)).ok).toBe(true);
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
      {
        roomId,
        controllerId: "ctrl_priv_1",
        nickname: "Privileged",
        capabilityToken: createAck.controllerCapability?.token,
      },
    );
    expect(joinAck.ok).toBe(true);

    controller.emit("controller:play_sound", {
      roomId,
      soundId: "ok_sound",
      volume: 0.4,
      loop: false,
    });

    const sound = await harness.waitForEvent<{ id: string }>(
      host,
      "server:playSound",
    );
    expect(sound.id).toBe("ok_sound");

    controller.emit("controller:system", {
      roomId,
      command: "toggle_pause",
    });

    await harness.delay(50);
    expect(harness.getRoomManager().getRoom(roomId)?.gameState).toBe("playing");
  });

  it("blocks unauthorized launch and close transitions", async () => {
    const masterHost = await harness.connectSocket();
    expect((await harness.bootstrapHost(masterHost)).ok).toBe(true);
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
      },
    );

    expect(forgedLaunchAck.ok).toBe(false);
    expect(forgedLaunchAck.code).toBe(ErrorCode.UNAUTHORIZED);
    expect(harness.getRoomManager().getRoom(roomId)?.activeGameId).toBeUndefined();

    const validLaunchAck = await harness.emitWithAck<LaunchGameAck>(
      masterHost,
      "system:launchGame",
      {
        roomId,
        gameId: "pong",
      },
    );
    expect(validLaunchAck.ok).toBe(true);
    expect(harness.getRoomManager().getRoom(roomId)?.activeGameId).toBe("pong");

    const childHost = await harness.connectSocket();
    const childJoinAck = await harness.emitWithAck<{ ok: boolean }>(
      childHost,
      "host:joinAsChild",
      {
        roomId,
        capabilityToken: validLaunchAck.launchCapability?.token,
      },
    );
    expect(childJoinAck.ok).toBe(true);

    attacker.emit("system:closeGame", { roomId });
    await harness.expectNoEvent(controller, "disconnect");
    await harness.expectNoEvent(childHost, "disconnect");

    const childDisconnectPromise = harness.waitForEvent(childHost, "disconnect", 2_000);
    masterHost.emit("system:closeGame", { roomId });
    await harness.expectNoEvent(controller, "disconnect", 120);
    await childDisconnectPromise;
  });

  it("blocks forged host:state mutation attempts", async () => {
    const masterHost = await harness.connectSocket();
    expect((await harness.bootstrapHost(masterHost)).ok).toBe(true);
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

import { ErrorCode } from "@air-jam/sdk/protocol";
import { describe, expect, it } from "vitest";
import type { AuthService } from "../src/services/auth-service";
import { setupServerTestHarness } from "./helpers/server-test-harness";

type HostCreateRoomAck = {
  ok: boolean;
  roomId?: string;
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

describe("server game lifecycle", () => {
  const harness = setupServerTestHarness({
    server: { authService: allowAllAuthService },
  });

  it("launches game and lets child host join", async () => {
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

    const joinAck = await harness.emitWithAck<{ ok: boolean }>(
      controller,
      "controller:join",
      { roomId, controllerId: "ctrl_launch_1", nickname: "Launch" },
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
    const joinedNoticePromise = harness.waitForEvent<{ controllerId: string }>(
      childHost,
      "server:controllerJoined",
      2_000,
    );
    const stateNoticePromise = harness.waitForEvent<{
      roomId: string;
      state: { gameState: "paused" | "playing" };
    }>(childHost, "server:state", 2_000);

    const childJoinAck = await harness.emitWithAck<{ ok: boolean; roomId?: string }>(
      childHost,
      "host:joinAsChild",
      {
        roomId,
        capabilityToken: launchAck.launchCapability?.token,
      },
    );

    expect(childJoinAck.ok).toBe(true);
    expect(childJoinAck.roomId).toBe(roomId);

    const joinedNotice = await joinedNoticePromise;
    expect(joinedNotice.controllerId).toBe("ctrl_launch_1");

    const stateNotice = await stateNoticePromise;
    expect(stateNotice.roomId).toBe(roomId);
    expect(stateNotice.state.gameState).toBe("paused");
  });

  it("activates embedded games on the master host socket without requiring a child host socket", async () => {
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

    const joinAck = await harness.emitWithAck<{ ok: boolean }>(
      controller,
      "controller:join",
      { roomId, controllerId: "ctrl_embed_1", nickname: "Embed" },
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

    const activateAck = await harness.emitWithAck<{ ok: boolean; roomId?: string }>(
      masterHost,
      "host:activateEmbeddedGame",
      {
        roomId,
        capabilityToken: launchAck.launchCapability?.token,
      },
    );
    expect(activateAck.ok).toBe(true);
    expect(activateAck.roomId).toBe(roomId);

    const session = harness.getRoomManager().getRoom(roomId)!;
    expect(session.focus).toBe("GAME");
    expect(session.childHostSocketId).toBeUndefined();

    const inputPromise = harness.waitForEvent<{
      controllerId: string;
      input: { action?: boolean };
    }>(masterHost, "server:input", 2_000);

    controller.emit("controller:input", {
      roomId,
      controllerId: "ctrl_embed_1",
      input: { action: true },
      timestamp: Date.now(),
    });

    const inputEvent = await inputPromise;
    expect(inputEvent.controllerId).toBe("ctrl_embed_1");
    expect(inputEvent.input.action).toBe(true);
  });

  it("rejects child host join when token is invalid", async () => {
    const masterHost = await harness.connectSocket();
    expect((await harness.bootstrapHost(masterHost)).ok).toBe(true);

    const createAck = await harness.emitWithAck<HostCreateRoomAck>(
      masterHost,
      "host:createRoom",
      { maxPlayers: 4 },
    );

    expect(createAck.ok).toBe(true);
    const roomId = createAck.roomId!;

    const childHost = await harness.connectSocket();
    const childJoinAck = await harness.emitWithAck<{
      ok: boolean;
      code?: ErrorCode | string;
      message?: string;
    }>(childHost, "host:joinAsChild", {
      roomId,
      capabilityToken: "invalid-token",
    });

    expect(childJoinAck.ok).toBe(false);
    expect(childJoinAck.code).toBe(ErrorCode.INVALID_TOKEN);
  });

  it("closes game and disconnects the child host without dropping controllers", async () => {
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

    const joinAck = await harness.emitWithAck<{ ok: boolean }>(
      controller,
      "controller:join",
      { roomId, controllerId: "ctrl_close_1", nickname: "Closer" },
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

    const childDisconnectPromise = harness.waitForEvent(childHost, "disconnect", 2_000);
    masterHost.emit("system:closeGame", { roomId });

    await harness.expectNoEvent(controller, "disconnect", 120);
    await childDisconnectPromise;
  });

  it("keeps controllers connected across game switches and propagates pause/resume", async () => {
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

    const joinAck = await harness.emitWithAck<{ ok: boolean }>(
      controller,
      "controller:join",
      { roomId, controllerId: "ctrl_switch_1", nickname: "Switcher" },
    );
    expect(joinAck.ok).toBe(true);

    const firstLaunchAck = await harness.emitWithAck<LaunchGameAck>(
      masterHost,
      "system:launchGame",
      {
        roomId,
        gameId: "game-one",
      },
    );
    expect(firstLaunchAck.ok).toBe(true);

    const childHostOne = await harness.connectSocket();
    const childJoinOneAck = await harness.emitWithAck<{ ok: boolean }>(
      childHostOne,
      "host:joinAsChild",
      {
        roomId,
        capabilityToken: firstLaunchAck.launchCapability?.token,
      },
    );
    expect(childJoinOneAck.ok).toBe(true);

    const firstToggleStatePromise = harness.waitForEvent<{
      roomId: string;
      state: { gameState: "paused" | "playing" };
    }>(childHostOne, "server:state", 2_000);
    masterHost.emit("host:system", { roomId, command: "toggle_pause" });
    const firstToggleState = await firstToggleStatePromise;
    expect(firstToggleState.roomId).toBe(roomId);
    expect(["paused", "playing"]).toContain(firstToggleState.state.gameState);

    const childDisconnectPromise = harness.waitForEvent(
      childHostOne,
      "disconnect",
      2_000,
    );
    masterHost.emit("system:closeGame", { roomId });
    await harness.expectNoEvent(controller, "disconnect", 120);
    await childDisconnectPromise;

    const secondLaunchAck = await harness.emitWithAck<LaunchGameAck>(
      masterHost,
      "system:launchGame",
      {
        roomId,
        gameId: "game-two",
      },
    );
    expect(secondLaunchAck.ok).toBe(true);

    const childHostTwo = await harness.connectSocket();
    const childJoinedControllerPromise = harness.waitForEvent<{
      controllerId: string;
    }>(childHostTwo, "server:controllerJoined", 2_000);
    const childJoinTwoAck = await harness.emitWithAck<{ ok: boolean }>(
      childHostTwo,
      "host:joinAsChild",
      {
        roomId,
        capabilityToken: secondLaunchAck.launchCapability?.token,
      },
    );
    expect(childJoinTwoAck.ok).toBe(true);
    expect((await childJoinedControllerPromise).controllerId).toBe(
      "ctrl_switch_1",
    );

    const secondToggleStatePromise = harness.waitForEvent<{
      roomId: string;
      state: { gameState: "paused" | "playing" };
    }>(childHostTwo, "server:state", 2_000);
    masterHost.emit("host:system", { roomId, command: "toggle_pause" });
    const secondToggleState = await secondToggleStatePromise;

    const thirdToggleStatePromise = harness.waitForEvent<{
      roomId: string;
      state: { gameState: "paused" | "playing" };
    }>(childHostTwo, "server:state", 2_000);
    masterHost.emit("host:system", { roomId, command: "toggle_pause" });
    const thirdToggleState = await thirdToggleStatePromise;

    expect(secondToggleState.roomId).toBe(roomId);
    expect(thirdToggleState.roomId).toBe(roomId);
    expect(secondToggleState.state.gameState).not.toBe(
      thirdToggleState.state.gameState,
    );
  });

  it("lets a new child host socket re-join after disconnect without unloading controllers", async () => {
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

    const joinAck = await harness.emitWithAck<{ ok: boolean }>(
      controller,
      "controller:join",
      { roomId, controllerId: "ctrl_rechild_1", nickname: "Rechild" },
    );
    expect(joinAck.ok).toBe(true);

    const launchAck = await harness.emitWithAck<LaunchGameAck>(
      masterHost,
      "system:launchGame",
      {
        roomId,
        gameId: "proto",
      },
    );
    expect(launchAck.ok).toBe(true);

    const childOne = await harness.connectSocket();
    const joinOneAck = await harness.emitWithAck<{ ok: boolean }>(
      childOne,
      "host:joinAsChild",
      { roomId, capabilityToken: launchAck.launchCapability?.token },
    );
    expect(joinOneAck.ok).toBe(true);

    childOne.disconnect();
    await harness.delay(20);

    const childTwo = await harness.connectSocket();
    const joinTwoAck = await harness.emitWithAck<{ ok: boolean }>(
      childTwo,
      "host:joinAsChild",
      { roomId, capabilityToken: launchAck.launchCapability?.token },
    );
    expect(joinTwoAck.ok).toBe(true);

    await harness.expectNoEvent(controller, "disconnect", 120);

    const togglePromise = harness.waitForEvent<{
      roomId: string;
      state: { gameState: "paused" | "playing" };
    }>(childTwo, "server:state", 2_000);
    masterHost.emit("host:system", { roomId, command: "toggle_pause" });
    const toggleState = await togglePromise;
    expect(toggleState.roomId).toBe(roomId);
  });
});

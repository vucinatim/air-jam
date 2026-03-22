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
  joinToken?: string;
  code?: ErrorCode | string;
};

const allowAllAuthService = {
  verifyApiKey: async () => ({ isVerified: true }),
} as AuthService;

describe("server game lifecycle", () => {
  const harness = setupServerTestHarness({
    server: { authService: allowAllAuthService },
  });

  it("launches game, notifies controllers, and lets child host join", async () => {
    const masterHost = await harness.connectSocket();
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

    const controllerLoadUiPromise = harness.waitForEvent<{ url: string }>(
      controller,
      "client:loadUi",
    );

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

    const controllerLoadUi = await controllerLoadUiPromise;
    expect(controllerLoadUi.url).toBe("https://example.com/pong");

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
        joinToken: launchAck.joinToken,
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

  it("rejects child host join when token is invalid", async () => {
    const masterHost = await harness.connectSocket();

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
      joinToken: "invalid-token",
    });

    expect(childJoinAck.ok).toBe(false);
    expect(childJoinAck.code).toBe(ErrorCode.INVALID_TOKEN);
  });

  it("rejects launch requests with non-http game URLs", async () => {
    const masterHost = await harness.connectSocket();

    const createAck = await harness.emitWithAck<HostCreateRoomAck>(
      masterHost,
      "host:createRoom",
      { maxPlayers: 4 },
    );
    expect(createAck.ok).toBe(true);

    const roomId = createAck.roomId!;

    const launchAck = await harness.emitWithAck<LaunchGameAck>(
      masterHost,
      "system:launchGame",
      {
        roomId,
        gameId: "bad-game",
        gameUrl: "javascript:alert(1)",
      },
    );

    expect(launchAck.ok).toBe(false);
    expect(launchAck.code).toBe(ErrorCode.INVALID_PAYLOAD);
  });

  it("closes game and forces controllers to unload UI", async () => {
    const masterHost = await harness.connectSocket();
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

    const controllerLoadUiPromise = harness.waitForEvent<{ url: string }>(
      controller,
      "client:loadUi",
    );

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

    await controllerLoadUiPromise;

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

    const childDisconnectPromise = harness.waitForEvent(childHost, "disconnect", 2_000);
    masterHost.emit("system:closeGame", { roomId });

    await harness.waitForEvent(controller, "client:unloadUi", 2_000);
    await childDisconnectPromise;
  });

  it("keeps controllers connected across game switches and propagates pause/resume", async () => {
    const masterHost = await harness.connectSocket();
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

    const firstLoadPromise = harness.waitForEvent<{ url: string }>(
      controller,
      "client:loadUi",
      2_000,
    );
    const firstLaunchAck = await harness.emitWithAck<LaunchGameAck>(
      masterHost,
      "system:launchGame",
      {
        roomId,
        gameId: "game-one",
        gameUrl: "https://example.com/game-one",
      },
    );
    expect(firstLaunchAck.ok).toBe(true);
    expect((await firstLoadPromise).url).toBe("https://example.com/game-one");

    const childHostOne = await harness.connectSocket();
    const childJoinOneAck = await harness.emitWithAck<{ ok: boolean }>(
      childHostOne,
      "host:joinAsChild",
      {
        roomId,
        joinToken: firstLaunchAck.joinToken,
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

    const unloadPromise = harness.waitForEvent(controller, "client:unloadUi", 2_000);
    const childDisconnectPromise = harness.waitForEvent(
      childHostOne,
      "disconnect",
      2_000,
    );
    masterHost.emit("system:closeGame", { roomId });
    await unloadPromise;
    await childDisconnectPromise;

    const secondLoadPromise = harness.waitForEvent<{ url: string }>(
      controller,
      "client:loadUi",
      2_000,
    );
    const secondLaunchAck = await harness.emitWithAck<LaunchGameAck>(
      masterHost,
      "system:launchGame",
      {
        roomId,
        gameId: "game-two",
        gameUrl: "https://example.com/game-two",
      },
    );
    expect(secondLaunchAck.ok).toBe(true);
    expect((await secondLoadPromise).url).toBe("https://example.com/game-two");

    const childHostTwo = await harness.connectSocket();
    const childJoinedControllerPromise = harness.waitForEvent<{
      controllerId: string;
    }>(childHostTwo, "server:controllerJoined", 2_000);
    const childJoinTwoAck = await harness.emitWithAck<{ ok: boolean }>(
      childHostTwo,
      "host:joinAsChild",
      {
        roomId,
        joinToken: secondLaunchAck.joinToken,
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
});

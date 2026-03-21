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

    const controllerLoadUi = await harness.waitForEvent<{ url: string }>(
      controller,
      "client:loadUi",
    );
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

    await harness.waitForEvent(controller, "client:loadUi");

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
});

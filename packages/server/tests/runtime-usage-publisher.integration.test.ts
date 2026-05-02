import { describe, expect, it } from "vitest";
import type {
  RuntimeUsageEvent,
  RuntimeUsagePublisher,
} from "../src/analytics/runtime-usage";
import type { HostBootstrapAuthService } from "../src/services/auth-service";
import { setupServerTestHarness } from "./helpers/server-test-harness";

const createCollectingPublisher = (): {
  events: RuntimeUsageEvent[];
  publisher: RuntimeUsagePublisher;
} => {
  const events: RuntimeUsageEvent[] = [];

  return {
    events,
    publisher: {
      publish: (event) => {
        events.push(event);
      },
    },
  };
};

describe("runtime usage publisher seam", () => {
  const collector = createCollectingPublisher();
  const authService: HostBootstrapAuthService = {
    verifyHostBootstrap: async ({ appId }) => ({
      isVerified: true,
      appId,
      gameId:
        appId === "aj_app_usage_standalone" ? "game-standalone-1" : undefined,
      verifiedVia: "appId",
      verifiedOrigin: "http://127.0.0.1",
    }),
  };
  const harness = setupServerTestHarness({
    server: {
      authService,
      runtimeUsagePublisher: collector.publisher,
    },
  });

  it("adds stable analytics identity to rooms and emits semantic usage events", async () => {
    collector.events.length = 0;

    const host = await harness.connectSocket();
    const bootstrapAck = await harness.bootstrapHost(host, "aj_app_usage_test");
    expect(bootstrapAck.ok).toBe(true);

    const createAck = await harness.emitWithAck<{
      ok: boolean;
      roomId?: string;
    }>(host, "host:createRoom", { maxPlayers: 4 });
    expect(createAck.ok).toBe(true);

    const roomId = createAck.roomId!;
    const room = harness.getRoomManager().getRoom(roomId);
    expect(room).toBeDefined();
    expect(room?.analytics.runtimeSessionId).toBeTruthy();
    expect(room?.analytics.appId).toBe("aj_app_usage_test");
    expect(room?.analytics.hostVerifiedVia).toBe("appId");

    const launchAck = await harness.emitWithAck<{ ok: boolean }>(
      host,
      "system:launchGame",
      { roomId, gameId: "game-1" },
    );
    expect(launchAck.ok).toBe(true);

    const controller = await harness.connectSocket();
    const joinAck = await harness.emitWithAck<{ ok: boolean }>(
      controller,
      "controller:join",
      {
        roomId,
        controllerId: "ctrl_usage_1",
        nickname: "Player 1",
      },
    );
    expect(joinAck.ok).toBe(true);

    await harness.emitWithAck<{ ok: boolean }>(controller, "controller:leave", {
      roomId,
      controllerId: "ctrl_usage_1",
    });
    await harness.delay(20);

    expect(collector.events.map((event) => event.kind)).toEqual([
      "host_bootstrap_verified",
      "room_created",
      "game_launch_started",
      "controller_joined",
      "controller_left",
    ]);

    const roomScopedEvents = collector.events.filter(
      (event) => event.roomId === roomId,
    );
    expect(
      roomScopedEvents.every(
        (event) => event.runtimeSessionId === room?.analytics.runtimeSessionId,
      ),
    ).toBe(true);
    expect(
      roomScopedEvents.every((event) => event.appId === "aj_app_usage_test"),
    ).toBe(true);
  });

  it("emits disconnect semantics separately from explicit leave", async () => {
    collector.events.length = 0;

    const host = await harness.connectSocket();
    const bootstrapAck = await harness.bootstrapHost(
      host,
      "aj_app_usage_disconnect",
    );
    expect(bootstrapAck.ok).toBe(true);

    const createAck = await harness.emitWithAck<{
      ok: boolean;
      roomId?: string;
    }>(host, "host:createRoom", {});
    expect(createAck.ok).toBe(true);
    const roomId = createAck.roomId!;

    const controller = await harness.connectSocket();
    const joinAck = await harness.emitWithAck<{ ok: boolean }>(
      controller,
      "controller:join",
      {
        roomId,
        controllerId: "ctrl_usage_disconnect",
      },
    );
    expect(joinAck.ok).toBe(true);

    controller.disconnect();
    await harness.delay(20);

    expect(
      collector.events.some(
        (event) =>
          event.kind === "controller_disconnected" &&
          event.roomId === roomId &&
          event.payload?.controllerId === "ctrl_usage_disconnect",
      ),
    ).toBe(true);
  });

  it("marks standalone rooms as gameplay-active on creation when a canonical game is known", async () => {
    collector.events.length = 0;

    const host = await harness.connectSocket();
    const bootstrapAck = await harness.bootstrapHost(
      host,
      "aj_app_usage_standalone",
      "game",
    );
    expect(bootstrapAck.ok).toBe(true);

    const createAck = await harness.emitWithAck<{
      ok: boolean;
      roomId?: string;
    }>(host, "host:createRoom", { maxPlayers: 4 });
    expect(createAck.ok).toBe(true);

    const room = harness.getRoomManager().getRoom(createAck.roomId!);
    expect(room?.focus).toBe("GAME");
    expect(room?.lifecycleState).toBe("GAME_ACTIVE");
    expect(room?.activeGameId).toBe("game-standalone-1");

    expect(collector.events.map((event) => event.kind)).toEqual([
      "host_bootstrap_verified",
      "room_created",
      "game_became_active",
    ]);
    expect(collector.events[2]?.gameId).toBe("game-standalone-1");
  });
});

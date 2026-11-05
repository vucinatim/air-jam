import { DEFAULT_ROOM_PLATFORM_SETTINGS } from "@air-jam/sdk";
import type { ControllerJoinPayload } from "@air-jam/sdk/protocol";
import { describe, expect, it, vi } from "vitest";
import { registerControllerHandlers } from "../src/gateway/handlers/register-controller-handlers";
import type { SocketHandlerContext } from "../src/gateway/socket-handler-context";
import { createServerLogger } from "../src/logging/logger";
import { RoomManager } from "../src/services/room-manager";
import type { RoomSession } from "../src/types";

describe("controller default names", () => {
  it("numbers unnamed guests from one and preserves chosen names and resumed names", async () => {
    const roomManager = new RoomManager();
    const session: RoomSession = {
      roomId: "ABCD",
      masterHostSocketId: "host",
      hostResumeCapability: { token: "host-resume-token" },
      analytics: {
        runtimeSessionId: "runtime-session",
        startedAt: Date.now(),
        hostSessionKind: "system",
      },
      focus: "SYSTEM",
      controllers: new Map(),
      replicatedStoreSnapshots: new Map(),
      maxPlayers: 8,
      runtimeState: "paused",
      stateVersion: 0,
      controllerOrientation: "portrait",
      roomSettings: DEFAULT_ROOM_PLATFORM_SETTINGS,
      lifecycleState: "SYSTEM_IDLE",
      admissionLease: { roomId: "ABCD", leaseToken: "room-lease" },
    };
    roomManager.setRoom(session.roomId, session);
    const notice = vi.fn();
    const join = async (
      controllerId: string,
      options: Partial<ControllerJoinPayload> = {},
    ) => {
      const socket = {
        id: `socket-${controllerId}`,
        connected: true,
        data: {},
        on: vi.fn(),
        emit: vi.fn(),
        join: vi.fn(),
      };
      registerControllerHandlers({
        socket,
        io: { to: () => ({ emit: notice }) },
        roomManager,
        logger: createServerLogger(undefined, undefined, undefined, {
          level: "silent",
        }),
        isRateLimited: () => false,
        realtimeAdmissionService: {
          admitController: async () => ({
            ok: true,
            lease: {
              roomId: session.roomId,
              controllerId,
              leaseToken: `lease-${controllerId}`,
            },
          }),
        },
        runtimeUsagePublisher: { publish: vi.fn() },
      } as unknown as SocketHandlerContext);
      const handler = socket.on.mock.calls.find(
        ([event]) => event === "controller:join",
      )?.[1];
      expect(handler).toBeTypeOf("function");
      const acknowledge = vi.fn();
      await handler(
        { roomId: session.roomId, controllerId, ...options },
        acknowledge,
      );
      expect(acknowledge).toHaveBeenCalledWith(
        expect.objectContaining({ ok: true }),
      );
      return socket.emit;
    };

    const first = await join("first");
    const second = await join("second");
    const named = await join("named", { nickname: "Alex" });
    const resumed = await join("first");
    for (const [emit, label] of [
      [first, "Player 1"],
      [second, "Player 2"],
      [named, "Alex"],
      [resumed, "Player 1"],
    ] as const) {
      expect(emit).toHaveBeenCalledWith(
        "server:welcome",
        expect.objectContaining({ player: expect.objectContaining({ label }) }),
      );
      expect(notice).toHaveBeenCalledWith(
        "server:controllerJoined",
        expect.objectContaining({ player: expect.objectContaining({ label }) }),
      );
    }
  }, 1000);
});

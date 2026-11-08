import { DEFAULT_ROOM_PLATFORM_SETTINGS } from "@air-jam/sdk";
import type { ControllerJoinPayload } from "@air-jam/sdk/protocol";
import { describe, expect, it, vi } from "vitest";
import { registerControllerHandlers } from "../src/gateway/handlers/register-controller-handlers";
import type { SocketHandlerContext } from "../src/gateway/socket-handler-context";
import { createServerLogger } from "../src/logging/logger";
import { RoomManager } from "../src/services/room-manager";
import type { RoomSession } from "../src/types";

const setup = () => {
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
  const profileUpdates = new Map<
    string,
    (payload: unknown, callback: ReturnType<typeof vi.fn>) => Promise<void>
  >();
  let socketId = 0;
  const join = async (
    controllerId: string,
    options: Partial<ControllerJoinPayload> = {},
  ) => {
    const socket = {
      id: `socket-${++socketId}`,
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
      isControllerAuthorizedForRoom: (roomId: string, id: string) =>
        roomId === session.roomId &&
        session.controllers.get(id)?.socketId === socket.id,
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
    profileUpdates.set(
      controllerId,
      socket.on.mock.calls.find(
        ([event]) => event === "controller:updatePlayerProfile",
      )?.[1],
    );
    const handler = socket.on.mock.calls.find(
      ([event]) => event === "controller:join",
    )?.[1];
    expect(handler).toBeTypeOf("function");
    const acknowledge = vi.fn();
    await handler(
      {
        roomId: session.roomId,
        controllerId,
        deviceId: `pd_${controllerId}`,
        resumeCapabilityToken:
          session.controllers.get(controllerId)?.resumeCapabilityToken,
        ...options,
      },
      acknowledge,
    );
    expect(acknowledge).toHaveBeenCalledWith(
      expect.objectContaining({ ok: true }),
    );
    return socket.emit;
  };
  const rename = async (controllerId: string, label: string) => {
    const acknowledge = vi.fn();
    await profileUpdates.get(controllerId)!(
      {
        roomId: session.roomId,
        controllerId,
        patch: { label },
      },
      acknowledge,
    );
    expect(acknowledge).toHaveBeenCalledWith(
      expect.objectContaining({ ok: true }),
    );
  };
  return { join, notice, session, rename };
};

describe("controller default names", () => {
  it("moves a seat label between resumed phones and restores each phone's ordinary name", async () => {
    const { join, session, rename } = setup();
    const expectName = (controllerId: string, label: string) =>
      expect(session.controllers.get(controllerId)?.playerProfile.label).toBe(
        label,
      );

    await join("keyboard", { localSeatLabel: "Keyboard 1" });
    await join("phone", { nickname: "Alex" });
    expectName("keyboard", "Keyboard 1");
    expectName("phone", "Alex");
    expect(session.controllers.get("keyboard")?.nickname).toBeUndefined();

    // Reload both identities after moving the seat; an ordinary launch has no label.
    await join("keyboard");
    await join("phone", { localSeatLabel: "Keyboard 1" });
    expectName("keyboard", "Player 1");
    expectName("phone", "Keyboard 1");
    expect(session.controllers.get("phone")?.nickname).toBe("Alex");

    // Reconnect while seated, then swap back. The ordinary name survives both.
    await join("phone", { localSeatLabel: "Keyboard 1" });
    await join("phone");
    await join("keyboard", { localSeatLabel: "Keyboard 1" });
    expectName("phone", "Alex");
    expectName("keyboard", "Keyboard 1");

    // A different seat takes precedence even when the game also supplies a nickname.
    await join("phone", { nickname: "Ada", localSeatLabel: "Gamepad 1" });
    expectName("phone", "Gamepad 1");
    await rename("phone", "Sam");
    expectName("phone", "Gamepad 1");
    await join("phone");
    expectName("phone", "Sam");
  }, 1000);

  it("numbers unnamed guests from one and preserves chosen names and resumed names", async () => {
    const { join, notice } = setup();

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

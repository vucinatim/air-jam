import {
  clientSocketEvents,
  ErrorCode,
  isSocketPayloadBounded,
  SOCKET_INGRESS_ABUSE_LIMIT,
  SOCKET_INGRESS_WINDOW_MS,
  SOCKET_MAX_HTTP_BUFFER_SIZE,
  SOCKET_PAYLOAD_BOUNDS,
} from "@air-jam/sdk/protocol";
import pino from "pino";
import { io, type Socket } from "socket.io-client";
import { expect, it } from "vitest";
import { createAirJamServer } from "../src/index";
import { RateLimitService } from "../src/services/rate-limit-service";
import { RoomManager } from "../src/services/room-manager";
import { emitWithAck, waitForSocketConnect } from "./helpers/socket-test-utils";

const nextEvent = (socket: Socket, event: string) =>
  new Promise<unknown[]>((resolve) =>
    socket.once(event, (...args: unknown[]) => resolve(args)),
  );

it("contains malformed, spoofed and flooding input while another room keeps playing", async () => {
  expect(
    isSocketPayloadBounded(
      { chunks: Array(8).fill("é".repeat(500)) },
      "controller",
    ),
  ).toBe(false);
  expect(
    isSocketPayloadBounded(
      Object.fromEntries(
        Array.from({ length: 1025 }, (_, index) => [`key${index}`, 0]),
      ),
      "hostState",
    ),
  ).toBe(false);
  let now = 1;
  const rooms = new RoomManager();
  const logs: string[] = [];
  const runtime = createAirJamServer({
    roomManager: rooms,
    logger: pino(
      { level: "warn" },
      {
        write: (line: string) => {
          logs.push(line);
        },
      },
    ),
    rateLimitService: new RateLimitService(() => now),
    authService: {
      verifyHostBootstrap: async ({ appId, hostSessionKind }) => ({
        isVerified: true,
        appId,
        verifiedVia: "appId",
        hostSessionKind: hostSessionKind ?? "system",
      }),
    },
  });
  const sockets: Socket[] = [];
  const port = await runtime.start(0);
  const connect = async () => {
    const socket = io(`http://127.0.0.1:${port}`, {
      transports: ["websocket"],
      forceNew: true,
      reconnection: false,
    });
    sockets.push(socket);
    await waitForSocketConnect(socket);
    return socket;
  };
  const acknowledge = (socket: Socket, event: string, payload: unknown) =>
    emitWithAck<{ ok?: boolean; code?: string; reason?: string }>(
      socket,
      event,
      payload,
    );
  const barrier = (socket: Socket) =>
    acknowledge(socket, "unknown:ingress-barrier", null);
  try {
    const host = await connect();
    const otherHost = await connect();
    for (const socket of [host, otherHost]) {
      expect(
        await acknowledge(socket, "host:bootstrap", {
          hostSessionKind: "system",
        }),
      ).toMatchObject({ ok: true });
    }
    const createRoom = (socket: Socket) =>
      emitWithAck<{ ok: boolean; roomId: string }>(socket, "host:createRoom", {
        maxPlayers: 4,
      });
    const healthy = await createRoom(host);
    const attacked = await createRoom(otherHost);
    expect(healthy.ok && attacked.ok).toBe(true);
    const controller = await connect();
    expect(
      await acknowledge(controller, "controller:join", {
        roomId: healthy.roomId,
        controllerId: "honest-player",
        resumeCapabilityToken: "honest-player-resume-secret-0000000000",
      }),
    ).toMatchObject({ ok: true });
    let inputs = 0;
    let actions = 0;
    host.on("server:input", () => {
      inputs += 1;
    });
    host.on("airjam:action_rpc", (payload, callback) => {
      actions += 1;
      callback({
        ok: true,
        status: "accepted",
        source: "host",
        result: payload.payload,
      });
    });
    const play = async (revision: number) => {
      const input = nextEvent(host, "server:input");
      controller.emit("controller:input", {
        roomId: healthy.roomId,
        controllerId: "honest-player",
        input: { move: revision },
      });
      await input;
      expect(
        await acknowledge(controller, "controller:action_rpc", {
          roomId: healthy.roomId,
          storeDomain: "default",
          actionName: "move",
          payload: { step: revision },
        }),
      ).toMatchObject({ ok: true });
      const state = nextEvent(controller, "airjam:state_sync");
      host.emit("host:state_sync", {
        roomId: healthy.roomId,
        storeDomain: "default",
        revision,
        data: { score: revision },
      });
      expect((await state)[0]).toMatchObject({
        data: { score: revision },
        revision,
      });
    };
    await play(1);
    const deep = Array.from({ length: 24 }).reduce<unknown>(
      (value) => ({ nested: value }),
      null,
    );
    const corpus = [
      null,
      42,
      [],
      { nested: deep },
      { text: "x".repeat(33_000) },
      { roomId: 7, appId: 7, maxPlayers: "bad", type: 7 },
    ];
    const spoof = {
      roomId: healthy.roomId,
      controllerId: "honest-player",
      resumeCapabilityToken: "wrong-resume-capability-000000000000",
      input: { vector: { x: { valueOf: null, toString: null }, y: null } },
      state: { message: "spoofed" },
      data: { score: -100 },
      privateState: {},
      storeDomain: "default",
      revision: 99,
      actionName: "move",
      payload: { step: -100 },
      soundId: "spoofed",
      command: "pause",
    };
    for (const event of Object.keys(clientSocketEvents)) {
      now += SOCKET_INGRESS_WINDOW_MS;
      const attacker = await connect();
      now += SOCKET_INGRESS_WINDOW_MS;
      const socketId = attacker.id!;
      for (const payload of corpus) {
        const response = await acknowledge(attacker, event, payload);
        expect(response.code ?? response.reason, event).toMatch(
          /invalid_payload|invalid_request/i,
        );
      }
      // Scalar acknowledgement arguments and missing required callbacks cannot reach a handler.
      attacker.emit(event, null, 17);
      attacker.emit(event, null);
      attacker.emit(event, spoof, () => {});
      await barrier(attacker);
      const disconnected = nextEvent(attacker, "disconnect");
      const reason = nextEvent(attacker, "server:error");
      for (let index = 0; index < SOCKET_INGRESS_ABUSE_LIMIT; index += 1) {
        attacker.emit(event, null);
      }
      expect((await reason)[0], event).toMatchObject({
        code: ErrorCode.SOCKET_ABUSE,
      });
      await disconnected;
      expect(
        logs.filter(
          (line) =>
            line.includes('"event":"socket.ingress_rejected"') &&
            line.includes(socketId),
        ),
      ).toHaveLength(1);
    }
    expect(inputs).toBe(1);
    expect(actions).toBe(1);
    expect(rooms.getRoom(healthy.roomId)?.masterHostSocketId).toBe(host.id);
    await play(2);
    for (const [event, payload] of [
      [
        "controller:input",
        { roomId: attacked.roomId, controllerId: "imposter", input: {} },
      ],
      [
        "host:state_sync",
        {
          roomId: attacked.roomId,
          data: {},
          storeDomain: "default",
          revision: 1,
        },
      ],
      ["host:system", { roomId: attacked.roomId, command: "pause" }],
    ] as const) {
      now += SOCKET_INGRESS_WINDOW_MS;
      const attacker = await connect();
      const lane = clientSocketEvents[event].lane;
      const disconnected = nextEvent(attacker, "disconnect");
      const reason = nextEvent(attacker, "server:error");
      const socketId = attacker.id!;
      for (
        let index = 0;
        index < SOCKET_PAYLOAD_BOUNDS[lane].events;
        index += 1
      ) {
        attacker.emit(event, payload);
      }
      expect(await acknowledge(attacker, event, payload)).toMatchObject({
        code: ErrorCode.RATE_LIMITED,
      });
      for (let index = 1; index < SOCKET_INGRESS_ABUSE_LIMIT; index += 1) {
        attacker.emit(event, payload);
      }
      await play(3);
      expect((await reason)[0]).toMatchObject({ code: ErrorCode.SOCKET_ABUSE });
      await disconnected;
      expect(
        logs.filter(
          (line) =>
            line.includes('"event":"socket.ingress_rejected"') &&
            line.includes(socketId),
        ),
      ).toHaveLength(1);
      await play(4);
    }
    // Engine.IO rejects frames beyond the explicit wire cap before parsing them.
    const oversized = await connect();
    const disconnected = nextEvent(oversized, "disconnect");
    oversized.emit("controller:input", {
      text: "x".repeat(SOCKET_MAX_HTTP_BUFFER_SIZE),
    });
    await disconnected;
    expect((await fetch(`http://127.0.0.1:${port}/health`)).ok).toBe(true);
    await play(5);
    expect(inputs).toBe(9);
    expect(actions).toBe(9);
  } finally {
    for (const socket of sockets) socket.disconnect();
    await runtime.stop();
  }
});

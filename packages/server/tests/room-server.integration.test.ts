import type { AirJamInput } from "@air-jam/sdk/core";
import {
  createWebSocketConnector,
  HostRoomSession,
  PhoneRoomSession,
} from "@air-jam/sdk/room-session";
import { afterEach, describe, expect, it } from "vitest";
import WebSocket from "ws";
import { loadServerEnv } from "../src/env/server-env.js";
import { createServerLogger } from "../src/logging/logger.js";
import {
  createRoomServer,
  type RoomServerRuntime,
} from "../src/room-server/room-server.js";

const controls: AirJamInput = {
  jump: { kind: "button", name: "jump", mode: "pressed" },
};

const until = async (condition: () => boolean, deadlineMs = 5_000) => {
  const deadline = Date.now() + deadlineMs;
  while (!condition()) {
    if (Date.now() > deadline) throw new Error("The condition never held.");
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
};

let server: RoomServerRuntime | null = null;
const start = async () => {
  server = createRoomServer({
    envConfig: loadServerEnv({ AIR_JAM_ALLOWED_ORIGINS: "https://game.test" }),
    devLogCollector: false,
    logger: createServerLogger(undefined, undefined, null, { level: "silent" }),
    heartbeat: { intervalMs: 50, silenceMs: 200 },
  });
  const port = await server.start(0);
  return { server, origin: `http://127.0.0.1:${port}` };
};

afterEach(async () => {
  await server?.stop();
  server = null;
});

describe("node room server", () => {
  it("relays a phone's input and the host's state over real sockets", async () => {
    const { origin } = await start();
    const connector = createWebSocketConnector(origin);
    const host = new HostRoomSession({
      connector,
      key: "host-key-00000001",
      seats: 2,
      input: controls,
    });
    const presses: number[] = [];
    host.on("input", ({ state }) => {
      const jump = state.jump;
      if (typeof jump === "object" && "presses" in jump)
        presses.push(jump.presses);
    });
    await until(() => host.status.phase === "open");
    host.publish("game", { round: 1 });
    const phone = new PhoneRoomSession({
      connector,
      key: "phone-key-0000001",
      code: host.code ?? "",
      input: controls,
    });
    await until(() => phone.channel("game") !== undefined);
    phone.sendInput({ jump: { down: true, presses: 1 } });
    await until(() => presses.includes(1));
    phone.close();
    host.close();
  });

  it("refuses other origins and unknown paths before any room sees them", async () => {
    const { origin } = await start();
    const statusOf = (path: string, headers: Record<string, string>) =>
      new Promise<number>((resolve) => {
        const socket = new WebSocket(`${origin.replace("http", "ws")}${path}`, {
          headers,
        });
        socket.on("unexpected-response", (_request, response) =>
          resolve(response.statusCode ?? 0),
        );
        socket.on("open", () => resolve(101));
      });
    expect(
      await Promise.all([
        statusOf("/v1/host", { origin: "https://elsewhere.test" }),
        statusOf("/socket.io/", {}),
        statusOf("/v1/host", { origin: "https://game.test" }),
      ]),
    ).toEqual([403, 404, 101]);
  });

  it("drops a socket that stops answering pings and tells its room", async () => {
    const { origin, server } = await start();
    const silent = new WebSocket(`${origin.replace("http", "ws")}/v1/host`, {
      autoPong: false,
    });
    silent.on("open", () =>
      silent.send(
        JSON.stringify({
          type: "hello",
          key: "host-key-00000001",
          sdk: "test",
          seats: 2,
        }),
      ),
    );
    await until(() => server.rooms.describe().length === 1);
    await until(() => server.rooms.describe()[0]?.host.connected === false);
  });

  it("closes every device as restarting when it stops, and they try to come back", async () => {
    const { origin, server } = await start();
    const host = new HostRoomSession({
      connector: createWebSocketConnector(origin),
      key: "host-key-00000001",
      seats: 2,
    });
    await until(() => host.status.phase === "open");
    await server.stop();
    await until(() => host.status.phase === "reconnecting");
    host.close();
  });
});

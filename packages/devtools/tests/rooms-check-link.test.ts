import { createServer, type IncomingMessage, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import type { Duplex } from "node:stream";
import { afterEach, expect, it } from "vitest";
import { WebSocketServer } from "ws";
import { ConnectionPacer } from "../src/rooms-check-fleet";
import { createCheckConnector } from "../src/rooms-check-link";
import type { LinkProblem } from "../src/rooms-check-protocol";

let server: Server | null = null;

afterEach(() => {
  server?.closeAllConnections();
  server?.close();
  server = null;
});

const listen = async (
  upgrade: (request: IncomingMessage, socket: Duplex, head: Buffer) => void,
): Promise<string> => {
  const listening = createServer();
  server = listening;
  listening.on("upgrade", upgrade);
  await new Promise<void>((resolve) =>
    listening.listen(0, "127.0.0.1", resolve),
  );
  return `http://127.0.0.1:${(listening.address() as AddressInfo).port}`;
};

const connect = (url: string, origin?: string) =>
  new Promise<{ problem: LinkProblem | null; code: number }>((resolve) => {
    let problem: LinkProblem | null = null;
    createCheckConnector({
      url,
      origin,
      dial: async () => {},
      onProblem: (reported) => {
        problem = reported;
      },
    })(
      { role: "phone", code: "ABCD" },
      {
        open: () => {},
        message: () => {},
        close: (code) => resolve({ problem, code }),
      },
    );
  });

it("names the HTTP status of a refused upgrade", async () => {
  const url = await listen((_request, socket) =>
    socket.end("HTTP/1.1 429 Too Many Requests\r\nContent-Length: 0\r\n\r\n"),
  );
  expect(await connect(url)).toEqual({
    problem: { kind: "refused", status: 429 },
    code: 1006,
  });
});

it("sends the page origin and names the close code of a connection the server ends", async () => {
  const sockets = new WebSocketServer({ noServer: true });
  const origins: Array<string | undefined> = [];
  const url = await listen((request, socket, head) => {
    origins.push(request.headers.origin);
    sockets.handleUpgrade(request, socket, head, (webSocket) =>
      webSocket.close(4101),
    );
  });
  expect(await connect(url, "https://play.example")).toEqual({
    problem: { kind: "closed", code: 4101, reason: "try-later" },
    code: 4101,
  });
  expect(origins).toEqual(["https://play.example"]);
});

it("paces opens so that no minute holds more than the allowance", () => {
  const pacer = new ConnectionPacer(120, () => 0);
  const slots = Array.from({ length: 500 }, () => pacer.reserve());
  const busiestMinute = Math.max(
    ...slots.map(
      (start) =>
        slots.filter((slot) => slot >= start && slot <= start + 60_000).length,
    ),
  );
  expect(busiestMinute).toBeLessThanOrEqual(120);
  expect(busiestMinute).toBeGreaterThanOrEqual(119);
});

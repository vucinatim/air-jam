import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { EventEmitter, once } from "node:events";
import { access, stat } from "node:fs/promises";
import http from "node:http";
import net, { type Socket } from "node:net";
import { dirname } from "node:path";
import test, { type TestContext } from "node:test";
import { chromium, type BrowserServer } from "playwright-core";
import {
  startReleaseBrowserWorker,
  type ReleaseBrowserWorkerHandle,
} from "./index";
import { BROWSER_LIFETIME_MS } from "./isolated-browser";

const TOKEN = "worker-fixture-token-0123456789abcdef";
type LaunchOptions = NonNullable<Parameters<typeof chromium.launchServer>[0]>;

const eventually = async (condition: () => boolean) => {
  const deadline = Date.now() + 2_000;
  while (!condition()) {
    assert.ok(Date.now() < deadline, "Lifecycle operation did not settle");
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
};

/** Only the browser process is mocked; worker HTTP, WS forwarding, egress
 * listeners and private temporary-directory ownership execute normally.
 * This is not proof of the Linux wrapper or Chromium namespace containment. */
const fixture = async (
  t: TestContext,
  connectFails = false,
  halfOpenBrowser = false,
) => {
  const platform = Object.getOwnPropertyDescriptor(process, "platform")!;
  Object.defineProperty(process, "platform", { value: "linux" });
  t.mock.method(
    process as NodeJS.Process & { getuid: () => number },
    "getuid",
    () => 1_000,
  );
  const launched: Array<{
    options: LaunchOptions;
    server: BrowserServer;
    closed: number;
    headers: http.IncomingHttpHeaders[];
    paths: string[];
  }> = [];
  const clients = new Set<Socket>();
  let worker: ReleaseBrowserWorkerHandle | undefined;
  const healthVisits: string[] = [];
  let healthBrowserClosed = 0;
  t.after(async () => {
    try {
      for (const client of clients) client.destroy();
      await worker?.close();
      for (const item of launched) await item.server.close();
      for (const item of launched) {
        await assert.rejects(access(item.options.env!.HOME!));
      }
    } finally {
      t.mock.restoreAll();
      Object.defineProperty(process, "platform", platform);
    }
  });
  t.mock.method(chromium, "launchServer", async (options: LaunchOptions) => {
    const endpoint = http.createServer();
    const sockets = new Set<Socket>();
    const emitter = new EventEmitter();
    const child = { exitCode: null as number | null, signalCode: null };
    const item = {
      options,
      server: undefined as unknown as BrowserServer,
      closed: 0,
      headers: [] as http.IncomingHttpHeaders[],
      paths: [] as string[],
    };
    endpoint.on("connection", (socket) => {
      sockets.add(socket);
      socket.on("error", () => {});
      socket.once("close", () => sockets.delete(socket));
    });
    endpoint.on("upgrade", (request, socket) => {
      if (!halfOpenBrowser) socket.on("end", () => socket.destroy());
      item.headers.push(request.headers);
      item.paths.push(request.url!);
      const accept = createHash("sha1")
        .update(
          `${request.headers["sec-websocket-key"]}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`,
        )
        .digest("base64");
      socket.write(
        `HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${accept}\r\n\r\n`,
      );
    });
    endpoint.listen(0, "127.0.0.1");
    await once(endpoint, "listening");
    const port = (endpoint.address() as net.AddressInfo).port;
    let closing: Promise<void> | undefined;
    const close = () => {
      if (closing) return closing;
      item.closed++;
      child.exitCode = 0;
      for (const socket of sockets) socket.destroy();
      closing = new Promise<void>((resolve) => endpoint.close(() => resolve()));
      emitter.emit("close");
      return closing;
    };
    const browserId = launched.length;
    item.server = Object.assign(emitter, {
      wsEndpoint: () => `ws://127.0.0.1:${port}/owned-browser-${browserId}`,
      process: () => child,
      close,
      kill: close,
    }) as unknown as BrowserServer;
    launched.push(item);
    assert.equal((await stat(options.env!.HOME!)).mode & 0o777, 0o700);
    assert.ok((await stat(options.env!.AIRJAM_EGRESS_SOCKET!)).isSocket());
    return item.server;
  });
  const connect = t.mock.method(chromium, "connect", async () => {
    if (connectFails) throw new Error("Fixture browser protocol unavailable");
    return {
      newPage: async () => ({
        goto: async (url: string) => {
          healthVisits.push(url);
        },
      }),
      close: async () => {
        healthBrowserClosed++;
      },
    };
  });
  // Port zero is deliberately not a valid deployed configuration.
  const reservation = net.createServer();
  reservation.listen(0, "127.0.0.1");
  await once(reservation, "listening");
  const port = (reservation.address() as net.AddressInfo).port;
  await new Promise<void>((resolve) => reservation.close(() => resolve()));
  const env = {
    PORT: String(port),
    AIRJAM_BROWSER_WORKER_HOST: "127.0.0.1",
    AIRJAM_BROWSER_WORKER_ACCESS_TOKEN: TOKEN,
    DATABASE_URL: "must-not-reach-browser",
    RAILWAY_TOKEN: "must-not-reach-browser-either",
  };
  const start = async () => {
    worker = await startReleaseBrowserWorker(env);
    return worker;
  };
  const upgrade = (
    path = "/ws",
    authorization: string | undefined = `Bearer ${TOKEN}`,
  ) =>
    new Promise<{ status: number; socket?: Socket }>((resolve, reject) => {
      const request = http.request({
        host: "127.0.0.1",
        port,
        path,
        headers: {
          Connection: "Upgrade",
          Upgrade: "websocket",
          "Sec-WebSocket-Version": "13",
          "Sec-WebSocket-Key": "dGhlIHNhbXBsZSBub25jZQ==",
          ...(authorization ? { Authorization: authorization } : {}),
        },
      });
      request.on("error", reject);
      request.setTimeout(2_000, () =>
        request.destroy(new Error("Fixture upgrade timed out")),
      );
      request.on("upgrade", (response, socket) => {
        clients.add(socket);
        socket.on("error", () => {});
        socket.once("close", () => clients.delete(socket));
        resolve({ status: response.statusCode!, socket });
      });
      request.on("response", (response) => {
        response.resume();
        response.once("end", () => resolve({ status: response.statusCode! }));
      });
      request.end();
    });
  return {
    start,
    launched,
    connect,
    upgrade,
    healthVisits,
    healthBrowserClosed: () => healthBrowserClosed,
    url: `http://127.0.0.1:${port}`,
  };
};

test(
  "worker verifies a usable browser before listening and confines its launch environment",
  { timeout: 10_000 },
  async (t) => {
    const f = await fixture(t);
    await f.start();
    assert.equal(f.connect.mock.callCount(), 1);
    assert.deepEqual(f.healthVisits, ["about:blank"]);
    assert.equal(f.healthBrowserClosed(), 1);
    assert.equal(f.launched[0]!.closed, 1);
    const options = f.launched[0]!.options;
    assert.equal(
      options.executablePath,
      "/usr/local/bin/airjam-chromium-isolated",
    );
    assert.equal(options.chromiumSandbox, true);
    assert.equal(options.host, "127.0.0.1");
    assert.equal(options.port, 0);
    assert.equal(options.timeout, 15_000);
    assert.equal(
      options.proxy?.server,
      `http://127.0.0.1:${options.env!.AIRJAM_EGRESS_PORT}`,
    );
    assert.equal(options.proxy?.bypass, "<-loopback>");
    assert.deepEqual(Object.keys(options.env!).sort(), [
      "AIRJAM_CHROMIUM_EXECUTABLE",
      "AIRJAM_EGRESS_PORT",
      "AIRJAM_EGRESS_SOCKET",
      "HOME",
      "LANG",
      "PATH",
    ]);
    assert.equal(
      dirname(options.env!.AIRJAM_EGRESS_SOCKET!),
      options.env!.HOME,
    );
    const health = await fetch(`${f.url}/health`);
    assert.equal(health.status, 200);
    assert.deepEqual(await health.json(), {
      ok: true,
      service: "air-jam-release-browser-worker",
      activeCaptures: 0,
      capacity: 2,
    });
    assert.equal(
      f.launched.length,
      1,
      "Healthy cached probe does not launch another browser",
    );
  },
);

test(
  "HTTP and WebSocket entrypoints authenticate and accept only the exact public WS path",
  { timeout: 10_000 },
  async (t) => {
    const f = await fixture(t);
    await f.start();
    assert.equal((await fetch(f.url)).status, 401);
    assert.equal(
      (
        await fetch(f.url, {
          headers: { Authorization: `Bearer ${TOKEN} extra` },
        })
      ).status,
      401,
    );
    const headers = { Authorization: `Bearer ${TOKEN}` };
    assert.equal((await fetch(f.url, { headers })).status, 200);
    assert.equal((await fetch(`${f.url}/unknown`, { headers })).status, 404);
    assert.equal((await f.upgrade("/ws", "")).status, 401);
    assert.equal((await f.upgrade("/ws", "Bearer incorrect")).status, 401);
    for (const path of [
      "/",
      "/ws/",
      "/ws?token=anything",
      "/owned-browser-0",
    ]) {
      assert.equal((await f.upgrade(path)).status, 404);
    }
    assert.equal(
      f.launched.length,
      1,
      "Rejected requests do not launch capture processes",
    );
  },
);

test(
  "two WS clients own separate browsers; a third is refused, disconnect frees capacity and shutdown cleans all resources",
  { timeout: 10_000 },
  async (t) => {
    const f = await fixture(t);
    const worker = await f.start();
    const first = await f.upgrade();
    const second = await f.upgrade();
    assert.equal(first.status, 101);
    assert.equal(second.status, 101);
    assert.equal((await f.upgrade()).status, 503);
    assert.equal(f.launched.length, 3);
    for (const [index, capture] of f.launched.slice(1).entries()) {
      assert.equal(capture.headers[0]!.authorization, undefined);
      assert.deepEqual(capture.paths, [`/owned-browser-${index + 1}`]);
    }
    assert.equal(
      (await (await fetch(`${f.url}/health`)).json()).activeCaptures,
      2,
    );
    first.socket!.destroy();
    await eventually(() => f.launched[1]!.closed === 1);
    // Directory removal completes before the admission slot is released.
    while (
      (await (await fetch(`${f.url}/health`)).json()).activeCaptures !== 1
    ) {
      await new Promise((resolve) => setTimeout(resolve, 5));
    }
    const replacement = await f.upgrade();
    assert.equal(replacement.status, 101);
    const secondClosed = once(second.socket!, "close");
    const replacementClosed = once(replacement.socket!, "close");
    await Promise.all([worker.close(), worker.close()]);
    await Promise.all([secondClosed, replacementClosed]);
    assert.ok(f.launched.every((capture) => capture.closed === 1));
    for (const capture of f.launched)
      await assert.rejects(access(capture.options.env!.HOME!));
  },
);

test(
  "startup fails closed when Chromium protocol health fails and removes the owned browser and egress directory",
  { timeout: 10_000 },
  async (t) => {
    const f = await fixture(t, true);
    await assert.rejects(f.start(), /Isolated browser health check failed/);
    assert.equal(f.connect.mock.callCount(), 1);
    assert.equal(f.launched.length, 1);
    assert.equal(f.launched[0]!.closed, 1);
    assert.deepEqual(f.healthVisits, []);
    await assert.rejects(access(f.launched[0]!.options.env!.HOME!));
    await assert.rejects(fetch(`${f.url}/health`));
  },
);

test(
  "client FIN reclaims its browser even when the internal WS peer remains half-open",
  { timeout: 10_000 },
  async (t) => {
    const f = await fixture(t, false, true);
    await f.start();
    const client = await f.upgrade();
    assert.equal(client.status, 101);
    client.socket!.destroy();
    await eventually(() => f.launched[1]!.closed === 1);
  },
);

test(
  "the fixed capture deadline closes an active browser and its public transport",
  { timeout: 10_000 },
  async (t) => {
    const f = await fixture(t);
    await f.start();
    t.mock.timers.enable({ apis: ["setTimeout"] });
    try {
      const client = await f.upgrade();
      assert.equal(client.status, 101);
      const closed = once(client.socket!, "close");
      t.mock.timers.tick(BROWSER_LIFETIME_MS);
      await closed;
      assert.equal(f.launched[1]!.closed, 1);
    } finally {
      t.mock.timers.reset();
    }
  },
);

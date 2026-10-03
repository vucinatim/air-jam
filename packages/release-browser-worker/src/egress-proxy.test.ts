import assert from "node:assert/strict";
import { createHash, createPublicKey, X509Certificate } from "node:crypto";
import dns from "node:dns/promises";
import { once } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import http from "node:http";
import https from "node:https";
import net, { type Socket } from "node:net";
import os from "node:os";
import path from "node:path";
import test, { afterEach, mock, type TestContext } from "node:test";
import tls from "node:tls";
import { chromium } from "playwright-core";
import {
  createBrowserEgressBudget,
  startBrowserEgressProxy,
} from "./egress-proxy";
import { fixtureTlsCertificate, fixtureTlsKey } from "./fixtures/tls";

const actualConnect = net.connect.bind(net);
afterEach(() => mock.restoreAll());

const fixture = async (
  t: TestContext,
  onHttp?: http.RequestListener,
  encrypted: boolean | https.ServerOptions = false,
) => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "airjam-egress-"));
  const sockets = new Set<Socket>();
  const server = onHttp
    ? encrypted
      ? https.createServer(
          {
            key: fixtureTlsKey,
            cert: fixtureTlsCertificate,
            ...(typeof encrypted === "object" ? encrypted : {}),
          },
          onHttp,
        )
      : http.createServer(onHttp)
    : net.createServer((socket) => socket.pipe(socket));
  server.on("connection", (socket) => {
    sockets.add(socket);
    socket.on("error", () => {});
    socket.on("close", () => sockets.delete(socket));
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const upstreamPort = (server.address() as net.AddressInfo).port;
  const dialed: net.NetConnectOpts[] = [];
  let proxyPort = 0;
  const resolved: string[] = [];
  const ipv4 = mock.method(
    dns.Resolver.prototype,
    "resolve4",
    async (hostname: string) => {
      resolved.push(hostname);
      return ["93.184.216.34"];
    },
  );
  const ipv6 = mock.method(
    dns.Resolver.prototype,
    "resolve6",
    async (): Promise<string[]> => [],
  );
  // The only dial seam redirects an already policy-approved numeric address to
  // our own echo/HTTP fixture. Never connect to real private or public services.
  const dial = mock.method(net, "connect", (options: net.NetConnectOpts) => {
    // A Playwright driver's own connection to this proxy is real local IO,
    // not an egress dial. Keep it distinct from the policy-vetted upstream seam.
    if (
      "port" in options &&
      Number(options.port) === proxyPort &&
      options.host === "127.0.0.1"
    ) {
      return actualConnect(options);
    }
    dialed.push(options);
    return actualConnect({ host: "127.0.0.1", port: upstreamPort });
  });
  let exhausted = 0;
  const socketPath = path.join(dir, "proxy.sock");
  const proxy = await startBrowserEgressProxy({
    socketPath,
    onExhausted: () => {
      exhausted++;
    },
  });
  proxyPort = proxy.port;
  const clients = new Set<Socket>();
  const connect = (unix = false) => {
    const socket = actualConnect(
      unix ? { path: socketPath } : { host: "127.0.0.1", port: proxy.port },
    );
    clients.add(socket);
    socket.on("error", () => {});
    socket.on("close", () => clients.delete(socket));
    socket.setTimeout(3000, () => socket.destroy());
    return socket;
  };
  t.after(async () => {
    for (const socket of clients) socket.destroy();
    await proxy.close();
    for (const socket of sockets) socket.destroy();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await rm(dir, { recursive: true, force: true });
  });
  return {
    proxy,
    connect,
    ipv4,
    ipv6,
    dial,
    dialed,
    resolved,
    exhausted: () => exhausted,
    sockets,
    server,
  };
};

const exchange = async (socket: Socket, request: string): Promise<string> => {
  let result = "";
  socket.on("data", (chunk) => {
    result += chunk.toString();
  });
  const closed = once(socket, "close").catch(() => []);
  socket.once("connect", () => socket.write(request));
  await closed;
  return result;
};

const until = (socket: Socket, match: string): Promise<string> =>
  new Promise((resolve, reject) => {
    let result = "";
    const cleanup = () => {
      socket.off("data", data);
      socket.off("close", closed);
    };
    const data = (chunk: Buffer) => {
      result += chunk.toString();
      if (result.includes(match)) {
        cleanup();
        resolve(result);
      }
    };
    const closed = () => {
      cleanup();
      reject(new Error("Fixture socket closed early"));
    };
    socket.on("data", data);
    socket.once("close", closed);
  });

const connectTls = async (
  connect: () => Socket,
  { servername = "public.example", trustFixture = true } = {},
) => {
  const socket = connect();
  const connected = until(socket, "\r\n\r\n");
  socket.once("connect", () =>
    socket.write(
      "CONNECT public.example:443 HTTP/1.1\r\nHost: public.example:443\r\n\r\n",
    ),
  );
  assert.match(await connected, /^HTTP\/1.1 200 Connection Established/);
  const secure = tls.connect({
    socket,
    servername,
    rejectUnauthorized: true,
    ...(trustFixture ? { ca: fixtureTlsCertificate } : {}),
  });
  // Keep expected negative handshakes from leaking a socket on assertion failure.
  try {
    await once(secure, "secureConnect");
    return secure;
  } catch (error) {
    secure.destroy();
    throw error;
  }
};

test("HTTPS keeps end-to-end certificate identity and SNI through pinned CONNECT", async (t) => {
  const serverNames: string[] = [];
  const f = await fixture(
    t,
    (req, res) => {
      assert.equal(req.url, "/game");
      assert.equal(req.headers.host, "public.example");
      assert.equal(req.headers["proxy-authorization"], undefined);
      res.end("encrypted-game-asset");
    },
    {
      SNICallback: (servername, callback) => {
        serverNames.push(servername);
        callback(
          null,
          tls.createSecureContext({
            key: fixtureTlsKey,
            cert: fixtureTlsCertificate,
          }),
        );
      },
    },
  );
  const secure = await connectTls(f.connect);
  try {
    assert.equal(secure.authorized, true);
    assert.equal(
      secure.getPeerCertificate().fingerprint256,
      new X509Certificate(fixtureTlsCertificate).fingerprint256,
    );
    const response = until(secure, "encrypted-game-asset");
    secure.write(
      "GET /game HTTP/1.1\r\nHost: public.example\r\nConnection: close\r\n\r\n",
    );
    assert.match(await response, /200 OK/);
    assert.deepEqual(serverNames, ["public.example"]);
    assert.deepEqual(f.dialed, [
      { host: "93.184.216.34", port: 443, family: 4 },
    ]);
  } finally {
    secure.destroy();
  }
});

test("CONNECT does not bypass certificate trust or hostname verification", async (t) => {
  const f = await fixture(t, (_req, res) => res.end("unreachable"), true);
  f.server.on("tlsClientError", () => {});
  await assert.rejects(connectTls(f.connect, { trustFixture: false }), {
    code: "DEPTH_ZERO_SELF_SIGNED_CERT",
  });
  await assert.rejects(connectTls(f.connect, { servername: "wrong.example" }), {
    code: "ERR_TLS_CERT_ALTNAME_INVALID",
  });
});

test(
  "real Chromium loads HTTPS and exchanges secure WebSocket messages through the proxy",
  {
    skip: process.env.AIR_JAM_TEST_RELEASE_CAPTURE_BROWSER !== "1",
    timeout: 20_000,
  },
  async (t) => {
    const f = await fixture(
      t,
      (req, res) => {
        if (req.url !== "/game") {
          res.writeHead(404);
          res.end();
          return;
        }
        res.writeHead(200, { "content-type": "text/html" });
        res.end(
          "<!doctype html><title>Encrypted fixture</title><p>Game fixture</p>",
        );
      },
      true,
    );
    f.server.on("tlsClientError", () => {});
    let receivedText = "";
    f.server.on("upgrade", (request: http.IncomingMessage, socket: Socket) => {
      assert.equal(request.url, "/live");
      assert.equal(request.headers["sec-websocket-protocol"], "airjam.fixture");
      const accept = createHash("sha1")
        .update(
          `${request.headers["sec-websocket-key"]}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`,
        )
        .digest("base64");
      socket.write(
        `HTTP/1.1 101 Switching Protocols\r\nConnection: Upgrade\r\nUpgrade: websocket\r\nSec-WebSocket-Accept: ${accept}\r\nSec-WebSocket-Protocol: airjam.fixture\r\n\r\n`,
      );
      // This fixture accepts exactly one short, masked text frame, then replies.
      // It is intentionally not a general WebSocket server implementation.
      let pending = Buffer.alloc(0);
      const receive = (chunk: Buffer) => {
        pending = Buffer.concat([pending, chunk]);
        if (pending.length < 2) return;
        assert.equal(pending[0], 0x81);
        assert.equal(pending[1] & 0x80, 0x80);
        const length = pending[1] & 0x7f;
        assert.ok(length <= 125);
        if (pending.length < 6 + length) return;
        receivedText = Buffer.from(
          pending
            .subarray(6, 6 + length)
            .map((byte, index) => byte ^ pending[2 + (index % 4)]),
        ).toString();
        socket.off("data", receive);
        const reply = Buffer.from(`received:${receivedText}`);
        socket.write(Buffer.concat([Buffer.from([0x81, reply.length]), reply]));
      };
      socket.on("data", receive);
    });
    // Trust only this owned test certificate in this one child process. Production
    // has no certificate override; the tests above exercise strict TLS validation.
    const spki = createPublicKey(fixtureTlsCertificate).export({
      type: "spki",
      format: "der",
    });
    const fingerprint = createHash("sha256").update(spki).digest("base64");
    const browser = await chromium.launch({
      headless: true,
      timeout: 10_000,
      proxy: {
        server: `http://127.0.0.1:${f.proxy.port}`,
        bypass: "<-loopback>",
      },
      args: [`--ignore-certificate-errors-spki-list=${fingerprint}`],
    });
    try {
      const page = await browser.newPage();
      await page.goto("https://public.example/game", { timeout: 5_000 });
      assert.equal(await page.title(), "Encrypted fixture");
      const reply = await page.evaluate(
        () =>
          new Promise<string>((resolve, reject) => {
            const ws = new WebSocket(
              "wss://public.example/live",
              "airjam.fixture",
            );
            const timer = setTimeout(() => {
              ws.close();
              reject(new Error("WSS fixture timed out"));
            }, 5_000);
            ws.onopen = () => ws.send("hello");
            ws.onmessage = (event) => {
              clearTimeout(timer);
              resolve(`${ws.protocol}:${event.data}`);
              ws.close();
            };
            ws.onerror = () => {
              clearTimeout(timer);
              reject(new Error("WSS fixture failed"));
            };
          }),
      );
      assert.equal(reply, "airjam.fixture:received:hello");
      assert.equal(receivedText, "hello");
    } finally {
      await browser.close();
    }
  },
);

test(
  "Playwright Node-side inspection fetches inherit the same public-only browser proxy",
  {
    skip: process.env.AIR_JAM_TEST_RELEASE_CAPTURE_BROWSER !== "1",
    timeout: 15_000,
  },
  async (t) => {
    const observed: {
      path: string | undefined;
      token: string | string[] | undefined;
    }[] = [];
    const f = await fixture(t, (req, res) => {
      observed.push({
        path: req.url,
        token: req.headers["x-fixture-inspection"],
      });
      res.writeHead(200, { "content-type": "text/html" });
      res.end("<!doctype html><title>Inspection through proxy</title>");
    });
    const browser = await chromium.launch({
      headless: true,
      timeout: 10_000,
      proxy: {
        server: `http://127.0.0.1:${f.proxy.port}`,
        bypass: "<-loopback>",
      },
    });
    try {
      const context = await browser.newContext({ serviceWorkers: "block" });
      await context.route("http://public.example/inspection", async (route) => {
        const response = await route.fetch({
          headers: { "x-fixture-inspection": "owned-test-token" },
          maxRedirects: 0,
          maxRetries: 0,
          timeout: 3_000,
        });
        try {
          await route.fulfill({ response });
        } finally {
          await response.dispose();
        }
      });
      const page = await context.newPage();
      await page.goto("http://public.example/inspection", { timeout: 5_000 });
      assert.equal(await page.title(), "Inspection through proxy");
      assert.ok(
        observed.some(
          (entry) =>
            entry.path === "/inspection" && entry.token === "owned-test-token",
        ),
      );
      const address = f.server.address();
      assert.ok(address && typeof address !== "string");
      // Even the driver's API-request path must use policy. The forbidden URL is
      // our own loopback listener: a bypass would fail the test, never probe others.
      const denied = await context.request.get(
        `http://127.0.0.1:${address.port}/must-not-arrive`,
        { timeout: 3_000 },
      );
      assert.equal(denied.status(), 403);
      await denied.dispose();
      assert.equal(
        observed.some((entry) => entry.path === "/must-not-arrive"),
        false,
      );
      assert.ok(f.dialed.length > 0);
      assert.ok(
        f.dialed.every(
          (entry) => (entry as net.TcpNetConnectOpts).host === "93.184.216.34",
        ),
      );
    } finally {
      await browser.close();
    }
  },
);

test("streams HTTP via a vetted numeric dial and strips hop/proxy headers on both listeners", async (t) => {
  const seen: http.IncomingHttpHeaders[] = [];
  const f = await fixture(t, (req, res) => {
    seen.push(req.headers);
    assert.equal(req.url, "/game?q=1");
    res.writeHead(200, {
      connection: "close, x-response-private",
      "x-response-private": "removed",
      "content-type": "text/plain",
    });
    req.pipe(res);
  });
  for (const unix of [false, true]) {
    const result = await exchange(
      f.connect(unix),
      "POST http://public.example/game?q=1 HTTP/1.1\r\nHost: attacker.invalid\r\nConnection: close, x-private\r\nX-Private: removed\r\nProxy-Authorization: Bearer private-token\r\nContent-Length: 5\r\n\r\nhello",
    );
    assert.match(result, /200 OK/);
    assert.match(result, /hello/);
    assert.doesNotMatch(result, /x-response-private/i);
  }
  assert.equal(seen.length, 2);
  for (const headers of seen) {
    assert.equal(headers.host, "public.example");
    assert.equal(headers["proxy-authorization"], undefined);
    assert.equal(headers["x-private"], undefined);
  }
  assert.deepEqual(f.resolved, ["public.example", "public.example"]);
  for (const dial of f.dialed)
    assert.equal((dial as net.TcpNetConnectOpts).host, "93.184.216.34");
});

test("CONNECT preserves opaque tunnel bytes, including initial head bytes", async (t) => {
  const f = await fixture(t);
  const socket = f.connect();
  const response = until(socket, "opaque-tls-bytes");
  socket.once("connect", () =>
    socket.write(
      "CONNECT public.example:443 HTTP/1.1\r\nHost: public.example:443\r\n\r\nopaque-tls-bytes",
    ),
  );
  assert.match(await response, /200 Connection Established/);
  assert.equal((f.dialed[0] as net.TcpNetConnectOpts).port, 443);
  socket.destroy();
});

test("streams ordinary public WebSocket upgrades without forwarding proxy credentials", async (t) => {
  const f = await fixture(t, (_req, res) => {
    res.writeHead(426);
    res.end();
  });
  f.server.on(
    "upgrade",
    (request: http.IncomingMessage, socket: Socket, head: Buffer) => {
      assert.equal(request.url, "/live");
      assert.equal(request.headers.host, "public.example");
      assert.equal(request.headers["proxy-authorization"], undefined);
      socket.write(
        "HTTP/1.1 101 Switching Protocols\r\nConnection: Upgrade\r\nUpgrade: websocket\r\nSec-WebSocket-Accept: fixture-accept\r\n\r\nserver-frame",
      );
      if (head.length) socket.write(head);
      socket.pipe(socket);
    },
  );
  for (const scheme of ["http", "ws"]) {
    const socket = f.connect();
    const response = until(socket, "client-frame");
    socket.once("connect", () =>
      socket.write(
        `GET ${scheme}://public.example/live HTTP/1.1\r\nHost: ignored\r\nConnection: Upgrade\r\nUpgrade: websocket\r\nProxy-Authorization: Bearer private-token\r\nSec-WebSocket-Key: fixture-key\r\n\r\nclient-frame`,
      ),
    );
    const result = await response;
    assert.match(result, /101 Switching Protocols/);
    assert.match(result, /server-frame/);
    assert.match(result, /fixture-accept/);
    socket.destroy();
  }
  assert.equal(f.dialed.length, 2);
});

test("rejects malformed targets and private numeric addresses without DNS or dialing", async (t) => {
  const f = await fixture(t);
  for (const target of [
    "/relative",
    "http:///public.example/",
    "https://public.example/",
    "http://user:secret@public.example/",
    "http://@public.example/",
    "http://public.example/#fragment",
    "http://127.0.0.1/",
    "http://2130706433/",
    "http://[::ffff:127.0.0.1]/",
    "http://169.254.169.254/latest/meta-data/",
  ]) {
    const result = await exchange(
      f.connect(),
      `GET ${target} HTTP/1.1\r\nHost: ignored\r\n\r\n`,
    );
    assert.match(result, /403 Forbidden/);
    assert.doesNotMatch(result, /secret|meta-data|public\.example/);
  }
  for (const target of [
    "public.example",
    "public.example:443/path",
    "user@public.example:443",
    "127.0.0.1:443",
    "public.example:0",
    "public.example:65536",
  ]) {
    assert.match(
      await exchange(
        f.connect(),
        `CONNECT ${target} HTTP/1.1\r\nHost: ignored\r\n\r\n`,
      ),
      /403 Forbidden/,
    );
  }
  assert.equal(f.dialed.length, 0);
  assert.equal(f.resolved.length, 0);
});

test("rejects empty, private, or mixed DNS answers including a private IPv6 answer", async (t) => {
  const f = await fixture(t);
  for (const answers of [[], ["10.0.0.1"], ["93.184.216.34", "127.0.0.1"]]) {
    f.ipv4.mock.mockImplementation(async () => answers);
    assert.match(
      await exchange(
        f.connect(),
        "GET http://public.example/ HTTP/1.1\r\nHost: ignored\r\n\r\n",
      ),
      /403 Forbidden/,
    );
  }
  f.ipv4.mock.mockImplementation(async () => ["93.184.216.34"]);
  f.ipv6.mock.mockImplementation(async () => ["::1"]);
  assert.match(
    await exchange(
      f.connect(),
      "CONNECT public.example:443 HTTP/1.1\r\nHost: ignored\r\n\r\n",
    ),
    /403 Forbidden/,
  );
  assert.equal(f.dialed.length, 0);
});

test("resolves again on the next connection and denies a DNS rebind", async (t) => {
  const f = await fixture(t, (_req, res) => res.end("ok"));
  assert.match(
    await exchange(
      f.connect(),
      "GET http://public.example/ HTTP/1.1\r\nHost: ignored\r\n\r\n",
    ),
    /200 OK/,
  );
  f.ipv4.mock.mockImplementation(async () => ["127.0.0.1"]);
  assert.match(
    await exchange(
      f.connect(),
      "GET http://public.example/ HTTP/1.1\r\nHost: ignored\r\n\r\n",
    ),
    /403 Forbidden/,
  );
  assert.equal(f.dialed.length, 1);
});

test("public numeric IPv6 is pinned without DNS and preserves the HTTP Host authority", async (t) => {
  const f = await fixture(t, (req, res) => {
    assert.equal(req.headers.host, "[2606:4700:4700::1111]");
    res.end("ok");
  });
  assert.match(
    await exchange(
      f.connect(),
      "GET http://[2606:4700:4700::1111]/ HTTP/1.1\r\nHost: ignored\r\n\r\n",
    ),
    /200 OK/,
  );
  assert.equal(f.resolved.length, 0);
  assert.deepEqual(f.dialed[0], {
    host: "2606:4700:4700::1111",
    port: 80,
    family: 6,
  });
});

test("close cancels pending DNS and never dials after cancellation", async (t) => {
  const f = await fixture(t);
  let rejectLookup: ((error: Error) => void) | undefined;
  let entered!: () => void;
  const started = new Promise<void>((resolve) => {
    entered = resolve;
  });
  f.ipv4.mock.mockImplementation(
    () =>
      new Promise<string[]>((_resolve, reject) => {
        rejectLookup = reject;
        entered();
      }),
  );
  const cancel = mock.method(dns.Resolver.prototype, "cancel", () =>
    rejectLookup?.(
      Object.assign(new Error("cancelled"), { code: "ECANCELLED" }),
    ),
  );
  const socket = f.connect();
  socket.once("connect", () =>
    socket.write(
      "GET http://public.example/ HTTP/1.1\r\nHost: ignored\r\n\r\n",
    ),
  );
  await started;
  await Promise.all([f.proxy.close(), f.proxy.close()]);
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.ok(cancel.mock.callCount() > 0);
  assert.equal(f.dialed.length, 0);
  assert.equal(f.exhausted(), 0);
});

test("the DNS deadline cancels outstanding resolution after ten seconds", async (t) => {
  const f = await fixture(t);
  let rejectLookup: ((error: Error) => void) | undefined;
  let entered!: () => void;
  const started = new Promise<void>((resolve) => {
    entered = resolve;
  });
  f.ipv4.mock.mockImplementation(
    () =>
      new Promise<string[]>((_resolve, reject) => {
        rejectLookup = reject;
        entered();
      }),
  );
  mock.method(dns.Resolver.prototype, "cancel", () =>
    rejectLookup?.(
      Object.assign(new Error("cancelled"), { code: "ECANCELLED" }),
    ),
  );
  t.mock.timers.enable({ apis: ["setTimeout"] });
  try {
    const response = exchange(
      f.connect(),
      "GET http://public.example/ HTTP/1.1\r\nHost: ignored\r\n\r\n",
    );
    await started;
    t.mock.timers.tick(10_000);
    assert.match(await response, /403 Forbidden/);
    assert.equal(f.dialed.length, 0);
  } finally {
    t.mock.timers.reset();
  }
});

test("the pinned connect deadline destroys an unfinished dial after ten seconds", async (t) => {
  const f = await fixture(t);
  let pending: Socket | undefined;
  let entered!: () => void;
  const started = new Promise<void>((resolve) => {
    entered = resolve;
  });
  f.dial.mock.mockImplementation(() => {
    pending = new net.Socket();
    entered();
    return pending;
  });
  t.mock.timers.enable({ apis: ["setTimeout"] });
  try {
    const response = exchange(
      f.connect(),
      "CONNECT 93.184.216.34:443 HTTP/1.1\r\nHost: ignored\r\n\r\n",
    );
    await started;
    t.mock.timers.tick(10_000);
    assert.match(await response, /403 Forbidden/);
    assert.equal(pending?.destroyed, true);
  } finally {
    t.mock.timers.reset();
  }
});

test("close stops pending dials and established tunnels and is idempotent", async (t) => {
  const f = await fixture(t);
  const socket = f.connect();
  const ready = until(socket, "200 Connection Established");
  socket.once("connect", () =>
    socket.write(
      "CONNECT public.example:443 HTTP/1.1\r\nHost: ignored\r\n\r\n",
    ),
  );
  await ready;
  let pending: Socket | undefined;
  let entered!: () => void;
  const started = new Promise<void>((resolve) => {
    entered = resolve;
  });
  f.dial.mock.mockImplementation(() => {
    pending = new net.Socket();
    entered();
    return pending;
  });
  const waiting = f.connect();
  waiting.once("connect", () =>
    waiting.write(
      "CONNECT public.example:443 HTTP/1.1\r\nHost: ignored\r\n\r\n",
    ),
  );
  await started;
  const closed = once(socket, "close");
  await Promise.all([f.proxy.close(), f.proxy.close()]);
  await closed;
  assert.equal(pending?.destroyed, true);
  assert.equal(f.exhausted(), 0);
});

test("fixed lifetime budgets permit the full boundary and reject the next byte/request", () => {
  const requests = createBrowserEgressBudget();
  for (let i = 0; i < 10_000; i++) assert.equal(requests.recordRequest(), true);
  assert.equal(requests.recordRequest(), false);
  assert.equal(requests.recordBytes(0), false);
  const bytes = createBrowserEgressBudget();
  assert.equal(bytes.recordBytes(250 * 1024 * 1024), true);
  assert.equal(bytes.recordBytes(262 * 1024 * 1024), true);
  assert.equal(bytes.recordBytes(1), false);
  assert.equal(bytes.recordRequest(), false);
});

test("concurrent overflow rejects only the new connection and recovers capacity", async (t) => {
  const f = await fixture(t);
  const clients: Socket[] = [];
  for (let i = 0; i < 32; i++) {
    const socket = f.connect();
    await once(socket, "connect");
    clients.push(socket);
  }
  const rejected = await exchange(f.connect(), "");
  assert.match(rejected, /503 Service Unavailable/);
  assert.equal(f.exhausted(), 0);
  assert.equal(
    clients.some((socket) => socket.destroyed),
    false,
  );
  const released = once(clients[0]!, "close");
  clients[0]!.destroy();
  await released;
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.match(
    await exchange(
      f.connect(),
      "GET /relative HTTP/1.1\r\nHost: ignored\r\n\r\n",
    ),
    /403 Forbidden/,
  );
  assert.equal(f.exhausted(), 0);
});

test("HTTP pipelining cannot exceed 32 active upstream connections", async (t) => {
  let seen = 0;
  let entered!: () => void;
  const active = new Promise<void>((resolve) => {
    entered = resolve;
  });
  const f = await fixture(t, () => {
    if (++seen === 32) entered();
  });
  const socket = f.connect();
  socket.once("connect", () =>
    socket.write(
      "GET http://public.example/ HTTP/1.1\r\nHost: ignored\r\n\r\n".repeat(33),
    ),
  );
  await active;
  assert.equal(f.dialed.length, 32);
  assert.equal(f.exhausted(), 0);
  await f.proxy.close();
});

test("both sides of a tunnel receive the 30 second idle timeout and close together", async (t) => {
  const configured: Socket[] = [];
  const actual = net.Socket.prototype.setTimeout;
  mock.method(
    net.Socket.prototype,
    "setTimeout",
    function (this: Socket, timeout: number, callback?: () => void) {
      if (timeout === 30_000) configured.push(this);
      return actual.call(this, timeout, callback);
    },
  );
  const f = await fixture(t);
  const socket = f.connect();
  const ready = until(socket, "200 Connection Established");
  socket.once("connect", () =>
    socket.write(
      "CONNECT public.example:443 HTTP/1.1\r\nHost: ignored\r\n\r\n",
    ),
  );
  await ready;
  assert.equal(configured.length, 2);
  const closed = once(socket, "close");
  configured[1]!.emit("timeout");
  await closed;
  assert.ok(configured.every((connection) => connection.destroyed));
  assert.equal(f.exhausted(), 0);
});

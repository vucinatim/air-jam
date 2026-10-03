import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import dns from "node:dns/promises";
import { once } from "node:events";
import { readFile, readdir } from "node:fs/promises";
import http from "node:http";
import https from "node:https";
import net from "node:net";
import test from "node:test";
import { chromium } from "playwright-core";
import { startReleaseBrowserWorker } from "../dist/index.js";
import { fixtureTlsCertificate, fixtureTlsKey } from "../src/fixtures/tls.ts";

test("built worker confines real capture networking and cleans up its children", async (context) => {
  assert.equal(process.platform, "linux");
  assert.notEqual(process.getuid(), 0);
  const token = "airjam-owned-image-proof-token-with-no-provider-authority";
  let forbiddenRequests = 0;
  const sockets = new Set();
  const serve = (request, response) => {
    assert.equal(
      request.headers.authorization,
      request.url === "/private"
        ? "Bearer owned-inspection-fixture"
        : undefined,
    );
    if (request.url === "/forbidden") forbiddenRequests += 1;
    if (request.url === "/redirect") {
      response.writeHead(302, {
        location: `http://127.0.0.1:${port}/forbidden`,
      });
      response.end();
      return;
    }
    response.writeHead(200, { "content-type": "text/html" });
    const protocol = request.socket.encrypted ? "wss" : "ws";
    const socketPort = request.socket.encrypted ? encryptedPort : port;
    response.end(`<h1>Owned game fixture</h1><script>
      const socket = new WebSocket('${protocol}://game.fixture.invalid:${socketPort}/socket');
      socket.onmessage = (event) => { window.socketResult = event.data; };
      fetch('/chunk').then((response) => response.text()).then(() => { window.chunkLoaded = true; });
    </script>`);
  };
  const fixture = http.createServer(serve);
  const encryptedFixture = https.createServer(
    { key: fixtureTlsKey, cert: fixtureTlsCertificate },
    serve,
  );
  const upgrade = (request, socket) => {
    const accept = createHash("sha1")
      .update(
        `${request.headers["sec-websocket-key"]}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`,
      )
      .digest("base64");
    socket.write(
      `HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${accept}\r\n\r\n`,
    );
    socket.write(Buffer.from([0x81, 2, 111, 107]));
  };
  for (const server of [fixture, encryptedFixture]) {
    server.on("connection", (socket) => {
      sockets.add(socket);
      socket.on("close", () => sockets.delete(socket));
    });
    server.on("upgrade", upgrade);
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
  }
  const { port } = fixture.address();
  const encryptedPort = encryptedFixture.address().port;
  context.after(async () => {
    for (const socket of sockets) socket.destroy();
    await Promise.all(
      [fixture, encryptedFixture].map(
        (server) => new Promise((resolve) => server.close(resolve)),
      ),
    );
  });
  const actualConnect = net.connect.bind(net);
  context.mock.method(dns.Resolver.prototype, "resolve4", async (hostname) => {
    assert.equal(hostname, "game.fixture.invalid");
    return ["93.184.216.34"];
  });
  context.mock.method(dns.Resolver.prototype, "resolve6", async () => []);
  // Redirect only already-vetted public dials to the owned fixture, never DNS policy.
  context.mock.method(net, "connect", (options, ...argumentsRest) =>
    options?.host === "93.184.216.34"
      ? actualConnect({ ...options, host: "127.0.0.1" }, ...argumentsRest)
      : actualConnect(options, ...argumentsRest),
  );
  const worker = await startReleaseBrowserWorker({
    AIRJAM_BROWSER_WORKER_HOST: "127.0.0.1",
    AIRJAM_BROWSER_WORKER_PORT: "8800",
    AIRJAM_BROWSER_WORKER_ACCESS_TOKEN: token,
  });
  context.after(() => worker.close());
  const browser = await chromium.connect(worker.wsEndpoint, {
    headers: { authorization: `Bearer ${token}` },
    timeout: 15_000,
  });
  try {
    // Trust only this owned fixture context; production TLS policy is unchanged.
    const page = await browser.newPage({ ignoreHTTPSErrors: true });
    for (const origin of [
      `http://game.fixture.invalid:${port}`,
      `https://game.fixture.invalid:${encryptedPort}`,
    ]) {
      assert.equal((await page.goto(`${origin}/game`)).status(), 200);
      await page.waitForFunction(
        () => window.chunkLoaded && window.socketResult === "ok",
      );
    }
    assert.ok((await page.screenshot()).length > 0);
    assert.equal(
      (
        await page
          .context()
          .request.get(`http://game.fixture.invalid:${port}/private`, {
            headers: { authorization: "Bearer owned-inspection-fixture" },
          })
      ).status(),
      200,
    );
    assert.equal(
      (
        await page.context().request.get(`http://127.0.0.1:${port}/forbidden`)
      ).status(),
      403,
    );
    for (const target of [
      `http://127.0.0.1:${port}/forbidden`,
      `http://game.fixture.invalid:${port}/redirect`,
    ]) {
      assert.equal((await page.goto(target)).status(), 403);
    }
    assert.equal(forbiddenRequests, 0);
    const processes = [];
    let browserProcesses = 0;
    for (const name of await readdir("/proc")) {
      if (!/^\d+$/u.test(name)) continue;
      try {
        const command = await readFile(`/proc/${name}/cmdline`, "utf8");
        if (!command.includes("chrome") || command.includes("/bin/bash"))
          continue;
        const status = await readFile(`/proc/${name}/status`, "utf8");
        assert.match(status, /^NoNewPrivs:\s+1$/mu);
        // Chromium's nested sandbox zygote has capabilities in its own user
        // namespace. The browser itself must have none in the egress namespace.
        if (!command.includes("--type=") && !command.includes("crashpad")) {
          assert.match(status, /^CapEff:\s+0+$/mu);
          const environment = await readFile(`/proc/${name}/environ`, "utf8");
          assert.ok(!environment.includes(token));
          const routes = await readFile(`/proc/${name}/net/route`, "utf8");
          assert.equal(routes.trim().split("\n").length, 1);
          browserProcesses += 1;
        }
        processes.push(Number(name));
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
      }
    }
    assert.ok(processes.length > 0);
    assert.ok(browserProcesses > 0);
    await browser.close();
    await worker.close();
    for (const processId of processes) {
      await assert.rejects(readFile(`/proc/${processId}/status`), {
        code: "ENOENT",
      });
    }
  } finally {
    await browser.close();
  }
});

import httpProxy from "http-proxy";
import { createServer, type ServerResponse } from "node:http";
import type { Socket } from "node:net";
import { chromium } from "playwright-core";
import { isAuthorized } from "./access-control";
import { loadBrowserWorkerEnv } from "./env";
import {
  launchIsolatedBrowser,
  type IsolatedBrowser,
} from "./isolated-browser";

const SERVICE = "air-jam-release-browser-worker";
const PUBLIC_WS_PATH = "/ws";
const MAX_CAPTURES = 2;

export type ReleaseBrowserWorkerHandle = {
  wsEndpoint: string;
  close: () => Promise<void>;
};

const writeJson = (
  response: ServerResponse,
  statusCode: number,
  body: Record<string, unknown>,
) => {
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  response.end(JSON.stringify(body));
};

export const startReleaseBrowserWorker = async (
  env: Record<string, string | undefined> = process.env,
): Promise<ReleaseBrowserWorkerHandle> => {
  const config = loadBrowserWorkerEnv(env);
  const shutdown = new AbortController();
  const sockets = new Set<Socket>();
  const captures = new Set<Promise<void>>();
  const browsers = new Set<IsolatedBrowser>();
  const proxy = httpProxy.createProxyServer({ ws: true });
  let health: { ok: boolean; checkedAt: number } | undefined;
  let healthCheck: Promise<boolean> | undefined;

  const checkHealth = (): Promise<boolean> => {
    if (shutdown.signal.aborted) return Promise.resolve(false);
    if (
      [...browsers].some(({ server }) => {
        const child = server.process();
        return child.exitCode === null && child.signalCode === null;
      })
    ) {
      return Promise.resolve(true);
    }
    if (healthCheck) return healthCheck;
    if (health && Date.now() - health.checkedAt < 30_000) {
      return Promise.resolve(health.ok);
    }
    // Do not launch a third browser just to probe two in-flight launches.
    if (captures.size >= MAX_CAPTURES) return Promise.resolve(false);
    healthCheck = (async () => {
      let owned: IsolatedBrowser | undefined;
      try {
        owned = await launchIsolatedBrowser(config, shutdown.signal);
        const browser = await chromium.connect(owned.server.wsEndpoint(), {
          timeout: 5_000,
        });
        try {
          const page = await browser.newPage();
          await page.goto("about:blank", { timeout: 3_000 });
          health = { ok: true, checkedAt: Date.now() };
        } finally {
          await browser.close();
        }
      } catch {
        health = { ok: false, checkedAt: Date.now() };
      } finally {
        try {
          await owned?.close();
        } finally {
          healthCheck = undefined;
        }
      }
      return health?.ok ?? false;
    })();
    return healthCheck;
  };

  proxy.on("error", (_error, _request, socket) => {
    // Proxy errors can contain URLs and caller headers. Return only a stable code.
    socket.destroy();
  });

  const server = createServer(
    { maxHeaderSize: 16_384 },
    (request, response) => {
      if (request.method === "GET" && request.url === "/health") {
        void checkHealth()
          .then((ok) => {
            if (!response.destroyed) {
              writeJson(response, ok ? 200 : 503, {
                ok,
                service: SERVICE,
                activeCaptures: captures.size,
                capacity: MAX_CAPTURES,
              });
            }
          })
          .catch(() => {
            if (!response.destroyed) writeJson(response, 503, { ok: false });
          });
        return;
      }
      if (!isAuthorized({ request, accessToken: config.accessToken })) {
        writeJson(response, 401, { ok: false, error: "unauthorized" });
        return;
      }
      if (request.method === "GET" && request.url === "/") {
        writeJson(response, 200, {
          service: SERVICE,
          wsPathname: PUBLIC_WS_PATH,
          capacity: MAX_CAPTURES,
        });
        return;
      }
      writeJson(response, 404, { ok: false, error: "not_found" });
    },
  );
  server.requestTimeout = 20_000;
  server.headersTimeout = 10_000;
  server.keepAliveTimeout = 5_000;
  server.maxConnections = 64;
  server.on("connection", (socket) => {
    sockets.add(socket);
    socket.once("close", () => sockets.delete(socket));
  });
  server.on("upgrade", (request, socket, head) => {
    const reject = (status: string) => {
      socket.end(`HTTP/1.1 ${status}\r\nConnection: close\r\n\r\n`, () =>
        socket.destroy(),
      );
    };
    if (!isAuthorized({ request, accessToken: config.accessToken })) {
      reject("401 Unauthorized");
      return;
    }
    if (request.method !== "GET" || request.url !== PUBLIC_WS_PATH) {
      reject("404 Not Found");
      return;
    }
    if (
      shutdown.signal.aborted ||
      captures.size + (healthCheck ? 1 : 0) >= MAX_CAPTURES
    ) {
      reject("503 Service Unavailable");
      return;
    }

    const abort = new AbortController();
    const cancel = () => {
      abort.abort();
      socket.destroy();
    };
    socket.once("end", cancel);
    socket.once("close", cancel);
    shutdown.signal.addEventListener("abort", cancel, { once: true });
    socket.pause();
    const capture = (async () => {
      let owned: IsolatedBrowser | undefined;
      try {
        owned = await launchIsolatedBrowser(config, abort.signal);
        if (socket.destroyed || abort.signal.aborted) return;
        browsers.add(owned);
        owned.server.once("close", () => {
          if (!socket.destroyed) health = undefined;
          socket.destroy();
        });
        const endpoint = new URL(owned.server.wsEndpoint());
        request.url = endpoint.pathname;
        delete request.headers.authorization;
        proxy.ws(request, socket, head, { target: `http://${endpoint.host}` });
        socket.resume();
        await new Promise<void>((resolve) => {
          if (socket.destroyed) resolve();
          else socket.once("close", resolve);
        });
      } catch {
        health = undefined;
        socket.destroy();
      } finally {
        shutdown.signal.removeEventListener("abort", cancel);
        socket.off("end", cancel);
        socket.off("close", cancel);
        if (owned) {
          browsers.delete(owned);
          await owned.close();
        }
      }
    })();
    captures.add(capture);
    void capture
      .finally(() => captures.delete(capture))
      .catch(() => {
        console.error(
          JSON.stringify({
            service: SERVICE,
            event: "browser_worker.cleanup_failed",
          }),
        );
      });
  });

  let closePromise: Promise<void> | undefined;
  const close = () => {
    if (closePromise) return closePromise;
    closePromise = (async () => {
      shutdown.abort();
      for (const socket of sockets) socket.destroy();
      await new Promise<void>((resolve) => server.close(() => resolve()));
      proxy.close();
      await Promise.allSettled([
        ...captures,
        ...(healthCheck ? [healthCheck] : []),
      ]);
    })();
    return closePromise;
  };

  try {
    if (!(await checkHealth()))
      throw new Error("Isolated browser health check failed.");
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(config.port, config.host, () => {
        server.off("error", reject);
        resolve();
      });
    });
  } catch (error) {
    await close();
    throw error;
  }

  const address = server.address();
  if (!address || typeof address === "string") {
    await close();
    throw new Error("Release browser worker did not bind a TCP address.");
  }
  const publicDomain = env.RAILWAY_STATIC_URL ?? env.RAILWAY_PUBLIC_DOMAIN;
  const host = config.host.includes(":") ? `[${config.host}]` : config.host;
  const wsEndpoint = publicDomain
    ? `wss://${publicDomain}${PUBLIC_WS_PATH}`
    : `ws://${host}:${address.port}${PUBLIC_WS_PATH}`;
  console.log(
    JSON.stringify({
      service: SERVICE,
      event: "browser_worker.started",
      wsEndpoint,
    }),
  );
  return { wsEndpoint, close };
};

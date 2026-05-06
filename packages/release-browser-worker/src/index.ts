import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { URL } from "node:url";
import httpProxy from "http-proxy";
import type { BrowserServer } from "playwright-core";
import { chromium } from "playwright-core";
import { isAuthorized } from "./access-control";
import { loadBrowserWorkerEnv, type BrowserWorkerEnv } from "./env";

export type ReleaseBrowserWorkerHandle = {
  wsEndpoint: string;
  close: () => Promise<void>;
};

const formatStartupMessage = ({
  config,
  wsEndpoint,
}: {
  config: BrowserWorkerEnv;
  wsEndpoint: string;
}) =>
  JSON.stringify({
    service: "air-jam-release-browser-worker",
    event: "browser_worker.started",
    host: config.host,
    port: config.port,
    wsEndpoint,
    headless: config.headless,
    chromiumSandbox: config.chromiumSandbox,
  });

const writeJson = (
  response: ServerResponse,
  statusCode: number,
  body: Record<string, unknown>,
) => {
  response.statusCode = statusCode;
  response.setHeader("content-type", "application/json; charset=utf-8");
  response.end(JSON.stringify(body));
};

const getPublicWsEndpoint = ({
  publicUrl,
  wsPathname,
}: {
  publicUrl: string | null;
  wsPathname: string;
}) => {
  if (!publicUrl) {
    return null;
  }

  const url = new URL(publicUrl);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.pathname = wsPathname;
  url.search = "";
  return url.toString();
};

export const startReleaseBrowserWorker = async (
  env: Record<string, string | undefined> = process.env,
): Promise<ReleaseBrowserWorkerHandle> => {
  const config = loadBrowserWorkerEnv(env);
  const browserServer: BrowserServer = await chromium.launchServer({
    headless: config.headless,
    host: "127.0.0.1",
    port: 0,
    chromiumSandbox: config.chromiumSandbox,
    executablePath: config.executablePath ?? undefined,
  });

  const internalWsEndpoint = browserServer.wsEndpoint();
  const internalWsUrl = new URL(internalWsEndpoint);
  const proxyTarget = `${internalWsUrl.protocol === "wss:" ? "https:" : "http:"}//${internalWsUrl.host}`;
  const proxy = httpProxy.createProxyServer({
    target: proxyTarget,
    changeOrigin: false,
    ws: true,
  });

  proxy.on("error", (error, request, response) => {
    const path = request.url ?? "/";

    if (response && "writeHead" in response) {
      writeJson(response as ServerResponse, 502, {
        ok: false,
        error: "browser_proxy_error",
        message: error.message,
        path,
      });
      return;
    }

    console.error(
      JSON.stringify({
        service: "air-jam-release-browser-worker",
        event: "browser_worker.proxy_error",
        error: error.message,
        path,
      }),
    );
  });

  const server = createServer(
    (request: IncomingMessage, response: ServerResponse) => {
      const requestUrl = request.url ?? "/";
      if (requestUrl === "/health") {
        writeJson(response, 200, {
          ok: true,
          service: "air-jam-release-browser-worker",
        });
        return;
      }

      if (requestUrl === "/" || requestUrl === "") {
        writeJson(response, 200, {
          ok: true,
          service: "air-jam-release-browser-worker",
          wsPathname: internalWsUrl.pathname,
        });
        return;
      }

      if (!isAuthorized({ request, accessToken: config.accessToken })) {
        writeJson(response, 401, {
          ok: false,
          error: "unauthorized",
        });
        return;
      }

      proxy.web(request, response);
    },
  );

  server.on("upgrade", (request, socket, head) => {
    if (!isAuthorized({ request, accessToken: config.accessToken })) {
      socket.write(
        "HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n",
      );
      socket.destroy();
      return;
    }

    proxy.ws(request, socket, head);
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(config.port, config.host, () => {
      server.off("error", reject);
      resolve();
    });
  });

  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Release browser worker did not bind a TCP address.");
  }

  const publicOrigin = env.RAILWAY_STATIC_URL
    ? `https://${env.RAILWAY_STATIC_URL}`
    : env.RAILWAY_PUBLIC_DOMAIN
      ? `https://${env.RAILWAY_PUBLIC_DOMAIN}`
      : null;
  const publicWsEndpoint =
    getPublicWsEndpoint({
      publicUrl: publicOrigin,
      wsPathname: internalWsUrl.pathname,
    }) ??
    `ws://${config.host}:${(address as AddressInfo).port}${internalWsUrl.pathname}`;

  console.log(formatStartupMessage({ config, wsEndpoint: publicWsEndpoint }));

  return {
    wsEndpoint: publicWsEndpoint,
    close: async () => {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      });
      proxy.close();
      await browserServer.close();
    },
  };
};

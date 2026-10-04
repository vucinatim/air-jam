import { Resolver } from "node:dns/promises";
import { once } from "node:events";
import http, { createServer, type RequestOptions } from "node:http";
import type { AddressInfo } from "node:net";
import { chromium, type Browser } from "playwright-core";
import { expect, it, vi } from "vitest";
import { RELEASE_INSPECTION_ACCESS_HEADER } from "./release-inspection-access";
import { installReleaseInspectionRouting } from "./release-inspection-routing";

it.skipIf(process.env.AIR_JAM_TEST_RELEASE_CAPTURE_BROWSER !== "1")(
  "loads private assets without leaking inspection authority through browser redirects",
  async () => {
    const generationPath = "/releases/g/game/r/release/generations/one";
    const token = "private-generation-proof";
    const observed: Array<{
      host: string | undefined;
      path: string | undefined;
      token: string | string[] | undefined;
    }> = [];
    let externalOrigin: string;
    const server = createServer((request, response) => {
      observed.push({
        host: request.headers.host,
        path: request.url,
        token: request.headers[RELEASE_INSPECTION_ACCESS_HEADER],
      });
      response.setHeader("access-control-allow-origin", "*");
      if (request.url === "/outside") {
        response.end("outside-ok");
      } else if (!request.url?.startsWith(`${generationPath}/`)) {
        response.end("external-ok");
      } else if (request.headers[RELEASE_INSPECTION_ACCESS_HEADER] !== token) {
        response.writeHead(401).end("private");
      } else if (request.url === `${generationPath}/redirect-same`) {
        response.writeHead(302, { location: "/outside" }).end();
      } else if (request.url === `${generationPath}/redirect-cross`) {
        response
          .writeHead(307, { location: `${externalOrigin}/redirect-target` })
          .end();
      } else if (request.url === `${generationPath}/host`) {
        response.setHeader("content-type", "text/html");
        response.end(
          '<!doctype html><title>Private release</title><body><script src="./chunk.js"></script>',
        );
      } else if (request.url === `${generationPath}/chunk.js`) {
        response.setHeader("content-type", "application/javascript");
        response.end("document.body.dataset.privateChunk = 'loaded'");
      } else {
        response.writeHead(404).end();
      }
    });
    const originalRequest = http.request;
    let browser: Browser | undefined;
    try {
      server.listen(0, "127.0.0.1");
      await once(server, "listening");
      const port = (server.address() as AddressInfo).port;
      const origin = `http://assets.localhost:${port}`;
      externalOrigin = `http://external.localhost:${port}`;
      vi.spyOn(Resolver.prototype, "resolve4").mockResolvedValue(["1.1.1.1"]);
      vi.spyOn(Resolver.prototype, "resolve6").mockResolvedValue([]);
      vi.spyOn(http, "request").mockImplementation(
        (
          options: string | URL | RequestOptions,
          callback?:
            | RequestOptions
            | ((response: http.IncomingMessage) => void),
        ) => {
          if (
            typeof options !== "object" ||
            options instanceof URL ||
            options.hostname !== "1.1.1.1" ||
            options.port !== String(port) ||
            typeof callback !== "function"
          ) {
            throw new Error("Unexpected fixture dial.");
          }
          // Map only already-approved numeric IO to the owned fixture.
          return originalRequest(
            { ...options, hostname: "127.0.0.1" },
            callback,
          );
        },
      );
      browser = await chromium.launch({
        headless: true,
        args: [
          "--no-proxy-server",
          "--host-resolver-rules=MAP assets.localhost 127.0.0.1,MAP external.localhost 127.0.0.1",
        ],
      });
      const context = await browser.newContext({ serviceWorkers: "block" });
      // Owned loopback fixtures prove header confinement, not network isolation.
      await context.grantPermissions(["local-network-access"], { origin });
      await installReleaseInspectionRouting(context, {
        generationUrl: `${origin}${generationPath}`,
        token,
        requestTimeoutMs: 3000,
      });
      await context.route("**/*", async (route) => {
        const requestOrigin = new URL(route.request().url()).origin;
        if (requestOrigin === origin || requestOrigin === externalOrigin)
          await route.fallback();
        else await route.abort();
      });
      const page = await context.newPage();
      const browserErrors: string[] = [];
      page.on("console", (message) => {
        if (message.type() === "error") browserErrors.push(message.text());
      });
      await page.goto(`${origin}${generationPath}/host`);
      expect(
        await page.locator("body").getAttribute("data-private-chunk"),
      ).toBe("loaded");
      const results = await page.evaluate(
        async ({ generationPath, externalOrigin }) =>
          Promise.all([
            fetch(`${generationPath}/redirect-same`)
              .then((response) => response.text())
              .catch((error: Error) => error.message),
            fetch(`${generationPath}/redirect-cross`)
              .then((response) => response.text())
              .catch((error: Error) => error.message),
            fetch(`${externalOrigin}/font-asset`)
              .then((response) => response.text())
              .catch((error: Error) => error.message),
          ]),
        { generationPath, externalOrigin },
      );
      expect(results, JSON.stringify({ observed, browserErrors })).toEqual([
        "outside-ok",
        "external-ok",
        "external-ok",
      ]);
      for (const path of ["/outside", "/redirect-target", "/font-asset"])
        expect(observed).toContainEqual({
          host: new URL(path === "/outside" ? origin : externalOrigin).host,
          path,
          token: undefined,
        });
      expect(
        observed.filter((request) => request.token === token),
      ).toHaveLength(4);
      expect(
        observed
          .filter((request) => request.token === token)
          .every((request) => request.path?.startsWith(`${generationPath}/`)),
      ).toBe(true);
      await context.close();
    } finally {
      try {
        await browser?.close();
      } finally {
        vi.restoreAllMocks();
        server.closeAllConnections();
        await new Promise<void>((resolve) => server.close(() => resolve()));
      }
    }
  },
  15_000,
);

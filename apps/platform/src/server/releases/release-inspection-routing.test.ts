import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { chromium, type BrowserContext, type Route } from "playwright-core";
import { describe, expect, it, vi } from "vitest";
import { RELEASE_INSPECTION_ACCESS_HEADER } from "./release-inspection-access";
import { installReleaseInspectionRouting } from "./release-inspection-routing";

const generationPath = "/releases/g/game/r/release/generations/one";
const token = "private-generation-proof";

const routingFixture = async () => {
  let handler!: (route: Route) => Promise<void>;
  const context = {
    route: vi.fn(async (_: string, callback: typeof handler) => {
      handler = callback;
    }),
  } as unknown as BrowserContext;
  await installReleaseInspectionRouting(context, {
    generationUrl: `https://games.example.test${generationPath}`,
    token,
    requestTimeoutMs: 1234,
  });
  const response = { dispose: vi.fn().mockResolvedValue(undefined) };
  const route = {
    request: () => ({
      url: () => `https://games.example.test${generationPath}/host`,
      headers: () => ({
        accept: "text/html",
        [RELEASE_INSPECTION_ACCESS_HEADER]: "game-supplied-header",
      }),
    }),
    fetch: vi.fn().mockResolvedValue(response),
    fulfill: vi.fn().mockResolvedValue(undefined),
    continue: vi.fn().mockResolvedValue(undefined),
    abort: vi.fn().mockResolvedValue(undefined),
  };
  return { handler, route, response };
};

describe("release inspection routing", () => {
  it("privately fetches only one generation without automatic redirects or retries", async () => {
    const { handler, route, response } = await routingFixture();
    await handler(route as unknown as Route);
    expect(route.fetch).toHaveBeenCalledWith({
      headers: {
        accept: "text/html",
        [RELEASE_INSPECTION_ACCESS_HEADER]: token,
      },
      maxRedirects: 0,
      maxRetries: 0,
      timeout: 1234,
    });
    expect(route.fulfill).toHaveBeenCalledWith({ response });
    expect(response.dispose).toHaveBeenCalledOnce();
    expect(route.continue).not.toHaveBeenCalled();
  });

  it.each([
    `https://other.example.test${generationPath}/host`,
    `https://games.example.test:444${generationPath}/host`,
    "https://games.example.test/api/account",
    "https://games.example.test/releases/g/game/r/release/generations/two/host",
    `https://games.example.test${generationPath}-other/host`,
    `https://games.example.test${generationPath}/../two/host`,
  ])(
    "never forwards inspection authority outside the generation: %s",
    async (url) => {
      const { handler, route } = await routingFixture();
      const original = route.request();
      route.request = () => ({ ...original, url: () => url });
      await handler(route as unknown as Route);
      expect(route.fetch).not.toHaveBeenCalled();
      expect(route.continue).toHaveBeenCalledWith({
        headers: { accept: "text/html" },
      });
    },
  );

  it("aborts a failed private fetch without surfacing secret-bearing transport errors", async () => {
    const { handler, route } = await routingFixture();
    route.fetch.mockRejectedValue(new Error(`transport included ${token}`));
    await expect(handler(route as unknown as Route)).resolves.toBeUndefined();
    expect(route.abort).toHaveBeenCalledWith("failed");
    expect(route.fulfill).not.toHaveBeenCalled();
  });
});

const listen = async (server: Server) => {
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
};
const close = async (server: Server) => {
  server.closeAllConnections();
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
};

// Real browser proof is explicit; normal unit CI need not download Chromium.
describe.runIf(process.env.AIR_JAM_TEST_RELEASE_CAPTURE_BROWSER === "1")(
  "inspection routing in Chromium",
  () => {
    it("loads private assets while keeping same/cross-origin redirects and external assets credential-free", async () => {
      const observed: Array<{ path: string; token?: string }> = [];
      const external = createServer((request, response) => {
        observed.push({
          path: `external${request.url}`,
          token: request.headers[RELEASE_INSPECTION_ACCESS_HEADER] as
            | string
            | undefined,
        });
        response.setHeader("access-control-allow-origin", "*");
        response.end("external-ok");
      });
      const externalOrigin = await listen(external);
      const assets = createServer((request, response) => {
        const requestToken = request.headers[
          RELEASE_INSPECTION_ACCESS_HEADER
        ] as string | undefined;
        observed.push({ path: request.url!, token: requestToken });
        if (request.url === "/outside") {
          response.end("outside-ok");
          return;
        }
        if (requestToken !== token) {
          response.writeHead(401).end("private");
          return;
        }
        if (request.url === `${generationPath}/redirect-same`) {
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
          response.end("private-ok");
        }
      });
      const origin = await listen(assets);
      let browser;
      try {
        browser = await chromium.launch({ headless: true });
        const context = await browser.newContext({ serviceWorkers: "block" });
        // Both HTTP endpoints are owned loopback fixtures. This test proves
        // header confinement, not private-network isolation; production never
        // grants this permission.
        await context.grantPermissions(["local-network-access"], { origin });
        await installReleaseInspectionRouting(context, {
          generationUrl: `${origin}${generationPath}`,
          token,
          requestTimeoutMs: 3000,
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
                .then((r) => r.text())
                .catch((error: Error) => error.message),
              fetch(`${generationPath}/redirect-cross`)
                .then((r) => r.text())
                .catch((error: Error) => error.message),
              fetch(`${externalOrigin}/font-asset`)
                .then((r) => r.text())
                .catch((error: Error) => error.message),
            ]),
          { generationPath, externalOrigin },
        );
        expect(results, JSON.stringify({ observed, browserErrors })).toEqual([
          "outside-ok",
          "external-ok",
          "external-ok",
        ]);
        for (const path of [
          "/outside",
          "external/redirect-target",
          "external/font-asset",
        ]) {
          expect(observed).toContainEqual({ path, token: undefined });
        }
        expect(
          observed
            .filter((entry) => entry.token === token)
            .every((entry) => entry.path.startsWith(`${generationPath}/`)),
        ).toBe(true);
        await context.close();
      } finally {
        await browser?.close();
        await Promise.all([close(assets), close(external)]);
      }
    }, 15_000);
  },
);

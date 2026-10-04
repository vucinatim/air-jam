import {
  buildHostedReleaseBasePath,
  buildHostedReleaseRuntimeTopology,
  injectHostedReleaseHtmlRuntimeBase,
  rewriteHostedReleaseHtmlAssetUrls,
  rewriteHostedReleaseTextAssetUrls,
} from "@/lib/releases/release-url";
import { lookup } from "mime-types";
import { createHash, randomBytes } from "node:crypto";
import { Resolver } from "node:dns/promises";
import { once } from "node:events";
import { readdir, readFile } from "node:fs/promises";
import http, { createServer, type RequestOptions } from "node:http";
import type { AddressInfo } from "node:net";
import path from "node:path";
import { expect, it, vi } from "vitest";
import { openCloudflareBrowserSession } from "./cloudflare-browser-session";
import {
  createReleaseInspectionAccessToken,
  RELEASE_INSPECTION_ACCESS_HEADER,
  verifyReleaseInspectionAccessToken,
} from "./release-inspection-access";
import { installReleaseInspectionRouting } from "./release-inspection-routing";

// Paid/provider IO is explicit, never part of the ordinary local or CI gate.
it.skipIf(process.env.AIRJAM_TEST_CLOUDFLARE_CAPTURE !== "1")(
  "renders a built Pong host through the actual private fetch and managed session owners",
  async () => {
    const accountId = process.env.AIRJAM_TEST_CLOUDFLARE_ACCOUNT_ID;
    const apiToken = process.env.AIRJAM_TEST_CLOUDFLARE_API_TOKEN;
    if (!accountId || !apiToken)
      throw new Error("Capture proof credentials required.");
    const identity = {
      gameId: "pong-proof",
      releaseId: "owned-release",
      generationId: "owned-generation",
    };
    const origin = "http://capture-fixture.invalid";
    const basePath = buildHostedReleaseBasePath(identity);
    const secret = randomBytes(32).toString("hex");
    const token = createReleaseInspectionAccessToken({
      ...identity,
      secret,
      expiresAtMs: Date.now() + 90_000,
    });
    const directory = path.resolve(__dirname, "../../../../../games/pong/dist");
    const assets = new Map<string, Buffer>();
    for (const entry of await readdir(directory, {
      recursive: true,
      withFileTypes: true,
    })) {
      if (!entry.isFile()) continue;
      const filename = path.join(entry.parentPath, entry.name);
      assets.set(
        path.relative(directory, filename).split(path.sep).join("/"),
        await readFile(filename),
      );
    }
    expect(assets.has("index.html")).toBe(true);
    const observed: string[] = [];
    const server = createServer((request, response) => {
      const authorized = verifyReleaseInspectionAccessToken({
        ...identity,
        secret,
        token:
          typeof request.headers[RELEASE_INSPECTION_ACCESS_HEADER] === "string"
            ? request.headers[RELEASE_INSPECTION_ACCESS_HEADER]
            : null,
      });
      const url = new URL(request.url ?? "/", origin);
      if (!authorized || !url.pathname.startsWith(`${basePath}/`)) {
        response.writeHead(403).end();
        return;
      }
      const relative = url.pathname.slice(basePath.length + 1) || "index.html";
      const asset = assets.get(relative);
      if (!asset) {
        response.writeHead(404).end();
        return;
      }
      observed.push(relative);
      const contentType = lookup(relative) || "application/octet-stream";
      let body = asset;
      if (relative === "index.html") {
        body = Buffer.from(
          injectHostedReleaseHtmlRuntimeBase({
            ...identity,
            html: rewriteHostedReleaseHtmlAssetUrls({
              ...identity,
              html: asset.toString(),
            }),
            requestedAssetPath: "index.html",
            entryPath: "index.html",
            runtimeTopology: buildHostedReleaseRuntimeTopology({
              ...identity,
              requestedAssetPath: "index.html",
              entryPath: "index.html",
              appOrigin: origin,
              backendOrigin: "https://runtime-fixture.invalid",
            }),
          }),
        );
      } else if (
        contentType.includes("javascript") ||
        contentType.includes("text/css")
      ) {
        body = Buffer.from(
          rewriteHostedReleaseTextAssetUrls({
            ...identity,
            content: asset.toString(),
            contentType,
          }),
        );
      }
      response.writeHead(200, { "content-type": contentType }).end(body);
    });
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const port = (server.address() as AddressInfo).port;
    const originalRequest = http.request;
    const resolve4 = Resolver.prototype.resolve4;
    const resolve6 = Resolver.prototype.resolve6;
    vi.spyOn(Resolver.prototype, "resolve4").mockImplementation(function (
      this: Resolver,
      hostname,
      options,
    ) {
      if (hostname === "capture-fixture.invalid")
        return Promise.resolve(["1.1.1.1"]);
      return resolve4.call(this, hostname, options);
    });
    vi.spyOn(Resolver.prototype, "resolve6").mockImplementation(function (
      this: Resolver,
      hostname,
      options,
    ) {
      if (hostname === "capture-fixture.invalid") return Promise.resolve([]);
      return resolve6.call(this, hostname, options);
    });
    vi.spyOn(http, "request").mockImplementation(
      (
        options: string | URL | RequestOptions,
        callback?: RequestOptions | ((response: http.IncomingMessage) => void),
      ) => {
        if (
          typeof options !== "object" ||
          options instanceof URL ||
          options.hostname !== "1.1.1.1" ||
          typeof callback !== "function"
        ) {
          throw new Error("Unexpected fixture dial.");
        }
        // Only the approved numeric socket destination is mapped, not the fetcher.
        return originalRequest(
          { ...options, hostname: "127.0.0.1", port },
          callback,
        );
      },
    );

    let session:
      | Awaited<ReturnType<typeof openCloudflareBrowserSession>>
      | undefined;
    let context:
      | Awaited<
          ReturnType<NonNullable<typeof session>["browser"]["newContext"]>
        >
      | undefined;
    try {
      session = await openCloudflareBrowserSession({
        accountId,
        apiToken,
        timeoutMs: 20_000,
      });
      context = await session.browser.newContext({
        serviceWorkers: "block",
        acceptDownloads: false,
        viewport: { width: 1440, height: 900 },
      });
      await installReleaseInspectionRouting(context, {
        generationUrl: `${origin}${basePath}/`,
        token,
        requestTimeoutMs: 20_000,
      });
      // This offline render proof must not create real rooms or contact third parties.
      await context.route("**/*", async (route) => {
        if (route.request().url().startsWith(`${origin}${basePath}/`))
          await route.fallback();
        else await route.abort();
      });
      const page = await context.newPage();
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      const response = await page.goto(`${origin}${basePath}/`, {
        waitUntil: "load",
        timeout: 20_000,
      });
      expect(response?.status()).toBe(200);
      await page.waitForFunction(
        () => /pong/i.test(document.body.innerText),
        undefined,
        { timeout: 10_000 },
      );
      await page.waitForTimeout(1500);
      const text = await page.locator("body").innerText();
      expect(text).not.toContain("Loading match surface");
      expect(
        observed.filter((asset) => asset.endsWith(".js")).length,
      ).toBeGreaterThanOrEqual(2);
      expect(observed.some((asset) => asset.endsWith(".css"))).toBe(true);
      expect(errors).toEqual([]);
      const screenshot = await page.screenshot({
        type: "png",
        fullPage: false,
        timeout: 20_000,
      });
      expect(screenshot.length).toBeGreaterThan(10_000);
      console.log(
        JSON.stringify({
          sessionId: session.sessionId,
          renderedText: text,
          privateAssets: observed,
          screenshotBytes: screenshot.length,
          screenshotSha256: createHash("sha256")
            .update(screenshot)
            .digest("hex"),
          limitation:
            "Built offline Pong with owned fixture socket mapping; not R2, live multiplayer, or provider egress containment.",
        }),
      );
    } finally {
      try {
        await session?.close();
      } finally {
        vi.restoreAllMocks();
        server.closeAllConnections();
        await new Promise<void>((resolve) => server.close(() => resolve()));
      }
    }
  },
  60_000,
);

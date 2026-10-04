import type { BrowserContext, Route } from "playwright-core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RELEASE_INSPECTION_ACCESS_HEADER } from "./release-inspection-access";
import { installReleaseInspectionRouting } from "./release-inspection-routing";

const mocks = vi.hoisted(() => ({ fetch: vi.fn(), close: vi.fn() }));
vi.mock("./release-inspection-fetch", () => ({
  createReleaseInspectionFetcher: () => mocks,
}));

const generationPath = "/releases/g/game/r/release/generations/one";
const token = "private-generation-proof";
beforeEach(() => vi.resetAllMocks());

const routingFixture = async () => {
  let handler!: (route: Route) => Promise<void>;
  const context = {
    on: vi.fn(),
    route: vi.fn(async (_: string, callback: typeof handler) => {
      handler = callback;
    }),
  };
  await installReleaseInspectionRouting(context as unknown as BrowserContext, {
    generationUrl: `https://games.example.test${generationPath}`,
    token,
    requestTimeoutMs: 1234,
  });
  const response = {
    status: 200,
    headers: { "content-type": "text/html" },
    body: Buffer.from("private asset"),
  };
  mocks.fetch.mockResolvedValue(response);
  const route = {
    request: () => ({
      url: () => `https://games.example.test${generationPath}/host`,
      method: () => "GET",
      headers: () => ({
        accept: "text/html",
        authorization: "not-an-asset-credential",
        cookie: "not-an-asset-cookie",
        [RELEASE_INSPECTION_ACCESS_HEADER]: "game-supplied-header",
      }),
    }),
    fetch: vi.fn(),
    fulfill: vi.fn().mockResolvedValue(undefined),
    continue: vi.fn().mockResolvedValue(undefined),
    abort: vi.fn().mockResolvedValue(undefined),
  };
  return { handler, route, response, context };
};

describe("release inspection routing", () => {
  it("uses pinned private fetching without inheriting browser credentials", async () => {
    const { handler, route, response } = await routingFixture();
    await handler(route as unknown as Route);
    expect(mocks.fetch).toHaveBeenCalledWith(
      new URL(`https://games.example.test${generationPath}/host`),
      { accept: "text/html", [RELEASE_INSPECTION_ACCESS_HEADER]: token },
      "GET",
    );
    expect(route.fulfill).toHaveBeenCalledWith(response);
    expect(route.fetch).not.toHaveBeenCalled();
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
      expect(mocks.fetch).not.toHaveBeenCalled();
      expect(route.continue).toHaveBeenCalledWith({
        headers: {
          accept: "text/html",
          authorization: "not-an-asset-credential",
          cookie: "not-an-asset-cookie",
        },
      });
    },
  );
  it("aborts a failed private fetch without exposing secret-bearing errors", async () => {
    const { handler, route } = await routingFixture();
    mocks.fetch.mockRejectedValue(new Error(`transport included ${token}`));
    await expect(handler(route as unknown as Route)).resolves.toBeUndefined();
    expect(route.abort).toHaveBeenCalledWith("failed");
    expect(route.fulfill).not.toHaveBeenCalled();
  });
  it("cancels outstanding private IO when the browser context closes", async () => {
    const { context } = await routingFixture();
    expect(context.on).toHaveBeenCalledWith("close", mocks.close);
  });
});

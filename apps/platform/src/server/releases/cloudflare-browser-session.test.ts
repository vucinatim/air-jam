import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { openCloudflareBrowserSession } from "./cloudflare-browser-session";

const mocks = vi.hoisted(() => ({
  connect: vi.fn(),
  browser: { close: vi.fn() },
  fetch: vi.fn(),
}));
vi.mock("playwright-core", () => ({
  chromium: { connectOverCDP: mocks.connect },
}));

const accountId = "a".repeat(32);
const sessionId = "896339bf-ea39-41ba-bac3-68b16a5e71b4";
const endpoint = `https://api.cloudflare.com/client/v4/accounts/${accountId}/browser-run/devtools/browser`;
const config = { accountId, apiToken: "fixture-secret", timeoutMs: 20_000 };

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubGlobal("fetch", mocks.fetch);
  mocks.fetch.mockImplementation(async (_url, options) =>
    Response.json(
      options.method === "POST" ? { sessionId } : { status: "closed" },
    ),
  );
  mocks.connect.mockResolvedValue(mocks.browser);
  mocks.browser.close.mockResolvedValue(undefined);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("Cloudflare capture session ownership", () => {
  it("uses CDP on the owned API origin and closes exactly its acquired session", async () => {
    const session = await openCloudflareBrowserSession(config);
    expect(mocks.fetch).toHaveBeenCalledWith(`${endpoint}?keep_alive=60000`, {
      method: "POST",
      headers: { authorization: "Bearer fixture-secret" },
      redirect: "error",
      signal: expect.any(AbortSignal),
    });
    expect(mocks.connect).toHaveBeenCalledWith(
      `${endpoint.replace("https:", "wss:")}/${sessionId}`,
      expect.objectContaining({
        headers: { authorization: "Bearer fixture-secret" },
        timeout: expect.any(Number),
      }),
    );
    await Promise.all([session.close(), session.close()]);
    expect(mocks.fetch).toHaveBeenCalledTimes(2);
    expect(mocks.fetch).toHaveBeenLastCalledWith(
      `${endpoint}/${sessionId}`,
      expect.objectContaining({ method: "DELETE", redirect: "error" }),
    );
    expect(mocks.browser.close).toHaveBeenCalledOnce();
  });

  it("ignores a returned debugger URL instead of sending credentials to it", async () => {
    mocks.fetch.mockResolvedValueOnce(
      Response.json({
        success: true,
        result: { sessionId, webSocketDebuggerUrl: "wss://attacker.invalid/" },
      }),
    );
    const session = await openCloudflareBrowserSession(config);
    expect(mocks.connect.mock.calls[0][0]).toBe(
      `${endpoint.replace("https:", "wss:")}/${sessionId}`,
    );
    await session.close();
  });

  it.each([401, 429, 500])(
    "does not connect after acquisition HTTP %s",
    async (status) => {
      mocks.fetch.mockResolvedValueOnce(
        new Response("fixture-secret", { status }),
      );
      await expect(openCloudflareBrowserSession(config)).rejects.toThrow(
        `acquisition returned HTTP ${status}`,
      );
      expect(mocks.connect).not.toHaveBeenCalled();
      expect(mocks.fetch).toHaveBeenCalledOnce();
    },
  );

  it("rejects an invalid session identifier before constructing a connection", async () => {
    mocks.fetch.mockResolvedValueOnce(Response.json({ sessionId: "../other" }));
    await expect(openCloudflareBrowserSession(config)).rejects.toThrow(
      "invalid session",
    );
    expect(mocks.connect).not.toHaveBeenCalled();
  });

  it("deletes the provider session when CDP connection fails without leaking its error", async () => {
    mocks.connect.mockRejectedValue(new Error("fixture-secret in headers"));
    await expect(openCloudflareBrowserSession(config)).rejects.toThrow(
      "Cloudflare browser connection failed.",
    );
    expect(mocks.fetch).toHaveBeenLastCalledWith(
      `${endpoint}/${sessionId}`,
      expect.objectContaining({ method: "DELETE" }),
    );
  });

  it("counts acquisition time against the connection deadline and still cleans up", async () => {
    vi.useFakeTimers();
    mocks.fetch.mockImplementationOnce(async () => {
      vi.setSystemTime(Date.now() + config.timeoutMs);
      return Response.json({ sessionId });
    });
    await expect(openCloudflareBrowserSession(config)).rejects.toThrow(
      "connection failed",
    );
    expect(mocks.connect).not.toHaveBeenCalled();
    expect(mocks.fetch).toHaveBeenCalledTimes(2);
  });

  it("surfaces provider cleanup failure while still closing the CDP connection", async () => {
    const session = await openCloudflareBrowserSession(config);
    mocks.fetch.mockResolvedValueOnce(
      new Response("fixture-secret", { status: 503 }),
    );
    await expect(session.close()).rejects.toThrow("closure returned HTTP 503");
    expect(mocks.browser.close).toHaveBeenCalledOnce();
  });

  it("requires an acknowledged closure rather than treating HTTP success as cleanup", async () => {
    const session = await openCloudflareBrowserSession(config);
    mocks.fetch.mockResolvedValueOnce(Response.json({ status: "active" }));
    await expect(session.close()).rejects.toThrow("not acknowledged");
  });

  it.each([404, 410])(
    "accepts HTTP %s when the owned session is already gone",
    async (status) => {
      const session = await openCloudflareBrowserSession(config);
      mocks.fetch.mockResolvedValueOnce(new Response(null, { status }));
      await session.close();
      expect(mocks.browser.close).toHaveBeenCalledOnce();
    },
  );

  it("bounds local cleanup even when the connection never closes", async () => {
    vi.useFakeTimers();
    const session = await openCloudflareBrowserSession(config);
    mocks.browser.close.mockReturnValue(new Promise(() => undefined));
    const assertion = expect(session.close()).rejects.toThrow(
      "cleanup timed out",
    );
    await vi.advanceTimersByTimeAsync(5000);
    await assertion;
    expect(mocks.fetch).toHaveBeenCalledTimes(2);
  });

  it.each([
    { ...config, accountId: "../../other" },
    { ...config, apiToken: " " },
    { ...config, timeoutMs: 0 },
  ])("rejects invalid configuration before provider IO", async (invalid) => {
    await expect(openCloudflareBrowserSession(invalid)).rejects.toThrow();
    expect(mocks.fetch).not.toHaveBeenCalled();
  });
});

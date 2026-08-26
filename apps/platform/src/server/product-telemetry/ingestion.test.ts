import { __resetRateLimitState } from "@/server/api/rate-limit";
import { afterEach, describe, expect, it, vi } from "vitest";
import { handleProductTelemetryRequest } from "./ingestion";

const NOW = new Date("2026-08-26T12:00:00.000Z");
const EVENT = {
  id: "6b1e5658-46ca-42d1-8a7f-c0961a628b75",
  schemaVersion: 1,
  kind: "page_view",
  occurredAt: NOW.toISOString(),
  anonymousSessionId: "dc27928e-48af-4dd0-ab05-f857e473104c",
  pathname: "/docs/getting-started",
  referrerHost: "claude.ai",
};
const ENV = {
  NODE_ENV: "production",
  RAILWAY_ENVIRONMENT_NAME: "production",
  NEXT_PUBLIC_APP_URL: "https://airjam.io",
};

const makeRequest = ({
  body = JSON.stringify({ events: [EVENT] }),
  headers = {},
}: {
  body?: string;
  headers?: Record<string, string>;
} = {}): Request =>
  new Request("https://airjam.io/api/telemetry", {
    method: "POST",
    body,
    headers: {
      "content-type": "application/json",
      origin: "https://airjam.io",
      "sec-fetch-site": "same-origin",
      "user-agent": "Mozilla/5.0",
      "x-forwarded-for": "203.0.113.9",
      ...headers,
    },
  });

afterEach(() => {
  __resetRateLimitState();
});

describe("product telemetry ingestion request", () => {
  it("accepts a guarded batch and writes only normalized bounded fields", async () => {
    const write = vi.fn().mockResolvedValue({ accepted: 1, duplicates: 0 });
    const response = await handleProductTelemetryRequest({
      request: makeRequest(),
      env: ENV,
      now: NOW,
      write,
    });

    expect(response.status).toBe(202);
    expect(await response.json()).toEqual({ accepted: 1, duplicates: 0 });
    expect(write).toHaveBeenCalledOnce();
    expect(write.mock.calls[0]?.[0]?.[0]).toMatchObject({
      surface: "docs",
      pageKey: "/docs/getting-started",
      actorClass: "human",
      referrerSource: "ai",
      referrerHost: "claude.ai",
      deploymentEnvironment: "production",
    });
    expect(write.mock.calls[0]?.[0]?.[0]).not.toHaveProperty("userAgent");
    expect(write.mock.calls[0]?.[0]?.[0]).not.toHaveProperty("ipAddress");
    expect(write.mock.calls[0]?.[0]?.[0]).not.toHaveProperty("url");
  });

  it.each([
    ["wrong content type", { "content-type": "text/plain" }, 415],
    ["cross-origin request", { origin: "https://attacker.example" }, 403],
    ["missing site context", { "sec-fetch-site": "" }, 403],
    ["oversized declared body", { "content-length": "20000" }, 413],
  ])("rejects %s", async (_label, headers, status) => {
    const write = vi.fn();
    const response = await handleProductTelemetryRequest({
      request: makeRequest({ headers }),
      env: ENV,
      now: NOW,
      write,
    });

    expect(response.status).toBe(status);
    expect(write).not.toHaveBeenCalled();
  });

  it("accepts a same-origin LAN request in development", async () => {
    const write = vi.fn().mockResolvedValue({ accepted: 1, duplicates: 0 });
    const response = await handleProductTelemetryRequest({
      request: new Request("http://192.168.0.33:3000/api/telemetry", {
        method: "POST",
        body: JSON.stringify({ events: [EVENT] }),
        headers: {
          "content-type": "application/json",
          origin: "http://192.168.0.33:3000",
          "sec-fetch-site": "same-origin",
          "user-agent": "Mozilla/5.0",
        },
      }),
      env: { NODE_ENV: "development" },
      now: NOW,
      write,
    });

    expect(response.status).toBe(202);
    expect(write).toHaveBeenCalledOnce();
  });

  it("rejects cross-site requests in development", async () => {
    const write = vi.fn();
    const response = await handleProductTelemetryRequest({
      request: new Request("http://192.168.0.33:3000/api/telemetry", {
        method: "POST",
        body: JSON.stringify({ events: [EVENT] }),
        headers: {
          "content-type": "application/json",
          origin: "http://attacker.example",
          "sec-fetch-site": "cross-site",
        },
      }),
      env: { NODE_ENV: "development" },
      now: NOW,
      write,
    });

    expect(response.status).toBe(403);
    expect(write).not.toHaveBeenCalled();
  });

  it("stops reading an oversized streamed body without relying on Content-Length", async () => {
    const write = vi.fn();
    const response = await handleProductTelemetryRequest({
      request: makeRequest({ body: "x".repeat(20_000) }),
      env: ENV,
      now: NOW,
      write,
    });

    expect(response.status).toBe(413);
    expect(await response.json()).toEqual({ error: "request_too_large" });
    expect(write).not.toHaveBeenCalled();
  });

  it("rejects unknown event kinds and arbitrary payload fields", async () => {
    const response = await handleProductTelemetryRequest({
      request: makeRequest({
        body: JSON.stringify({
          events: [{ ...EVENT, kind: "runtime_session_started", roomId: "x" }],
        }),
      }),
      env: ENV,
      now: NOW,
      write: vi.fn(),
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "invalid_batch" });
  });

  it("rejects occurrence timestamps beyond the explicit skew window", async () => {
    const response = await handleProductTelemetryRequest({
      request: makeRequest({
        body: JSON.stringify({
          events: [
            {
              ...EVENT,
              occurredAt: "2026-08-25T11:59:59.999Z",
            },
          ],
        }),
      }),
      env: ENV,
      now: NOW,
      write: vi.fn(),
    });

    expect(response.status).toBe(422);
    expect(await response.json()).toEqual({
      error: "event_time_out_of_bounds",
    });
  });
});

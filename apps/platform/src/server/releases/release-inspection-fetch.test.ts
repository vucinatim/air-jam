import { MAX_RELEASE_FILE_BYTES } from "@/lib/releases/release-policy";
import { Resolver } from "node:dns/promises";
import { once } from "node:events";
import http, { createServer, type RequestOptions } from "node:http";
import https from "node:https";
import type { AddressInfo } from "node:net";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createReleaseInspectionFetcher } from "./release-inspection-fetch";

const originalRequest = http.request;
beforeEach(() => {
  const unexpected = () => {
    throw new Error("Unexpected non-fixture network request.");
  };
  vi.spyOn(http, "request").mockImplementation(unexpected);
  vi.spyOn(https, "request").mockImplementation(unexpected);
});
afterEach(() => vi.restoreAllMocks());

const fixture = async (onRequest: http.RequestListener) => {
  const server = createServer(onRequest);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const port = (server.address() as AddressInfo).port;
  const dials: RequestOptions[] = [];
  vi.spyOn(Resolver.prototype, "resolve4").mockResolvedValue(["1.1.1.1"]);
  vi.spyOn(Resolver.prototype, "resolve6").mockResolvedValue([]);
  // Redirect only already-policy-approved numeric dials to our owned fixture.
  vi.spyOn(http, "request").mockImplementation(
    (
      options: string | URL | RequestOptions,
      callback?: RequestOptions | ((response: http.IncomingMessage) => void),
    ) => {
      if (typeof callback !== "function")
        throw new Error("Fixture response callback required.");
      dials.push(options as RequestOptions);
      return originalRequest(
        { ...(options as RequestOptions), hostname: "127.0.0.1", port },
        callback,
      );
    },
  );
  const fetcher = createReleaseInspectionFetcher(1000);
  return {
    server,
    dials,
    fetcher,
    close: async () => {
      fetcher.close();
      server.closeAllConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
};

describe("private release asset IO", () => {
  it.each([
    "http://127.0.0.1/asset",
    "http://10.0.0.1/asset",
    "http://169.254.169.254/asset",
    "http://[::1]/asset",
    "http://[::ffff:127.0.0.1]/asset",
  ])("rejects private literal %s without opening a socket", async (url) => {
    const request = vi.spyOn(http, "request");
    const fetcher = createReleaseInspectionFetcher(1000);
    try {
      await expect(fetcher.fetch(new URL(url), {}, "GET")).rejects.toThrow(
        "public addresses",
      );
      expect(request).not.toHaveBeenCalled();
    } finally {
      fetcher.close();
    }
  });

  it.each([
    { addresses: ["10.0.0.1"] },
    { addresses: ["1.1.1.1", "10.0.0.1"] },
    { addresses: [] },
  ])(
    "rejects private, mixed or empty DNS answers $addresses",
    async ({ addresses }) => {
      vi.spyOn(Resolver.prototype, "resolve4").mockResolvedValue(addresses);
      vi.spyOn(Resolver.prototype, "resolve6").mockResolvedValue([]);
      const request = vi.spyOn(http, "request");
      const fetcher = createReleaseInspectionFetcher(1000);
      try {
        await expect(
          fetcher.fetch(new URL("http://assets.example.test/asset"), {}, "GET"),
        ).rejects.toThrow("public addresses");
        expect(request).not.toHaveBeenCalled();
      } finally {
        fetcher.close();
      }
    },
  );

  it("checks IPv6 answers even when IPv4 is public", async () => {
    vi.spyOn(Resolver.prototype, "resolve4").mockResolvedValue(["1.1.1.1"]);
    vi.spyOn(Resolver.prototype, "resolve6").mockResolvedValue(["fc00::1"]);
    const request = vi.spyOn(http, "request");
    const fetcher = createReleaseInspectionFetcher(1000);
    try {
      await expect(
        fetcher.fetch(new URL("http://assets.example.test/asset"), {}, "GET"),
      ).rejects.toThrow("public addresses");
      expect(request).not.toHaveBeenCalled();
    } finally {
      fetcher.close();
    }
  });

  it("pins the original hostname to one validated numeric dial and never follows redirects", async () => {
    const observed: Array<{
      path: string | undefined;
      host: string | undefined;
      token: string | string[] | undefined;
    }> = [];
    const owned = await fixture((request, response) => {
      observed.push({
        path: request.url,
        host: request.headers.host,
        token: request.headers["x-airjam-release-access-token"],
      });
      response.writeHead(302, {
        location: "http://127.0.0.1/private",
        connection: "close, x-hop",
        "x-hop": "removed",
        "set-cookie": "ignored=1",
      });
      response.end("redirect");
    });
    try {
      const result = await owned.fetcher.fetch(
        new URL("http://assets.example.test:8123/generation/asset?q=1"),
        { "x-airjam-release-access-token": "fixture-token" },
        "GET",
      );
      expect(result.status).toBe(302);
      expect(result.headers.location).toBe("http://127.0.0.1/private");
      expect(result.headers).not.toHaveProperty("x-hop");
      expect(result.headers).not.toHaveProperty("set-cookie");
      expect(result.body.toString()).toBe("redirect");
      expect(owned.dials).toHaveLength(1);
      expect(owned.dials[0]).toMatchObject({
        hostname: "1.1.1.1",
        port: "8123",
        agent: false,
        path: "/generation/asset?q=1",
      });
      expect(observed).toEqual([
        {
          path: "/generation/asset?q=1",
          host: "assets.example.test:8123",
          token: "fixture-token",
        },
      ]);
    } finally {
      await owned.close();
    }
  });

  it("binds TLS identity to the original hostname, not the numeric dial", async () => {
    const owned = await fixture((_, response) => response.end("fixture"));
    const encrypted = vi
      .spyOn(https, "request")
      .mockImplementation(
        (
          options: string | URL | RequestOptions,
          callback?:
            | RequestOptions
            | ((response: http.IncomingMessage) => void),
        ) => {
          if (typeof callback !== "function")
            throw new Error("Fixture response callback required.");
          return http.request(
            { ...(options as RequestOptions), protocol: "http:" },
            callback,
          );
        },
      );
    try {
      await owned.fetcher.fetch(
        new URL("https://assets.example.test/asset"),
        {},
        "GET",
      );
      expect(encrypted.mock.calls[0][0]).toMatchObject({
        hostname: "1.1.1.1",
        servername: "assets.example.test",
        rejectUnauthorized: true,
        checkServerIdentity: expect.any(Function),
      });
    } finally {
      await owned.close();
    }
  });

  it("bounds response bytes and cancels sibling requests after exhaustion", async () => {
    const owned = await fixture((_, response) =>
      response.end(Buffer.alloc(MAX_RELEASE_FILE_BYTES + 1)),
    );
    try {
      await expect(
        owned.fetcher.fetch(
          new URL("http://assets.example.test/asset"),
          {},
          "GET",
        ),
      ).rejects.toThrow();
      const before = owned.dials.length;
      await expect(
        owned.fetcher.fetch(
          new URL("http://assets.example.test/another"),
          {},
          "GET",
        ),
      ).rejects.toThrow();
      expect(owned.dials).toHaveLength(before);
    } finally {
      await owned.close();
    }
  });

  it("cancels hung and queued requests when the capture closes", async () => {
    const owned = await fixture(() => undefined);
    try {
      const captures = Array.from({ length: 12 }, (_, index) =>
        owned.fetcher.fetch(
          new URL(`http://assets.example.test/${index}`),
          {},
          "GET",
        ),
      );
      const outcomes = Promise.allSettled(captures);
      await new Promise((resolve) => setTimeout(resolve, 20));
      expect(owned.dials).toHaveLength(8);
      owned.fetcher.close();
      expect(
        (await outcomes).every((outcome) => outcome.status === "rejected"),
      ).toBe(true);
    } finally {
      await owned.close();
    }
  });

  it("times out a hung response", async () => {
    const owned = await fixture(() => undefined);
    const fetcher = createReleaseInspectionFetcher(20);
    try {
      await expect(
        fetcher.fetch(new URL("http://assets.example.test/hung"), {}, "GET"),
      ).rejects.toThrow();
    } finally {
      fetcher.close();
      await owned.close();
    }
  });

  it.each(["POST", "PUT", "DELETE"])(
    "rejects mutable asset method %s",
    async (method) => {
      const fetcher = createReleaseInspectionFetcher(1000);
      try {
        await expect(
          fetcher.fetch(
            new URL("https://assets.example.test/asset"),
            {},
            method,
          ),
        ).rejects.toThrow("Invalid release asset");
      } finally {
        fetcher.close();
      }
    },
  );
});

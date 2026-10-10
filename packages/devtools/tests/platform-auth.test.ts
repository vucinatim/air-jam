import { mkdir, mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

const originalFetch = globalThis.fetch;
const tempRoots: string[] = [];
const servers: Server[] = [];

const sessionFixture = (platformBaseUrl = "https://airjam.example.com") => ({
  version: 1 as const,
  platformBaseUrl,
  clientName: "test",
  storedAt: new Date().toISOString(),
  user: {
    id: "user-1",
    name: "Test",
    email: "test@example.com",
    role: "creator" as const,
  },
  session: {
    id: "session-1",
    token: "private-session-token",
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    createdAt: new Date().toISOString(),
    userAgent: "airjam-cli",
  },
});

const listen = async (server: Server) => {
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("Missing address");
  return `http://127.0.0.1:${address.port}`;
};

const createTempStateDirectory = async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "airjam-platform-auth-"));
  tempRoots.push(root);
  return root;
};

afterEach(async () => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.resetModules();
  vi.useRealTimers();
  globalThis.fetch = originalFetch;

  await Promise.all(
    servers.splice(0).map(
      (server) =>
        new Promise<void>((resolve, reject) => {
          server.closeAllConnections();
          server.close((error) => (error ? reject(error) : resolve()));
        }),
    ),
  );

  await Promise.all(
    tempRoots
      .splice(0, tempRoots.length)
      .map((root) => rm(root, { recursive: true, force: true })),
  );
});

describe("platform auth client", () => {
  it("normalizes platform base urls", async () => {
    const { resolvePlatformBaseUrl } = await import("../src/platform-auth.js");

    expect(resolvePlatformBaseUrl("airjam.example.com")).toBe(
      "https://airjam.example.com",
    );
    expect(resolvePlatformBaseUrl("http://localhost:3000")).toBe(
      "http://localhost:3000",
    );
  });

  it.each([
    ["HTTPS://AIRJAM.EXAMPLE.COM:443/", "https://airjam.example.com"],
    ["localhost:3000", "https://localhost:3000"],
    ["http://127.0.0.2:3000/", "http://127.0.0.2:3000"],
    ["http://[::1]:3000/", "http://[::1]:3000"],
    [
      "https://self-hosted.example/custom/path/",
      "https://self-hosted.example/custom/path",
    ],
  ])("normalizes a valid target %s", async (input, expected) => {
    const { resolvePlatformBaseUrl } = await import("../src/platform-auth.js");
    expect(resolvePlatformBaseUrl(input)).toBe(expected);
  });

  it.each([
    "",
    "   ",
    "https:/invalid.example",
    "not a url",
    "ftp://example.com",
    "http://remote.example",
    "http://localhost.attacker.example",
    "http://127.attacker.example",
    "https://user:secret@example.com",
  ])(
    "rejects invalid or unsafe target %s without network IO",
    async (platformUrl) => {
      const fetchMock = vi.fn();
      globalThis.fetch = fetchMock;
      const { getPlatformMachineProfile } =
        await import("../src/platform-auth.js");
      await expect(
        getPlatformMachineProfile({ platformUrl, token: "explicit-token" }),
      ).rejects.toThrow(/platform URL/);
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );

  it("binds reused credentials to the stored origin before network IO", async () => {
    vi.stubEnv("AIRJAM_STATE_DIR", await createTempStateDirectory());
    const auth = await import("../src/platform-auth.js");
    await auth.writeStoredPlatformMachineSession(sessionFixture());
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock;
    await expect(
      auth.getPlatformMachineProfile({
        platformUrl: "https://attacker.example",
      }),
    ).rejects.toThrow(/different platform origin/);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(
      await auth.resolvePlatformMachineAuth({
        platformUrl: "HTTPS://AIRJAM.EXAMPLE.COM:443/",
      }),
    ).toEqual({
      baseUrl: "https://airjam.example.com",
      token: "private-session-token",
    });
    vi.stubEnv("AIRJAM_PLATFORM_URL", "https://attacker.example");
    expect((await auth.resolvePlatformMachineAuth({})).baseUrl).toBe(
      "https://airjam.example.com",
    );
  });

  it("preserves deliberate explicit-token targets without reusing stored authority", async () => {
    vi.stubEnv("AIRJAM_STATE_DIR", await createTempStateDirectory());
    const auth = await import("../src/platform-auth.js");
    await auth.writeStoredPlatformMachineSession(sessionFixture());
    expect(
      await auth.resolvePlatformMachineAuth({
        platformUrl: "https://self-hosted.example",
        token: " other-token ",
      }),
    ).toEqual({
      baseUrl: "https://self-hosted.example",
      token: "other-token",
    });
  });

  it.each([
    "https://attacker.example/api",
    "//attacker.example/api",
    "https://user:secret@airjam.example.com/api",
  ])(
    "rejects an escaping API pathname %s before network IO",
    async (pathname) => {
      const fetchMock = vi.fn();
      globalThis.fetch = fetchMock;
      const { requestPlatformMachineApi } =
        await import("../src/platform-auth.js");
      await expect(
        requestPlatformMachineApi({
          baseUrl: "https://airjam.example.com",
          pathname,
          token: "secret",
          schema: { parse: (value: unknown) => value },
        }),
      ).rejects.toThrow(/platform origin/);
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );

  it.each(["cross-origin", "same-origin"])(
    "does not follow %s redirects carrying bearer authority or device codes",
    async (redirectKind) => {
      const received: string[] = [];
      const destination = await listen(
        createServer((request, response) => {
          received.push(
            request.headers.authorization ?? request.url ?? "request",
          );
          request.resume();
          response.end("{}");
        }),
      );
      const issuer = await listen(
        createServer((request, response) => {
          request.resume();
          if (request.url === "/capture") {
            received.push("same-origin redirected request");
            response.end("{}");
            return;
          }
          response.writeHead(307, {
            location:
              redirectKind === "same-origin"
                ? "/capture"
                : destination + "/capture",
          });
          response.end();
        }),
      );
      const { requestPlatformMachineApi } =
        await import("../src/platform-auth.js");
      for (const authority of [
        { token: "secret" },
        { body: { deviceCode: "private-device-code" } },
      ]) {
        await expect(
          requestPlatformMachineApi({
            baseUrl: issuer,
            pathname: "/api",
            method: "POST",
            ...authority,
            schema: { parse: (value: unknown) => value },
          }),
        ).rejects.toThrow();
      }
      expect(received).toEqual([]);
    },
  );

  it.each(["https://attacker.example", "HTTPS://AIRJAM.EXAMPLE.COM:443/"])(
    "binds the login response issuer %s before storing",
    async (responseOrigin) => {
      vi.stubEnv("AIRJAM_STATE_DIR", await createTempStateDirectory());
      vi.useFakeTimers();
      const auth = await import("../src/platform-auth.js");
      const fixture = sessionFixture(responseOrigin);
      globalThis.fetch = vi
        .fn()
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              deviceCode: "device-1",
              userCode: "ABCD-EFGH",
              verificationUrl: "https://airjam.example.com/dashboard/cli-auth",
              verificationUriComplete:
                "https://airjam.example.com/dashboard/cli-auth?userCode=ABCD-EFGH",
              expiresAt: new Date(Date.now() + 60000).toISOString(),
              intervalSeconds: 1,
            }),
          ),
        )
        .mockResolvedValueOnce(new Response(JSON.stringify(fixture)));
      const result = auth.loginPlatformWithDeviceFlow({
        platformUrl: "https://airjam.example.com",
      });
      const outcome = responseOrigin.includes("attacker")
        ? expect(result).rejects.toThrow(/login response.*platform origin/)
        : expect(result).resolves.toMatchObject({
            storedSession: { platformBaseUrl: "https://airjam.example.com" },
          });
      await vi.advanceTimersByTimeAsync(1000);
      await outcome;
      const stored = await auth.readStoredPlatformMachineSession();
      if (responseOrigin.includes("attacker")) expect(stored).toBeNull();
      else expect(stored?.platformBaseUrl).toBe("https://airjam.example.com");
    },
  );

  it("runs the device login flow and stores the resulting session", async () => {
    const stateDirectory = await createTempStateDirectory();
    vi.stubEnv("AIRJAM_STATE_DIR", stateDirectory);

    const responses = [
      new Response(
        JSON.stringify({
          deviceCode: "device-1",
          userCode: "ABCD-EFGH",
          verificationUrl: "https://airjam.example.com/dashboard/cli-auth",
          verificationUriComplete:
            "https://airjam.example.com/dashboard/cli-auth?userCode=ABCD-EFGH",
          expiresAt: new Date(Date.now() + 60_000).toISOString(),
          intervalSeconds: 1,
        }),
        { status: 200 },
      ),
      new Response(
        JSON.stringify({
          error: "authorization_pending",
          message: "waiting",
        }),
        { status: 428 },
      ),
      new Response(
        JSON.stringify({
          platformBaseUrl: "https://airjam.example.com",
          user: {
            id: "user_1",
            name: "Tim",
            email: "tim@example.com",
            role: "creator",
          },
          session: {
            id: "session_1",
            token: "token_1",
            expiresAt: new Date(Date.now() + 60_000).toISOString(),
            createdAt: new Date().toISOString(),
            userAgent: "airjam-cli",
          },
        }),
        { status: 200 },
      ),
    ];

    globalThis.fetch = vi.fn(async () => {
      const next = responses.shift();
      if (!next) {
        throw new Error("Unexpected fetch call");
      }
      return next;
    }) as typeof fetch;

    const { loginPlatformWithDeviceFlow, readStoredPlatformMachineSession } =
      await import("../src/platform-auth.js");

    const prompts: string[] = [];
    const result = await loginPlatformWithDeviceFlow({
      platformUrl: "https://airjam.example.com",
      clientName: "qa-runner",
      onPrompt: async (payload) => {
        prompts.push(payload.userCode);
      },
    });

    expect(prompts).toEqual(["ABCD-EFGH"]);
    expect(result.authenticated.user.email).toBe("tim@example.com");

    const stored = await readStoredPlatformMachineSession();
    expect(stored).not.toBeNull();
    expect(stored?.platformBaseUrl).toBe("https://airjam.example.com");
    expect(stored?.session.token).toBe("token_1");
    expect((await stat(path.join(stateDirectory, "auth"))).mode & 0o777).toBe(
      0o700,
    );
    expect(
      (await stat(path.join(stateDirectory, "auth", "platform-session.json")))
        .mode & 0o777,
    ).toBe(0o600);
  });

  it("isolates platform credentials in the configured Air Jam state directory", async () => {
    const stateDirectory = await createTempStateDirectory();
    vi.stubEnv("AIRJAM_STATE_DIR", stateDirectory);

    const { getPlatformAuthStoragePath, resolveAirJamStateDirectory } =
      await import("../src/platform-auth.js");

    expect(resolveAirJamStateDirectory()).toBe(stateDirectory);
    expect(getPlatformAuthStoragePath()).toBe(
      path.join(stateDirectory, "auth", "platform-session.json"),
    );
  });

  it("rejects relative automation state roots", async () => {
    vi.stubEnv("AIRJAM_STATE_DIR", "relative-state");
    const { resolveAirJamStateDirectory } =
      await import("../src/platform-auth.js");

    expect(() => resolveAirJamStateDirectory()).toThrow(
      "AIRJAM_STATE_DIR must be an absolute path.",
    );
  });

  it("classifies corrupt stored sessions without exposing their contents", async () => {
    const stateDirectory = await createTempStateDirectory();
    vi.stubEnv("AIRJAM_STATE_DIR", stateDirectory);
    const authDirectory = path.join(stateDirectory, "auth");
    const sessionPath = path.join(authDirectory, "platform-session.json");
    await mkdir(authDirectory, { recursive: true });
    await writeFile(sessionPath, "not-json-and-secret-token", "utf8");
    const {
      AirJamStoredPlatformSessionError,
      readStoredPlatformMachineSession,
    } = await import("../src/platform-auth.js");

    await expect(readStoredPlatformMachineSession()).rejects.toMatchObject({
      name: AirJamStoredPlatformSessionError.name,
      storagePath: sessionPath,
    });
    await expect(readStoredPlatformMachineSession()).rejects.not.toThrow(
      /secret-token/u,
    );
  });
});

import { mkdir, mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

const originalFetch = globalThis.fetch;
const tempRoots: string[] = [];

const createTempStateDirectory = async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "airjam-platform-auth-"));
  tempRoots.push(root);
  return root;
};

afterEach(async () => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.resetModules();
  globalThis.fetch = originalFetch;

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

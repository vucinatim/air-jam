import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

const originalFetch = globalThis.fetch;
const tempRoots: string[] = [];

const createTempHome = async () => {
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
    const { resolvePlatformBaseUrl } = await import("./platform-auth.js");

    expect(resolvePlatformBaseUrl("airjam.example.com")).toBe(
      "https://airjam.example.com",
    );
    expect(resolvePlatformBaseUrl("http://localhost:3000")).toBe(
      "http://localhost:3000",
    );
  });

  it("runs the device login flow and stores the resulting session", async () => {
    const tempHome = await createTempHome();
    vi.stubEnv("HOME", tempHome);

    const responses = [
      new Response(
        JSON.stringify({
          deviceCode: "device-1",
          userCode: "ABCD-EFGH",
          verificationUrl: "https://airjam.example.com/dashboard/cli-auth",
          verificationUriComplete:
            "https://airjam.example.com/dashboard/cli-auth?userCode=ABCD-EFGH",
          expiresAt: new Date(Date.now() + 60_000).toISOString(),
          intervalSeconds: 0,
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
      await import("./platform-auth.js");

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
  });
});

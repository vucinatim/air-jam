import { afterEach, expect, it, vi } from "vitest";
import { testProfileRequestSchema } from "../src/test-profile-protocol.js";
import "../src/testing.js";
import { fixtureProfile } from "./game-declaration-fixture.js";

const loader = vi.hoisted(() => ({ game: vi.fn(), testing: vi.fn() }));
vi.mock("../src/tooling/load-game.js", () => ({
  loadAirJamGame: loader.game,
  loadAirJamTesting: loader.testing,
}));
afterEach(() => vi.unstubAllGlobals());

it.each([
  ["policy", "model_load_failed"],
  ["evaluator", "Scenario must provide evaluate()."],
] as const)(
  "rejects invalid asynchronous %s initialization",
  async (role, message) => {
    vi.resetModules();
    const response = Promise.withResolvers<unknown>();
    let initialized = false;
    let receive: ((message: unknown) => void) | undefined;
    const originalProcess = process;
    vi.stubGlobal(
      "process",
      new Proxy(originalProcess, {
        get(target, key) {
          if (key === "connected") return true;
          if (key === "send")
            return (value: unknown) => {
              if (initialized) response.resolve(value);
            };
          if (key === "on")
            return (event: string, listener: (message: unknown) => void) => {
              if (event === "message") receive = listener;
              return target;
            };
          return Reflect.get(target, key);
        },
      }),
    );
    loader.game.mockResolvedValue({});
    loader.testing.mockResolvedValue({
      profiles: {
        counter: {
          ...fixtureProfile,
          evaluator: {
            create: async () => ({ evaluate: () => ({ status: "pending" }) }),
          },
          policies: {
            code: {
              label: "Code",
              create: async () => {
                throw new Error("model_load_failed");
              },
            },
          },
        },
      },
    });
    await import("../src/tooling/run-test-profile.js");
    if (!receive)
      throw new Error("Worker did not register its message handler.");
    initialized = true;
    receive(
      testProfileRequestSchema.parse({
        kind: "initialize",
        id: "11111111-1111-4111-8111-111111111111",
        rootDir: "/game",
        configPath: "/game/config.mjs",
        profileId: "counter",
        policyId: "code",
        runKind: "test",
        role,
        seed: 42,
      }),
    );
    expect(await response.promise).toEqual({
      kind: "error",
      id: "11111111-1111-4111-8111-111111111111",
      message,
    });
  },
);

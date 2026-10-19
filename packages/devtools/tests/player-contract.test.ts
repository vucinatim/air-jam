import type { HostObservation } from "@air-jam/sdk/runtime-control";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { takeDecisionProviderFromEnvironment } from "../src/decision-provider.js";
import {
  airJamPolicyDecisionSchema,
  createAirJamPlayerPolicy,
  type AirJamPlayerContract,
} from "../src/testing.js";

const observation = { snapshot: { count: 2 } } as unknown as HostObservation;
const configured = (environment: NodeJS.ProcessEnv) => {
  const provider = takeDecisionProviderFromEnvironment(environment);
  if (!provider) throw new Error("Expected a configured decision provider.");
  return provider;
};
const counter = {
  brief:
    "A shared counter. Each player taps until their own count reaches six.",
  turn: ({ observation }) => {
    const count = Number(observation.snapshot.count);
    if (count >= 10) return null;
    return {
      state: [`My count is ${count}.`],
      question: "Should I tap now?",
      options: {
        tap: {
          when: "My count is below six.",
          control: { kind: "action", actionId: "tap" },
        },
        wait: {
          when: "My count has reached six.",
          control: { kind: "input", input: { direction: 0 } },
        },
      },
    };
  },
} satisfies AirJamPlayerContract;

describe("player contract", () => {
  it("asks with the brief ahead of the described state, as a valid decision", async () => {
    const decider = await createAirJamPlayerPolicy(counter).create({
      seatId: "first",
      random: Math.random,
    });
    const decision = airJamPolicyDecisionSchema.parse(
      await decider.decide({
        observation,
        seatId: "first",
        intent: null,
        step: 1,
        elapsedMs: 0,
        receipts: [],
      }),
    );
    expect(decision).toEqual({
      ask: {
        state: [counter.brief, "My count is 2."],
        question: "Should I tap now?",
        options: expect.objectContaining({ tap: expect.any(Object) }),
      },
    });
  });

  it("puts the seat's current goal right after the brief", async () => {
    const decider = await createAirJamPlayerPolicy(counter).create({
      seatId: "first",
      random: Math.random,
    });
    const decision = await decider.decide({
      observation,
      seatId: "first",
      intent: "Stop at four taps.",
      step: 1,
      elapsedMs: 0,
      receipts: [],
    });
    expect("ask" in decision && decision.ask.state).toEqual([
      counter.brief,
      "My goal right now: Stop at four taps.",
      "My count is 2.",
    ]);
  });

  it("refuses a turn too long to take a goal line, even before any steering", async () => {
    const decider = await createAirJamPlayerPolicy({
      ...counter,
      turn: () => ({
        ...counter.turn({ observation }),
        state: Array.from({ length: 31 }, (_, index) => `Line ${index}.`),
      }),
    }).create({ seatId: "first", random: Math.random });
    expect(() =>
      decider.decide({
        observation,
        seatId: "first",
        intent: null,
        step: 1,
        elapsedMs: 0,
        receipts: [],
      }),
    ).toThrow("at most 30 state lines");
  });

  it("releases a seat with nothing to decide", async () => {
    const decider = await createAirJamPlayerPolicy(counter).create({
      seatId: "first",
      random: Math.random,
    });
    expect(
      await decider.decide({
        observation: { snapshot: { count: 12 } } as unknown as HostObservation,
        seatId: "first",
        intent: null,
        step: 1,
        elapsedMs: 0,
        receipts: [],
      }),
    ).toEqual({ control: { kind: "release" } });
  });

  it("refuses an empty brief and questions that offer one option or mix control with asking", () => {
    expect(() =>
      createAirJamPlayerPolicy({ brief: "", turn: () => null }),
    ).toThrow();
    const single = {
      ask: {
        state: ["x"],
        question: "?",
        options: {
          tap: { when: "always", control: { kind: "action", actionId: "tap" } },
        },
      },
    };
    expect(airJamPolicyDecisionSchema.safeParse(single).success).toBe(false);
    expect(
      airJamPolicyDecisionSchema.safeParse({
        control: { kind: "release" },
        ask: { state: ["x"], question: "?", options: {} },
      }).success,
    ).toBe(false);
  });

  it("offers doing nothing as an ordinary option", () => {
    expect(
      airJamPolicyDecisionSchema.safeParse({
        ask: {
          state: ["x"],
          question: "?",
          options: {
            wait: { when: "Done tapping.", control: { kind: "release" } },
            tap: {
              when: "Still tapping.",
              control: { kind: "action", actionId: "tap" },
            },
          },
        },
      }).success,
    ).toBe(true);
  });
});

describe("decision provider", () => {
  const servers: Array<ReturnType<typeof createServer>> = [];
  afterEach(async () => {
    await Promise.all(
      servers
        .splice(0)
        .map((server) => new Promise((resolve) => server.close(resolve))),
    );
  });
  const serve = async (
    respond: (body: unknown, authorization?: string) => [number, unknown],
  ) => {
    const server = createServer((request, response) => {
      let body = "";
      request.on("data", (chunk) => (body += chunk));
      request.on("end", () => {
        const [status, payload] = respond(
          JSON.parse(body),
          request.headers.authorization,
        );
        response.writeHead(status, { "content-type": "application/json" });
        response.end(JSON.stringify(payload));
      });
    });
    servers.push(server);
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve),
    );
    return `http://127.0.0.1:${(server.address() as AddressInfo).port}/decisions`;
  };
  const question = {
    state: ["A shared counter.", "My count is 2."],
    question: "Should I tap now?",
    options: {
      tap: {
        when: "My count is below six.",
        control: { kind: "action" as const, actionId: "tap" },
      },
      wait: {
        when: "My count has reached six.",
        control: { kind: "action" as const, actionId: "wait" },
      },
    },
  };

  it("is absent until an endpoint is configured, and requires a model with it", () => {
    expect(takeDecisionProviderFromEnvironment({})).toBeUndefined();
    const environment: NodeJS.ProcessEnv = {
      AIRJAM_DECISIONS_ENDPOINT: "http://127.0.0.1/decisions",
      AIRJAM_DECISIONS_MODEL: "typesafe/jev-1.13",
      AIRJAM_DECISIONS_TOKEN: "secret-token",
      PATH: "/usr/bin",
    };
    takeDecisionProviderFromEnvironment(environment);
    // Nothing the run owner spawns afterwards can inherit the credential.
    expect(environment).toEqual({ PATH: "/usr/bin" });
    expect(
      configured({
        AIRJAM_DECISIONS_ENDPOINT: "http://127.0.0.1/decisions",
        AIRJAM_DECISIONS_MODEL: "typesafe/jev-1.13",
      }).model,
    ).toBe("typesafe/jev-1.13");
    expect(() =>
      takeDecisionProviderFromEnvironment({
        AIRJAM_DECISIONS_ENDPOINT: "http://127.0.0.1/decisions",
      }),
    ).toThrow("AIRJAM_DECISIONS_MODEL");
  });

  it("sends the typed choice in the Decisions API shape and returns the model's answer", async () => {
    let received: unknown;
    let authorization: string | undefined;
    const endpoint = await serve((body, header) => {
      received = body;
      authorization = header;
      return [
        200,
        { answers: { decision: { choice: "tap", confidence: 0.9 } } },
      ];
    });
    const provider = configured({
      AIRJAM_DECISIONS_ENDPOINT: endpoint,
      AIRJAM_DECISIONS_MODEL: "typesafe/jev-1.13",
      AIRJAM_DECISIONS_TOKEN: "local-token",
    });
    await expect(
      provider.ask(question, new AbortController().signal),
    ).resolves.toEqual({
      choice: "tap",
      confidence: 0.9,
    });
    expect(authorization).toBe("Bearer local-token");
    expect(received).toEqual({
      model: "typesafe/jev-1.13",
      state: question.state,
      questions: {
        decision: {
          type: "choice",
          instructions: "Should I tap now?",
          criteria: {
            tap: "My count is below six.",
            wait: "My count has reached six.",
          },
        },
      },
    });
  });

  it("rejects a failed or choiceless answer for the run owner to classify", async () => {
    const failing = await serve(() => [503, { error: "busy" }]);
    const empty = await serve(() => [200, { answers: {} }]);
    for (const endpoint of [failing, empty]) {
      const provider = configured({
        AIRJAM_DECISIONS_ENDPOINT: endpoint,
        AIRJAM_DECISIONS_MODEL: "model",
      });
      await expect(
        provider.ask(question, new AbortController().signal),
      ).rejects.toThrow(/HTTP 503|no choice/);
    }
  });
});

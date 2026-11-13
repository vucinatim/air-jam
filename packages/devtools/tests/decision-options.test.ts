import { afterEach, expect, it, vi } from "vitest";
import { takeDecisionProviderFromEnvironment } from "../src/decision-provider";
import {
  airJamDecisionQuestionSchema,
  type AirJamDecisionQuestion,
} from "../src/testing";

afterEach(() => vi.unstubAllGlobals());

const question: AirJamDecisionQuestion = {
  state: ["The round ended."],
  question: "What next?",
  options: {
    "Play again!": { when: "Another round.", control: { kind: "release" } },
    "2.move.left/←": { when: "Move instead.", control: { kind: "release" } },
  },
};

it("accepts string option names and keeps wire ids out of the game contract", async () => {
  expect(airJamDecisionQuestionSchema.parse(question)).toEqual(question);
  const fetch = vi.fn().mockResolvedValue(
    new Response(
      JSON.stringify({
        answers: { decision: { choice: "option_1", confidence: 0.9 } },
      }),
    ),
  );
  vi.stubGlobal("fetch", fetch);
  const provider = takeDecisionProviderFromEnvironment({
    AIRJAM_DECISIONS_ENDPOINT: "https://decisions.test",
    AIRJAM_DECISIONS_MODEL: "test",
  });
  if (!provider) throw new Error("Expected a decision provider.");
  await expect(
    provider.ask(question, new AbortController().signal),
  ).resolves.toEqual({ choice: "2.move.left/←", confidence: 0.9 });
  expect(
    JSON.parse(fetch.mock.calls[0][1].body).questions.decision.criteria,
  ).toEqual({ option_0: "Another round.", option_1: "Move instead." });
});

it("rejects an empty option name with a readable rule", () => {
  expect(() =>
    airJamDecisionQuestionSchema.parse({
      ...question,
      options: {
        ...question.options,
        "": { when: "Invalid", control: { kind: "release" } },
      },
    }),
  ).toThrow("A decision option key must not be empty.");
});

it("rejects a question with no options", () => {
  expect(() =>
    airJamDecisionQuestionSchema.parse({ ...question, options: {} }),
  ).toThrow("A decision offers between 1 and 16 options.");
});

it("rejects an unoffered wire choice instead of leaking it into game actions", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          answers: { decision: { choice: "Play again!", confidence: 1 } },
        }),
      ),
    ),
  );
  const provider = takeDecisionProviderFromEnvironment({
    AIRJAM_DECISIONS_ENDPOINT: "https://decisions.test",
    AIRJAM_DECISIONS_MODEL: "test",
  });
  if (!provider) throw new Error("Expected a decision provider.");
  await expect(
    provider.ask(question, new AbortController().signal),
  ).rejects.toThrow('Decision model returned unknown choice "Play again!".');
});

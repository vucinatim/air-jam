import { z } from "zod";
import { readBoundedText } from "./bounded-response.js";
import type { AirJamDecisionQuestion } from "./testing.js";

export type DecisionAnswer = { choice: string; confidence: number };
/** The run's decision model, named so every answer can be tied to it. */
export type DecisionProvider = {
  model: string;
  ask: (
    question: AirJamDecisionQuestion,
    signal: AbortSignal,
  ) => Promise<DecisionAnswer>;
};

const MAX_RESPONSE_BYTES = 262_144;
const responseSchema = z.object({
  answers: z.object({
    decision: z.looseObject({
      choice: z.string().min(1),
      confidence: z.number().min(0).max(1),
    }),
  }),
});

/**
 * A typed decision model reached through the Decisions API shape these models
 * share (OpenRouter's, which Jev serves). It is configured only for the run
 * owner, so game code and policy processes never see its credential; Studio
 * points it at a gateway that adds the credential itself.
 */
export function createDecisionProviderFromEnvironment(
  environment: NodeJS.ProcessEnv = process.env,
): DecisionProvider | undefined {
  const endpoint = environment.AIRJAM_DECISIONS_ENDPOINT?.trim();
  if (!endpoint) return undefined;
  const model = environment.AIRJAM_DECISIONS_MODEL?.trim();
  if (!model)
    throw new Error(
      "Configure AIRJAM_DECISIONS_MODEL alongside AIRJAM_DECISIONS_ENDPOINT.",
    );
  const url = new URL(endpoint);
  const token = environment.AIRJAM_DECISIONS_TOKEN?.trim();
  const ask: DecisionProvider["ask"] = async (question, signal) => {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        model,
        state: question.state,
        questions: {
          decision: {
            type: "choice",
            instructions: question.question,
            criteria: Object.fromEntries(
              Object.entries(question.options).map(([option, { when }]) => [
                option,
                when,
              ]),
            ),
          },
        },
      }),
      signal,
      redirect: "error",
    });
    if (!response.ok) {
      await response.body?.cancel();
      throw new Error(`Decision model returned HTTP ${response.status}.`);
    }
    const parsed = responseSchema.safeParse(
      JSON.parse(
        response.body
          ? await readBoundedText(response.body, MAX_RESPONSE_BYTES)
          : "null",
      ),
    );
    if (!parsed.success) throw new Error("Decision model returned no choice.");
    return {
      choice: parsed.data.answers.decision.choice,
      confidence: parsed.data.answers.decision.confidence,
    };
  };
  return { model, ask };
}

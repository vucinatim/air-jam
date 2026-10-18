import { z } from "zod";
import type { AirJamDecisionQuestion } from "./testing.js";

export type AirJamDecisionAnswer = { choice: string; confidence: number };
export type AirJamDecisionProvider = (
  question: AirJamDecisionQuestion,
  signal: AbortSignal,
) => Promise<AirJamDecisionAnswer>;

const MAX_RESPONSE_BYTES = 262_144;
const responseSchema = z.object({
  answers: z.object({
    decision: z.looseObject({
      choice: z.string().min(1),
      confidence: z.number().min(0).max(1),
    }),
  }),
});

async function readBounded(response: Response) {
  const reader = response.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > MAX_RESPONSE_BYTES)
        throw new Error("decision_failed: Decision response is too large.");
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks).toString("utf8");
}

/**
 * A typed decision model reached through the Decisions API shape these models
 * share (OpenRouter's, which Jev serves). It is configured only for the run
 * owner, so game code and policy processes never see its credential; Studio
 * points it at a gateway that adds the credential itself.
 */
export function createDecisionProviderFromEnvironment(
  environment: NodeJS.ProcessEnv = process.env,
): AirJamDecisionProvider | undefined {
  const endpoint = environment.AIRJAM_DECISIONS_ENDPOINT?.trim();
  if (!endpoint) return undefined;
  const model = environment.AIRJAM_DECISIONS_MODEL?.trim();
  if (!model)
    throw new Error(
      "Configure AIRJAM_DECISIONS_MODEL alongside AIRJAM_DECISIONS_ENDPOINT.",
    );
  const url = new URL(endpoint);
  const token = environment.AIRJAM_DECISIONS_TOKEN?.trim();
  return async (question, signal) => {
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
    const body = await readBounded(response);
    if (!response.ok)
      throw new Error(
        `decision_failed: Decision model returned HTTP ${response.status}.`,
      );
    const parsed = responseSchema.safeParse(JSON.parse(body));
    if (!parsed.success)
      throw new Error("decision_failed: Decision model returned no choice.");
    return {
      choice: parsed.data.answers.decision.choice,
      confidence: parsed.data.answers.decision.confidence,
    };
  };
}

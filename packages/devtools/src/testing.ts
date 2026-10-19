import {
  controllerLeasedControlAckSchema,
  controllerLeasedControlSchema,
  participantActionOperationSchema,
  participantInputOperationSchema,
  participantReleaseOperationSchema,
} from "@air-jam/sdk/protocol";
import type { HostObservation } from "@air-jam/sdk/runtime-control";
import { z } from "zod";
import type { policyArtifactReceiptSchema } from "./policy-artifact-contract.js";
import { policyArtifactPathSchema } from "./policy-artifact-contract.js";

const id = z.string().regex(/^[a-z][a-z0-9_-]{0,63}$/);
export const airJamTestProfileDescriptionSchema = z
  .object({
    id,
    label: z.string().min(1).max(120),
    targets: z
      .array(z.enum(["owned", "current"]))
      .min(1)
      .max(2),
    seats: z
      .array(z.object({ id, label: z.string().min(1).max(80) }).strict())
      .min(1)
      .max(8),
    setup: z
      .array(
        z.discriminatedUnion("lane", [
          z
            .object({
              lane: z.literal("host"),
              actionId: participantActionOperationSchema.shape.actionId,
              input: z.json().optional(),
            })
            .strict(),
          z
            .object({
              lane: z.literal("participant"),
              seatId: id,
              actionId: participantActionOperationSchema.shape.actionId,
              input: z.json().optional(),
            })
            .strict(),
        ]),
      )
      .max(32),
    actions: z.array(participantActionOperationSchema.shape.actionId).max(64),
    scope: z.enum(["player", "diagnostic"]),
    includeImage: z.boolean(),
    timing: z
      .object({
        intervalMs: z.number().int().min(20).max(5000),
        decisionMs: z.number().int().min(50).max(1500),
        inputTtlMs: participantInputOperationSchema.shape.ttlMs,
      })
      .strict(),
    policies: z
      .array(
        z
          .object({
            id,
            label: z.string().min(1).max(120),
            artifacts: policyArtifactPathSchema.optional(),
          })
          .strict(),
      )
      .min(1)
      .max(16),
    metrics: z
      .array(z.object({ id, label: z.string().min(1).max(120) }).strict())
      .max(16),
  })
  .strict();
export type AirJamTestProfileDescription = z.infer<
  typeof airJamTestProfileDescriptionSchema
>;

const byteLength = (value: unknown) =>
  new TextEncoder().encode(JSON.stringify(value)).byteLength;
const policyDiagnosticsSchema = z
  .record(id, z.union([z.string().max(160), z.number().finite(), z.boolean()]))
  .refine(
    (value) => Object.keys(value).length <= 16 && byteLength(value) <= 1024,
    "Policy diagnostics exceed 1 KiB or 16 entries.",
  );
const playControlSchema = z.discriminatedUnion("kind", [
  participantReleaseOperationSchema,
  participantInputOperationSchema.omit({ deadlineMs: true, ttlMs: true }),
  participantActionOperationSchema.omit({ deadlineMs: true }),
]);
export type AirJamPlayControl = z.infer<typeof playControlSchema>;

/**
 * A choice handed to the run's decision model. Every option is an ordinary
 * play control (an input, an action, or doing nothing), so the model can only
 * ever pick among controls the game already accepts. The size bound keeps the
 * question inside the fast context of current typed decision models.
 */
export const airJamDecisionQuestionSchema = z
  .object({
    state: z.array(z.string().min(1).max(8000)).min(1).max(32),
    question: z.string().min(1).max(1000),
    options: z
      .record(
        id,
        z
          .object({
            when: z.string().min(1).max(500),
            control: playControlSchema,
          })
          .strict(),
      )
      .refine((options) => {
        const count = Object.keys(options).length;
        return count >= 2 && count <= 16;
      }, "A decision offers between 2 and 16 options."),
  })
  .strict();
export type AirJamDecisionQuestion = z.infer<
  typeof airJamDecisionQuestionSchema
>;

export const airJamPolicyDecisionSchema = z.union([
  z
    .object({
      diagnostics: policyDiagnosticsSchema.optional(),
      control: playControlSchema,
    })
    .strict()
    .refine(
      (value) => byteLength(value) <= 16_000,
      "Policy decision exceeds 16 KB.",
    ),
  z
    .object({
      diagnostics: policyDiagnosticsSchema.optional(),
      ask: airJamDecisionQuestionSchema,
    })
    .strict()
    .refine(
      (value) => byteLength(value) <= 32_000,
      "Decision question exceeds 32 KB.",
    ),
]);
export type AirJamPolicyDecision = z.infer<typeof airJamPolicyDecisionSchema>;

export const airJamRunReceiptSchema = z
  .object({
    index: z.number().int().positive(),
    seatId: z.string(),
    phase: z.enum(["setup", "play", "cleanup"]),
    sequence: z.number().int().positive(),
    attempts: z.union([z.literal(1), z.literal(2)]),
    operation: controllerLeasedControlSchema.shape.operation,
    acknowledgement: controllerLeasedControlAckSchema,
  })
  .strict();
export type AirJamRunReceipt = z.infer<typeof airJamRunReceiptSchema>;

export const airJamScenarioVerdictSchema = z
  .object({
    status: z.enum(["pending", "passed", "failed"]),
    message: z.string().min(1).max(1000).optional(),
    metrics: z.record(id, z.number().finite()).optional(),
  })
  .strict();
export type AirJamScenarioVerdict = z.infer<typeof airJamScenarioVerdictSchema>;
export type AirJamScenarioSample = {
  phase: "play" | "final";
  observation: HostObservation;
  seats: Array<{ seatId: string; controllerId: string }>;
  receipts: AirJamRunReceipt[];
  elapsedMs: number;
};

export type AirJamPolicyStep = {
  observation: HostObservation;
  seatId: string;
  /** What this seat is currently trying to do, if anyone has said. */
  intent: string | null;
  /** The decision model's answer to this seat's latest question, if any. */
  answer: { choice: string; confidence: number } | null;
  step: number;
  elapsedMs: number;
  receipts: AirJamRunReceipt[];
};
export type AirJamPolicyDecider = {
  decide: (
    step: AirJamPolicyStep,
  ) => AirJamPolicyDecision | Promise<AirJamPolicyDecision>;
};
export type AirJamTestPolicy = {
  label: string;
  artifacts?: string;
  create: (context: {
    seatId: string;
    random: () => number;
    artifacts?: {
      directory: string;
      receipt: z.infer<typeof policyArtifactReceiptSchema>;
    };
  }) => AirJamPolicyDecider | Promise<AirJamPolicyDecider>;
};
export const policyPreparationSchema = z
  .array(
    z
      .object({
        seatId: z.string(),
        prepareMs: z.number().finite().nonnegative(),
      })
      .strict(),
  )
  .max(8);
export type AirJamTestProfile = Omit<
  AirJamTestProfileDescription,
  "id" | "policies"
> & {
  policies: Record<string, AirJamTestPolicy>;
  evaluator: {
    create: (context: { seats: readonly string[] }) => {
      evaluate: (sample: AirJamScenarioSample) => AirJamScenarioVerdict;
    };
  };
};

export function describeAirJamTestProfiles(
  profiles: Record<string, AirJamTestProfile>,
) {
  return Object.entries(profiles).map(([profileId, profile]) => {
    const { evaluator, ...metadata } = profile;
    if (typeof evaluator?.create !== "function")
      throw new Error("A scenario must create an independent evaluator.");
    for (const policy of Object.values(profile.policies)) {
      if (typeof policy.create !== "function")
        throw new Error("A test policy must create a decision function.");
    }
    const description = airJamTestProfileDescriptionSchema.parse({
      ...metadata,
      id: profileId,
      policies: Object.entries(profile.policies).map(([policyId, policy]) => ({
        id: policyId,
        label: policy.label,
        ...(policy.artifacts === undefined
          ? {}
          : { artifacts: policy.artifacts }),
      })),
    });
    const seats = new Set(description.seats.map((seat) => seat.id));
    if (seats.size !== description.seats.length)
      throw new Error(`Duplicate seats in profile ${profileId}.`);
    if (
      new Set(description.metrics.map((metric) => metric.id)).size !==
      description.metrics.length
    )
      throw new Error(`Duplicate metrics in profile ${profileId}.`);
    if (description.timing.inputTtlMs < description.timing.intervalMs)
      throw new Error("Input lifetime must cover the round interval.");
    for (const setup of description.setup) {
      if (setup.lane === "participant" && !seats.has(setup.seatId))
        throw new Error(`Unknown setup seat ${setup.seatId}.`);
    }
    if (
      description.targets.includes("current") &&
      (description.seats.length !== 1 ||
        description.scope !== "player" ||
        description.setup.some((setup) => setup.lane === "host"))
    ) {
      throw new Error(
        "Current-room profiles require one seat, player observations and participant-only setup.",
      );
    }
    return description;
  });
}

export function defineAirJamTestProfiles<
  const T extends Record<string, AirJamTestProfile>,
>(profiles: T): T {
  describeAirJamTestProfiles(profiles);
  return profiles;
}

/**
 * How a game is played by a typed decision model, written by whoever writes the
 * game. The brief explains the game to a reader who has never seen it; each
 * turn describes the current state in words and offers choices that resolve to
 * the game's own inputs or actions. A seat with nothing to decide returns null.
 */
export type AirJamPlayerContract = {
  brief: string;
  turn: (context: {
    observation: HostObservation;
    seatId: string;
  }) => AirJamDecisionQuestion | null;
  /**
   * For games that need control faster than a model answers. Between
   * questions the seat keeps acting on the model's last choice at the run's
   * step rate, and is asked again after `rethinkMs`, when its goal changes or
   * when that choice is no longer offered. Without it every step asks.
   */
  act?: {
    rethinkMs: number;
    control: (context: {
      observation: HostObservation;
      seatId: string;
      choice: string;
    }) => AirJamPlayControl | null;
  };
};

/**
 * A test policy that plays every seat through the run's decision model. The
 * brief and any seat intent lead every question, so a turn may describe at
 * most 30 state lines.
 */
export function createAirJamPlayerPolicy(
  contract: AirJamPlayerContract,
): AirJamTestPolicy {
  airJamDecisionQuestionSchema.shape.state.element.parse(contract.brief);
  if (typeof contract.turn !== "function")
    throw new Error("A player contract must describe each turn.");
  const act = contract.act;
  if (
    act &&
    (!Number.isInteger(act.rethinkMs) ||
      act.rethinkMs < 1 ||
      typeof act.control !== "function")
  )
    throw new Error(
      "A player contract's act needs a positive whole rethinkMs and a control.",
    );
  return {
    label: "Decision model",
    create: () => {
      let asked: { atMs: number; intent: string | null } | undefined;
      return {
        decide: ({ observation, seatId, intent, answer, elapsedMs }) => {
          const turn = contract.turn({ observation, seatId });
          if (!turn) return { control: { kind: "release" } };
          if (
            act &&
            asked &&
            answer &&
            Object.hasOwn(turn.options, answer.choice) &&
            asked.intent === intent &&
            elapsedMs - asked.atMs < act.rethinkMs
          )
            return {
              control: act.control({
                observation,
                seatId,
                choice: answer.choice,
              }) ?? { kind: "release" },
            };
          asked = { atMs: elapsedMs, intent };
          return {
            ask: {
              ...turn,
              state: [
                contract.brief,
                ...(intent ? [`My goal right now: ${intent}`] : []),
                ...turn.state,
              ],
            },
          };
        },
      };
    },
  };
}

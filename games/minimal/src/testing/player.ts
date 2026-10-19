import type { AirJamPlayerContract } from "@air-jam/devtools/testing";
import { z } from "zod";

/** How many taps each player aims for in the starter's test scenarios. */
export const TARGET_TAPS = 6;

const snapshotSchema = z.object({
  perPlayerCounts: z.record(z.string(), z.number().int().nonnegative()),
});

/** The starter counter as a person would be told it. */
export const minimalPlayer = {
  brief: [
    "This is a shared tap counter on a shared screen.",
    "Every player has a phone with one Tap button, and each tap adds one to that player's own count and to the shared total.",
    `Each player's goal is to tap until their own count reaches exactly ${TARGET_TAPS}, then stop tapping.`,
  ].join(" "),
  turn: ({ observation }) => {
    const { perPlayerCounts } = snapshotSchema.parse(observation.snapshot);
    const mine = observation.controllerId
      ? (perPlayerCounts[observation.controllerId] ?? 0)
      : 0;
    return {
      state: [`My own count is ${mine}.`],
      question: "Should I tap now?",
      options: {
        tap: {
          when: `My own count is below ${TARGET_TAPS}.`,
          control: { kind: "action", actionId: "tap" },
        },
        wait: {
          when: `My own count has already reached ${TARGET_TAPS}.`,
          control: { kind: "release" },
        },
      },
    };
  },
} satisfies AirJamPlayerContract;

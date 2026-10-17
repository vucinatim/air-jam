import {
  defineAirJamTestProfiles,
  type AirJamTestPolicy,
} from "@air-jam/devtools/testing";
import { z } from "zod";

const snapshotSchema = z.object({
  totalCount: z.number().int().nonnegative(),
  perPlayerCounts: z.record(z.string(), z.number().int().nonnegative()),
});
function tapPolicy(randomized: boolean): AirJamTestPolicy {
  return {
    label: randomized ? "Random taps" : "Six taps each",
    create: ({ random }) => {
      let taps = 0;
      return {
        decide: ({ receipts }) => {
          for (const receipt of receipts) {
            const acknowledgement = receipt.acknowledgement;
            if (
              receipt.phase === "play" &&
              receipt.operation.kind === "action" &&
              receipt.operation.actionId === "tap" &&
              acknowledgement.status === "applied" &&
              acknowledgement.operation.kind === "action" &&
              acknowledgement.operation.result.ok
            )
              taps++;
          }
          return {
            control:
              taps >= 6 || (randomized && random() < 0.35)
                ? { kind: "release" }
                : { kind: "action", actionId: "tap" },
          };
        },
      };
    },
  };
}
export const testProfiles = defineAirJamTestProfiles({
  cooperative: {
    label: "Tap alongside the creator",
    targets: ["current"],
    seats: [{ id: "player", label: "Agent" }],
    setup: [],
    actions: ["tap"],
    scope: "player",
    includeImage: false,
    timing: { intervalMs: 500, decisionMs: 300, inputTtlMs: 750 },
    metrics: [{ id: "agent_taps", label: "Agent taps" }],
    policies: { code: tapPolicy(false), random: tapPolicy(true) },
    evaluator: {
      create: () => ({
        evaluate: ({ observation, seats }) => ({
          status: "pending",
          message:
            "Observed alongside human players; not an isolated counter proof.",
          metrics: {
            agent_taps:
              snapshotSchema.parse(observation.snapshot).perPlayerCounts[
                seats[0].controllerId
              ] ?? 0,
          },
        }),
      }),
    },
  },
  counter: {
    label: "Shared counter and two-player attribution",
    targets: ["owned"],
    seats: [
      { id: "first", label: "First counter player" },
      { id: "second", label: "Second counter player" },
    ],
    setup: [
      { lane: "participant", seatId: "first", actionId: "reset_counter" },
    ],
    actions: ["tap"],
    scope: "diagnostic",
    includeImage: false,
    timing: { intervalMs: 100, decisionMs: 300, inputTtlMs: 500 },
    metrics: [
      { id: "first_taps", label: "First player taps" },
      { id: "second_taps", label: "Second player taps" },
    ],
    policies: { code: tapPolicy(false), random: tapPolicy(true) },
    evaluator: {
      create: ({ seats: seatIds }) => {
        const taps = new Map(seatIds.map((id) => [id, 0]));
        return {
          evaluate: ({ observation, seats, receipts }) => {
            for (const receipt of receipts) {
              const acknowledgement = receipt.acknowledgement;
              if (acknowledgement.status === "unconfirmed")
                return {
                  status: "failed",
                  message: "An effect has no confirmed result.",
                };
              if (
                receipt.phase === "play" &&
                receipt.operation.kind === "action" &&
                receipt.operation.actionId === "tap" &&
                acknowledgement.status === "applied" &&
                acknowledgement.operation.kind === "action" &&
                acknowledgement.operation.result.ok
              )
                taps.set(receipt.seatId, (taps.get(receipt.seatId) ?? 0) + 1);
            }
            const snapshot = snapshotSchema.parse(observation.snapshot);
            const expectedTotal = [...taps.values()].reduce(
              (sum, count) => sum + count,
              0,
            );
            if (
              snapshot.totalCount !== expectedTotal ||
              seats.some(
                (seat) =>
                  (snapshot.perPlayerCounts[seat.controllerId] ?? 0) !==
                  taps.get(seat.seatId),
              ) ||
              Object.entries(snapshot.perPlayerCounts).some(
                ([id, count]) =>
                  count > 0 && !seats.some((seat) => seat.controllerId === id),
              )
            )
              return {
                status: "failed",
                message:
                  "Shared count or player attribution differs from the acknowledged player taps.",
              };
            const metrics = Object.fromEntries(
              seatIds.map((id) => [`${id}_taps`, taps.get(id) ?? 0]),
            );
            return {
              status: [...taps.values()].every((count) => count >= 6)
                ? "passed"
                : "pending",
              message:
                "Both players' taps match their own counts and the shared total.",
              metrics,
            };
          },
        };
      },
    },
  },
});

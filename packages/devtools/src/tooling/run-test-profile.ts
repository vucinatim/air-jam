import {
  TEST_PROFILE_IPC_MAX_BYTES,
  createPolicyRandom,
  testProfileRequestSchema,
  type TestProfileResponse,
} from "../test-profile-protocol.js";
import {
  airJamPolicyDecisionSchema,
  airJamScenarioVerdictSchema,
  describeAirJamTestProfiles,
  policyPreparationSchema,
  type AirJamRunReceipt,
  type AirJamTestPolicy,
  type AirJamTestProfile,
} from "../testing.js";
import { loadAirJamGame, loadAirJamTesting } from "./load-game.js";

let role: "discover" | "policy" | "evaluator" | undefined;
let busy = false;
let profile: AirJamTestProfile | undefined;
let evaluator: ReturnType<AirJamTestProfile["evaluator"]["create"]> | undefined;
let evaluationIndex = 0;
const policySequences = new Map<string, number>();
const policies = new Map<
  string,
  Awaited<ReturnType<AirJamTestPolicy["create"]>>
>();
function send(message: TestProfileResponse) {
  if (process.connected) process.send?.(message);
}
function acceptReceipts(receipts: AirJamRunReceipt[], seatId?: string) {
  let previous =
    seatId === undefined ? evaluationIndex : (policySequences.get(seatId) ?? 0);
  for (const receipt of receipts) {
    const next = seatId === undefined ? receipt.index : receipt.sequence;
    if (
      next !== previous + 1 ||
      (seatId !== undefined && receipt.seatId !== seatId)
    )
      throw new Error(
        "receipt_protocol: Missing, repeated or misdirected effect receipt.",
      );
    previous = next;
  }
  if (seatId === undefined) evaluationIndex = previous;
  else policySequences.set(seatId, previous);
}
process.on("disconnect", () => process.exit(0));
process.on("message", (message: unknown) => {
  void (async () => {
    if (Buffer.byteLength(JSON.stringify(message)) > TEST_PROFILE_IPC_MAX_BYTES)
      throw new Error("Oversized test profile request.");
    const request = testProfileRequestSchema.parse(message);
    if (busy)
      return send({ kind: "error", id: request.id, message: "policy_busy" });
    busy = true;
    try {
      if (request.kind === "initialize") {
        if (role !== undefined)
          throw new Error("Test profile already initialized.");
        const game = await loadAirJamGame(request.configPath);
        const testing = await loadAirJamTesting(request.configPath, game);
        if (!testing) throw new Error("Game does not declare testing.");
        const profiles = describeAirJamTestProfiles(testing.profiles);
        const preparation = policyPreparationSchema.parse([]);
        const artifacts = request.artifacts;
        role = request.role;
        if (role !== "policy" && artifacts !== undefined)
          throw new Error(
            "Only the policy process can receive model artifacts.",
          );
        if (role !== "discover") {
          profile = testing.profiles[request.profileId ?? ""];
          if (!profile) throw new Error("Unknown test profile.");
          if (role === "policy") {
            const policy = profile.policies[request.policyId ?? ""];
            if (!policy) throw new Error("Unknown test policy.");
            if (Boolean(policy.artifacts) !== Boolean(artifacts))
              throw new Error(
                "Policy artifacts must be verified by the run owner before initialization.",
              );
            for (const [index, seat] of profile.seats.entries()) {
              const started = performance.now();
              const instance = await policy.create({
                seatId: seat.id,
                random: createPolicyRandom(
                  (request.seed + Math.imul(index, 0x9e3779b9)) >>> 0,
                ),
                ...(artifacts ? { artifacts } : {}),
              });
              if (typeof instance.decide !== "function")
                throw new Error("Policy must provide decide().");
              preparation.push({
                seatId: seat.id,
                prepareMs: performance.now() - started,
              });
              policies.set(seat.id, instance);
            }
          } else {
            evaluator = profile.evaluator.create({
              seats: profile.seats.map((seat) => seat.id),
            });
            if (typeof evaluator.evaluate !== "function")
              throw new Error("Scenario must provide evaluate().");
          }
        }
        send({
          kind: "initialized",
          id: request.id,
          profiles,
          preparation,
        });
      } else if (request.kind === "decide") {
        const policy = policies.get(request.step.seatId);
        if (role !== "policy" || !policy)
          throw new Error("Policy seat is not initialized.");
        acceptReceipts(request.step.receipts, request.step.seatId);
        const decision = airJamPolicyDecisionSchema.parse(
          await policy.decide(request.step),
        );
        send({ kind: "decision", id: request.id, decision });
      } else {
        if (role !== "evaluator" || !evaluator || !profile)
          throw new Error("Scenario evaluator is not initialized.");
        const activeProfile = profile;
        if (
          request.sample.seats.length !== activeProfile.seats.length ||
          request.sample.seats.some(
            (seat, index) => seat.seatId !== activeProfile.seats[index].id,
          )
        )
          throw new Error(
            "Evaluation seat mapping does not match the scenario.",
          );
        acceptReceipts(request.sample.receipts);
        const verdict = airJamScenarioVerdictSchema.parse(
          evaluator.evaluate(request.sample),
        );
        if (
          Object.keys(verdict.metrics ?? {}).some(
            (id) => !activeProfile.metrics.some((metric) => metric.id === id),
          )
        )
          throw new Error("Evaluator returned an undeclared metric.");
        send({ kind: "evaluation", id: request.id, verdict });
      }
    } catch (error) {
      send({
        kind: "error",
        id: request.id,
        message: (error instanceof Error ? error.message : String(error)).slice(
          0,
          2000,
        ),
      });
    } finally {
      busy = false;
    }
  })().catch((error) => {
    console.error(error);
    process.exit(1);
  });
});
send({ kind: "ready" });

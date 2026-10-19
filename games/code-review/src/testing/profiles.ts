import {
  createAirJamPlayerPolicy,
  defineAirJamTestProfiles,
  type AirJamTestPolicy,
} from "@air-jam/devtools/testing";
import { MAX_HP } from "../game/engine/constants";
import {
  fightOf,
  moveRelative,
  runtimeSchema,
  snapshotSchema,
} from "./observation";
import { codeReviewPlayer } from "./player";

const RELEASE = {
  horizontal: 0,
  vertical: 0,
  leftPunch: false,
  rightPunch: false,
  defend: false,
};

/** Close in, punch in reach, guard against a punch in reach; or flail at random. */
function brawlerPolicy(randomized: boolean): AirJamTestPolicy {
  return {
    label: randomized ? "Random fighter" : "Close in and punch",
    create: ({ random }) => ({
      decide: ({ observation }) => {
        const snapshot = snapshotSchema.parse(observation.snapshot);
        if (snapshot.matchPhase !== "playing")
          return { control: { kind: "release" } };
        const fight = fightOf(
          observation.controllerId ?? null,
          runtimeSchema.parse(observation.runtime),
        );
        if (!fight) return { control: { kind: "release" } };
        const reach = runtimeSchema.parse(observation.runtime).punchReach;
        const input = randomized
          ? {
              horizontal: random() * 2 - 1,
              vertical: random() * 2 - 1,
              leftPunch: random() < 0.3,
              rightPunch: false,
              defend: random() < 0.2,
            }
          : fight.opponent.distance > reach
            ? { ...RELEASE, ...moveRelative(fight, 1) }
            : fight.opponent.fighter.punching
              ? { ...RELEASE, defend: true }
              : { ...RELEASE, leftPunch: true };
        return { control: { kind: "input", input } };
      },
    }),
  };
}

export const testProfiles = defineAirJamTestProfiles({
  round: {
    label: "Fight one round against the game's bot",
    targets: ["owned"],
    seats: [{ id: "player", label: "Coder fighter" }],
    setup: [
      {
        lane: "participant",
        seatId: "player",
        actionId: "join_team",
        input: "team1",
      },
      {
        lane: "participant",
        seatId: "player",
        actionId: "set_bot_count",
        input: { team: "team1", count: 0 },
      },
      {
        lane: "participant",
        seatId: "player",
        actionId: "set_bot_count",
        input: { team: "team2", count: 1 },
      },
      { lane: "participant", seatId: "player", actionId: "start_match" },
    ],
    actions: [],
    scope: "player",
    includeImage: false,
    timing: { intervalMs: 100, decisionMs: 1200, inputTtlMs: 1500 },
    metrics: [
      { id: "rounds_won", label: "Rounds won" },
      { id: "rounds_lost", label: "Rounds lost" },
      { id: "damage_dealt", label: "Damage dealt" },
      { id: "damage_taken", label: "Damage taken" },
    ],
    policies: {
      code: brawlerPolicy(false),
      random: brawlerPolicy(true),
      model: createAirJamPlayerPolicy(codeReviewPlayer),
    },
    evaluator: {
      create: () => {
        const lowest = { team1: MAX_HP, team2: MAX_HP };
        return {
          evaluate: ({ observation }) => {
            const { scores } = snapshotSchema.parse(observation.snapshot);
            const { hp } = runtimeSchema.parse(observation.runtime);
            const decided = scores.team1 + scores.team2 > 0;
            if (!decided) {
              lowest.team1 = Math.min(lowest.team1, hp.team1);
              lowest.team2 = Math.min(lowest.team2, hp.team2);
            }
            const metrics = {
              rounds_won: scores.team1,
              rounds_lost: scores.team2,
              damage_dealt:
                decided && scores.team1 > 0 ? MAX_HP : MAX_HP - lowest.team2,
              damage_taken:
                decided && scores.team2 > 0 ? MAX_HP : MAX_HP - lowest.team1,
            };
            return decided
              ? {
                  status: "passed",
                  message: `The first round went to ${scores.team1 > 0 ? "the player" : "the bot"}.`,
                  metrics,
                }
              : { status: "pending", metrics };
          },
        };
      },
    },
  },
});

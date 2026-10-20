import {
  createAirJamPlayerPolicy,
  defineAirJamTestProfiles,
  type AirJamTestPolicy,
} from "@air-jam/devtools/testing";
import { BotController } from "../game/bot-system/bot-controller";
import { snapshotSchema } from "./observation";
import { airCapturePlayer, arenaOf } from "./player";

/** The game's own bot, flying an agent seat. */
const botPolicy: AirJamTestPolicy = {
  label: "The game's own bot",
  create: () => {
    let pilot: BotController | undefined;
    return {
      decide: ({ observation }) => {
        const snapshot = snapshotSchema.parse(observation.snapshot);
        if (snapshot.matchPhase !== "playing" || !observation.controllerId)
          return { control: { kind: "release" } };
        pilot ??= new BotController(observation.controllerId);
        return {
          control: {
            kind: "input",
            input: pilot.update(
              performance.now() / 1000,
              arenaOf(observation.runtime).world,
            ),
          },
        };
      },
    };
  },
};

export const testProfiles = defineAirJamTestProfiles({
  capture: {
    label: "Race the game's bot to one capture",
    seats: [{ id: "player", label: "Solaris ship" }],
    setup: [
      {
        lane: "participant",
        seatId: "player",
        actionId: "join_team",
        input: "solaris",
      },
      {
        lane: "participant",
        seatId: "player",
        actionId: "set_team_bot_count",
        input: { teamId: "solaris", count: 0 },
      },
      {
        lane: "participant",
        seatId: "player",
        actionId: "set_team_bot_count",
        input: { teamId: "nebulon", count: 1 },
      },
      {
        lane: "participant",
        seatId: "player",
        actionId: "set_points_to_win",
        input: 1,
      },
      { lane: "participant", seatId: "player", actionId: "start_match" },
    ],
    actions: [],
    scope: "player",
    includeImage: false,
    timing: { intervalMs: 100, decisionMs: 1200, inputTtlMs: 1500 },
    metrics: [
      { id: "captures", label: "Flags captured" },
      { id: "conceded", label: "Flags conceded" },
    ],
    policies: {
      code: botPolicy,
      model: createAirJamPlayerPolicy(airCapturePlayer),
    },
    evaluator: {
      create: () => ({
        evaluate: ({ observation }) => {
          const { matchPhase } = snapshotSchema.parse(observation.snapshot);
          const { scores } = arenaOf(observation.runtime);
          const metrics = {
            captures: scores.solaris,
            conceded: scores.nebulon,
          };
          return metrics.captures + metrics.conceded > 0 ||
            matchPhase === "ended"
            ? {
                status: "passed",
                message:
                  metrics.captures > 0
                    ? "The player captured the bot's flag first."
                    : "The bot captured the player's flag first.",
                metrics,
              }
            : { status: "pending", metrics };
        },
      }),
    },
  },
});

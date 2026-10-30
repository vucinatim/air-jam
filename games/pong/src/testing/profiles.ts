import {
  defineAirJamTesting,
  type AirJamTestPolicy,
} from "@air-jam/devtools/testing";
import { z } from "zod";
import { MAX_TEAM_SLOTS } from "../game/domain/team-slots";
import {
  BALL_SIZE,
  FIELD_WIDTH,
  PADDLE_HEIGHT,
  PADDLE_SPEED,
} from "../game/engine/constants";
import {
  paddleTop,
  runtimeSchema,
  simulationOf,
  snapshotSchema,
} from "./observation";
import { pongPlayer } from "./player";

function rallyPolicy(randomized: boolean): AirJamTestPolicy {
  return {
    label: randomized ? "Random paddles" : "Track and concede",
    create: ({ seatId, random }) => ({
      decide: ({ observation, elapsedMs }) => {
        const runtime = runtimeSchema.parse(observation.runtime);
        const paddleY =
          seatId === "left"
            ? runtime.simulation.paddle1FrontY
            : runtime.simulation.paddle2FrontY;
        const target =
          seatId === "right" && elapsedMs > 8000
            ? runtime.simulation.ballY > 300
              ? 0
              : 600
            : runtime.simulation.ballY;
        const direction = randomized
          ? random() * 2 - 1
          : Math.max(
              -1,
              Math.min(
                1,
                (target - (paddleY + PADDLE_HEIGHT / 2)) / (PADDLE_SPEED * 0.2),
              ),
            );
        return { control: { kind: "input", input: { direction } } };
      },
    }),
  };
}
function cooperativePaddlePolicy(randomized: boolean): AirJamTestPolicy {
  return {
    label: randomized ? "Random paddle" : "Track the ball",
    create: ({ random }) => ({
      decide: ({ observation }) => {
        const snapshot = snapshotSchema.parse(observation.snapshot);
        if (!snapshot.myAssignment) {
          const available = snapshot.teams
            .filter(
              (team) => team.players.length + team.botCount < MAX_TEAM_SLOTS,
            )
            .sort(
              (left, right) =>
                left.players.length +
                left.botCount -
                right.players.length -
                right.botCount,
            );
          return {
            control:
              snapshot.matchPhase === "lobby" && available[0]
                ? {
                    kind: "action",
                    actionId: "join_team",
                    input: available[0].id,
                  }
                : { kind: "release" },
          };
        }
        const simulation = simulationOf(observation.runtime);
        const paddleY = paddleTop(snapshot.myAssignment, simulation);
        return {
          control: {
            kind: "input",
            input: {
              direction: randomized
                ? random() * 2 - 1
                : Math.max(
                    -1,
                    Math.min(
                      1,
                      (simulation.ballY - paddleY - PADDLE_HEIGHT / 2) /
                        (PADDLE_SPEED * 0.2),
                    ),
                  ),
            },
          },
        };
      },
    }),
  };
}
export const testing = defineAirJamTesting({
  player: pongPlayer,
  profiles: {
    match: {
      label: "Play a short match against the game's bot",
      seats: [{ id: "player", label: "Orange paddle" }],
      setup: [
        // The room may hold an earlier match; every run starts from the lobby.
        { lane: "participant", seatId: "player", actionId: "return_to_lobby" },
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
        {
          lane: "participant",
          seatId: "player",
          actionId: "set_points_to_win",
          input: 3,
        },
        { lane: "participant", seatId: "player", actionId: "start_match" },
      ],
      actions: [],
      scope: "player",
      includeImage: false,
      timing: { intervalMs: 100, decisionMs: 1200, inputTtlMs: 1500 },
      metrics: [
        { id: "player_points", label: "Points won" },
        { id: "bot_points", label: "Points conceded" },
      ],
      policies: {
        code: cooperativePaddlePolicy(false),
        random: cooperativePaddlePolicy(true),
      },
      evaluator: {
        create: () => ({
          evaluate: ({ observation }) => {
            const { matchPhase, scores } = snapshotSchema.parse(
              observation.snapshot,
            );
            const metrics = {
              player_points: scores.team1,
              bot_points: scores.team2,
            };
            return matchPhase === "ended"
              ? {
                  status: "passed",
                  message: `The match finished ${scores.team1}-${scores.team2} against the bot.`,
                  metrics,
                }
              : { status: "pending", metrics };
          },
        }),
      },
    },
    cooperative: {
      label: "Play a paddle alongside the creator",
      seats: [{ id: "player", label: "Agent paddle" }],
      setup: [],
      actions: ["join_team"],
      scope: "player",
      includeImage: false,
      timing: { intervalMs: 150, decisionMs: 1200, inputTtlMs: 1500 },
      metrics: [],
      policies: {
        code: cooperativePaddlePolicy(false),
        random: cooperativePaddlePolicy(true),
      },
      evaluator: {
        create: () => ({
          evaluate: () => ({
            status: "pending",
            message:
              "Observed in the creator's room; not an isolated scoring proof.",
          }),
        }),
      },
    },
    scoring: {
      label: "Two-player input and physical scoring",
      seats: [
        { id: "left", label: "Orange paddle" },
        { id: "right", label: "Blue paddle" },
      ],
      setup: [
        // The room may hold an earlier match; every run starts from the lobby.
        { lane: "participant", seatId: "left", actionId: "return_to_lobby" },
        {
          lane: "participant",
          seatId: "left",
          actionId: "join_team",
          input: "team1",
        },
        {
          lane: "participant",
          seatId: "right",
          actionId: "join_team",
          input: "team2",
        },
        {
          lane: "participant",
          seatId: "left",
          actionId: "set_bot_count",
          input: { team: "team1", count: 0 },
        },
        {
          lane: "participant",
          seatId: "left",
          actionId: "set_bot_count",
          input: { team: "team2", count: 0 },
        },
        {
          lane: "participant",
          seatId: "left",
          actionId: "set_points_to_win",
          input: 5,
        },
        { lane: "participant", seatId: "left", actionId: "start_match" },
      ],
      actions: [],
      scope: "diagnostic",
      includeImage: false,
      timing: { intervalMs: 100, decisionMs: 300, inputTtlMs: 750 },
      metrics: [
        { id: "goals", label: "Physical goals" },
        { id: "left_movement", label: "Orange paddle movement" },
        { id: "right_movement", label: "Blue paddle movement" },
      ],
      policies: { code: rallyPolicy(false), random: rallyPolicy(true) },
      evaluator: {
        create: () => {
          let baseline = false;
          let previous: { left: number; right: number } | undefined;
          const movement = { left: 0, right: 0 };
          const direction = { left: 0, right: 0 };
          let score = { team1: 0, team2: 0 };
          let lastGoal = 0;
          let lastServe = -1;
          // Goals scored in the room before this trial stay in the host's log.
          let earlierGoals = 0;
          return {
            evaluate: ({ observation, seats, receipts }) => {
              const snapshot = snapshotSchema.parse(observation.snapshot);
              const runtime = runtimeSchema.parse(observation.runtime);
              for (const [index, seat] of seats.entries()) {
                const team = snapshot.teams.find(
                  (team) => team.id === (index === 0 ? "team1" : "team2"),
                );
                if (
                  !team ||
                  team.botCount !== 0 ||
                  team.players.length !== 1 ||
                  team.players[0].playerId !== seat.controllerId ||
                  team.players[0].position !== "front"
                )
                  return {
                    status: "failed",
                    message:
                      "The two agent seats do not own the expected paddles, or a bot is participating.",
                  };
              }
              if (!baseline) {
                if (snapshot.scores.team1 !== 0 || snapshot.scores.team2 !== 0)
                  return {
                    status: "failed",
                    message: "Scoring trial did not begin at an empty match.",
                  };
                for (const goal of runtime.goals) {
                  lastGoal = Math.max(lastGoal, goal.sequence);
                  lastServe = Math.max(lastServe, goal.serve);
                }
                earlierGoals = lastGoal;
                baseline = true;
              }
              for (const receipt of receipts) {
                if (receipt.acknowledgement.status === "unconfirmed")
                  return {
                    status: "failed",
                    message: "Participant effect was not acknowledged.",
                  };
                if (receipt.seatId !== "left" && receipt.seatId !== "right")
                  throw new Error("Unknown scoring seat.");
                if (
                  receipt.phase === "play" &&
                  receipt.acknowledgement.status === "applied"
                ) {
                  if (receipt.operation.kind === "input")
                    direction[receipt.seatId] = z
                      .object({ direction: z.number() })
                      .parse(receipt.operation.input).direction;
                  else if (receipt.operation.kind === "release")
                    direction[receipt.seatId] = 0;
                }
              }
              const current = {
                left: runtime.simulation.paddle1FrontY,
                right: runtime.simulation.paddle2FrontY,
              };
              if (previous)
                for (const seat of ["left", "right"] as const) {
                  const delta = current[seat] - previous[seat];
                  if (
                    Math.abs(delta) > 1 &&
                    Math.sign(delta) === Math.sign(direction[seat])
                  )
                    movement[seat] += Math.abs(delta);
                }
              previous = current;
              for (const goal of runtime.goals.filter(
                (goal) => goal.sequence > lastGoal,
              )) {
                const team =
                  goal.ballX <= 0
                    ? "team2"
                    : goal.ballX >= FIELD_WIDTH - BALL_SIZE
                      ? "team1"
                      : null;
                if (
                  goal.sequence !== lastGoal + 1 ||
                  goal.serve <= lastServe ||
                  team === null ||
                  goal.team !== team ||
                  goal.before.team1 !== score.team1 ||
                  goal.before.team2 !== score.team2 ||
                  goal.after[team] !== goal.before[team] + 1 ||
                  goal.after[team === "team1" ? "team2" : "team1"] !==
                    goal.before[team === "team1" ? "team2" : "team1"]
                )
                  return {
                    status: "failed",
                    message:
                      "A physical goal changed the wrong score, added more than one point, or repeated before a new serve.",
                  };
                lastGoal = goal.sequence;
                lastServe = goal.serve;
                score = goal.after;
              }
              if (
                snapshot.scores.team1 !== score.team1 ||
                snapshot.scores.team2 !== score.team2
              )
                return {
                  status: "failed",
                  message:
                    "Score changed without a corresponding physical goal.",
                };
              const metrics = {
                goals: lastGoal - earlierGoals,
                left_movement: movement.left,
                right_movement: movement.right,
              };
              return {
                status:
                  lastGoal > earlierGoals &&
                  movement.left > 1 &&
                  movement.right > 1
                    ? "passed"
                    : "pending",
                message:
                  "Both leased player inputs moved their own paddles; each physical goal added exactly one point to the correct side.",
                metrics,
              };
            },
          };
        },
      },
    },
  },
});

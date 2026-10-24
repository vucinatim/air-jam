import type {
  AirJamDecisionQuestion,
  AirJamPlayControl,
  AirJamPlayerContract,
} from "@air-jam/devtools/testing";
import { Vector3 } from "three";
import {
  BOT_STRATEGIES,
  BotController,
  botStrategyDestination,
  type BotStrategy,
} from "../game/bot-system/bot-controller";
import type { BotWorld } from "../game/bot-system/bot-world";
import { GameContext } from "../game/bot-system/game-context";
import { ARENA_RADIUS } from "../game/constants";
import { TEAM_CONFIG, type TeamId } from "../game/domain/team";
import { runtimeSchema, snapshotSchema, type Snapshot } from "./observation";

const AIMS: Record<BotStrategy, string> = {
  heal: "fly to the health pack to repair",
  return: "carry the enemy flag home to my base",
  defend: "chase down the enemy carrying our flag",
  retrieve: "fly to our dropped flag to return it",
  capture: "fly to the enemy flag and pick it up",
  attack: "chase and shoot the nearest enemy ship",
  gather: "pick up the nearest power-up",
};
/** Let a choice play out for a while before asking again. */
const RETHINK_MS = 2000;

const isStrategy = (choice: string): choice is BotStrategy =>
  (BOT_STRATEGIES as readonly string[]).includes(choice);
/** The arena as the game's own bots see it, and the score. */
export function arenaOf(runtime: unknown) {
  const { scores, ...world } = runtimeSchema.parse(runtime);
  return { world, scores };
}
function fly(
  pilot: BotController,
  world: BotWorld,
  strategy: BotStrategy,
  elapsedMs: number,
): AirJamPlayControl {
  return {
    kind: "input",
    input: pilot.update(elapsedMs / 1000, world, strategy),
  };
}

function chooseTeam(teams: Snapshot["teams"]): AirJamDecisionQuestion {
  const [first, second] = teams;
  return {
    state: [
      `We are in the lobby. ${first.label} has ${first.totalCount} ships and ${second.label} has ${second.totalCount}.`,
    ],
    question: "Which team should I join so the match is balanced?",
    options: Object.fromEntries(
      teams.map((team, index) => {
        const other = teams[1 - index];
        return [
          team.id,
          {
            when: `${team.label} has ${index === 0 ? "no more" : "fewer"} ships than ${other.label}.`,
            control: { kind: "action", actionId: "join_team", input: team.id },
          },
        ];
      }),
    ),
  };
}

const place = (vector: Vector3 | [number, number, number]) => {
  const [x, y, z] = Array.isArray(vector) ? vector : vector.toArray();
  return `x=${Math.round(x)}, z=${Math.round(z)}${y > 6 ? `, ${Math.round(y)} high` : ""}`;
};

function match(
  controllerId: string,
  world: BotWorld,
  scores: Record<TeamId, number>,
  random: () => number,
  elapsedMs: number,
): AirJamDecisionQuestion | null {
  const context = new GameContext(world);
  const self = context.getSelf(controllerId);
  if (!self) return null;
  const enemyTeam = context.getEnemyTeam(controllerId);
  if (!enemyTeam) return null;
  const distance = (to: Vector3 | [number, number, number]) =>
    Math.round(
      self.position.distanceTo(Array.isArray(to) ? new Vector3(...to) : to),
    );
  const label = (team: TeamId) => TEAM_CONFIG[team].label;
  const flags = context.getFlags();
  const flagLine = (team: TeamId, whose: string) => {
    const flag = flags.find((candidate) => candidate.teamId === team);
    if (!flag) return `${whose} flag is missing.`;
    if (flag.status === "carried")
      return flag.carrierId === controllerId
        ? `I am carrying ${whose.toLowerCase()} flag.`
        : `${whose} flag is being carried, ${distance(flag.position)} away.`;
    return `${whose} flag is ${flag.status === "atBase" ? "at its base" : "dropped"} at ${place(flag.position)}, ${distance(flag.position)} away.`;
  };
  const available = BOT_STRATEGIES.filter((strategy) =>
    botStrategyDestination(strategy, controllerId, context, self, true),
  );
  if (!available.length) return null;
  return {
    state: [
      `The score is ${label(self.teamId)} (my team) ${scores[self.teamId]}, ${label(enemyTeam)} ${scores[enemyTeam]}.`,
      `My ship is at ${place(self.position)} with ${Math.round(self.health)} health${self.queuedAbility ? ` and a ${self.queuedAbility.replace("_", " ")} ready` : ""}.`,
      ...context
        .getEnemies(controllerId)
        .map(
          (enemy) =>
            `An enemy ship is ${distance(enemy.position)} away with ${Math.round(enemy.health)} health.`,
        ),
      flagLine(enemyTeam, "The enemy"),
      flagLine(self.teamId, "Our"),
      ...context
        .getCollectibles()
        .slice(0, 3)
        .map(
          (collectible) =>
            `A ${collectible.abilityId.replace("_", " ")} pick-up is ${distance(collectible.position)} away.`,
        ),
    ],
    question: "What should my ship do now?",
    options: Object.fromEntries(
      available.map((strategy) => [
        strategy,
        {
          when: `My aim right now is to ${AIMS[strategy]}.`,
          control: fly(
            new BotController(controllerId, random),
            world,
            strategy,
            elapsedMs,
          ),
        },
      ]),
    ),
  };
}

/** Air Capture as a person would be told it, for a decision model holding a ship. */
export const airCapturePlayer = {
  brief: [
    `This is Air Capture, capture the flag between two teams of hovering ships in a round arena about ${ARENA_RADIUS * 2} units across, seen from above with x across and z down the map.`,
    "Ships fly over obstacles using jump pads and shoot at enemy ships automatically when lined up; pick-ups give a speed boost, a rocket or a health pack.",
    "A team scores by carrying the other team's flag back to its own base while its own flag is home; a ship that is shot down drops any flag it carries.",
    "My ship flies itself towards whatever I aim for; I choose what to aim for.",
    "Unless you have been given another goal: carry the enemy flag home when you have it, chase whoever carries our flag, return our dropped flag, otherwise go for the enemy flag, fight enemies that come close, and grab a health pack when badly hurt.",
  ].join(" "),
  turn: ({ observation, random, elapsedMs }) => {
    const snapshot = snapshotSchema.parse(observation.snapshot);
    if (snapshot.matchPhase === "lobby" && !snapshot.myAssignment)
      return chooseTeam(snapshot.teams);
    if (snapshot.matchPhase !== "playing" || !observation.controllerId)
      return null;
    const { world, scores } = arenaOf(observation.runtime);
    return match(observation.controllerId, world, scores, random, elapsedMs);
  },
  act: {
    rethinkMs: RETHINK_MS,
    // One persistent pilot per seat, so jump-pad routes survive between steps.
    create: ({ random }) => {
      let pilot: BotController | undefined;
      return {
        control: ({ observation, choice, elapsedMs }) => {
          const controllerId = observation.controllerId;
          if (!controllerId || !isStrategy(choice)) return null;
          pilot ??= new BotController(controllerId, random);
          return fly(
            pilot,
            arenaOf(observation.runtime).world,
            choice,
            elapsedMs,
          );
        },
      };
    },
  },
} satisfies AirJamPlayerContract;

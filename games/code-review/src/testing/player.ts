import type {
  AirJamDecisionQuestion,
  AirJamPlayerContract,
} from "@air-jam/devtools/testing";
import {
  FIELD_HEIGHT,
  FIELD_WIDTH,
  MAX_HP,
  PUNCH_DAMAGE,
} from "../game/engine/constants";
import {
  fightOf,
  moveRelative,
  runtimeSchema,
  snapshotSchema,
  type Fight,
  type Snapshot,
} from "./observation";

const RELEASE = {
  horizontal: 0,
  vertical: 0,
  leftPunch: false,
  rightPunch: false,
  defend: false,
};

function chooseTeam(teams: Snapshot["teams"]): AirJamDecisionQuestion {
  const size = (team: "team1" | "team2") =>
    teams.find((entry) => entry.id === team)?.totalCount ?? 0;
  return {
    state: [
      `We are in the lobby. The Coder team has ${size("team1")} fighters and the Reviewer team has ${size("team2")}.`,
    ],
    question: "Which team should I join so the fight is balanced?",
    options: {
      team1: {
        when: "The Coder team has no more fighters than the Reviewer team.",
        control: { kind: "action", actionId: "join_team", input: "team1" },
      },
      team2: {
        when: "The Reviewer team has fewer fighters than the Coder team.",
        control: { kind: "action", actionId: "join_team", input: "team2" },
      },
    },
  };
}

function fight(
  fight: Fight,
  hp: { mine: number; theirs: number },
  reach: number,
): AirJamDecisionQuestion {
  const { me, opponent } = fight;
  const them = opponent.fighter;
  const condition = [
    them.punching && "punching",
    them.defending && "guarding",
    them.stunned && "reeling from a hit",
  ].filter(Boolean);
  return {
    state: [
      `My fighter is at x=${me.x}, y=${me.y}${me.defending ? " and is guarding" : ""}${me.empowered ? ", with charged punches" : ""}.`,
      `The nearest opponent is at x=${them.x}, y=${them.y}, ${Math.round(opponent.distance)} pixels away${condition.length ? `, ${condition.join(" and ")}` : ""}.`,
      `My team has ${Math.round(hp.mine)} health left and theirs has ${Math.round(hp.theirs)}.`,
    ],
    question: "What should my fighter do right now?",
    options: {
      approach: {
        when: `The fighter I am aiming at is more than ${reach} pixels away, out of my punching reach.`,
        control: {
          kind: "input",
          input: { ...RELEASE, ...moveRelative(fight, 1) },
        },
      },
      punch: {
        when: `The fighter I am aiming at is within ${reach} pixels and is not punching at me.`,
        control: { kind: "input", input: { ...RELEASE, leftPunch: true } },
      },
      guard: {
        when: `An opponent within ${reach} pixels is punching at me.`,
        control: { kind: "input", input: { ...RELEASE, defend: true } },
      },
      retreat: {
        when: "I want more distance between me and the nearest opponent than I have now.",
        control: {
          kind: "input",
          input: { ...RELEASE, ...moveRelative(fight, -1) },
        },
      },
    },
  };
}

/** Code Review as a person would be told it, for a decision model holding a fighter. */
export const codeReviewPlayer = {
  brief: [
    `This is Code Review, a boxing brawl in a square ring seen from above, ${FIELD_WIDTH} by ${FIELD_HEIGHT} pixels.`,
    "Positions are measured from the top-left corner: x grows to the right and y grows downwards.",
    "Each player moves their own fighter in any direction and throws punches; the Coder team fights the Reviewer team.",
    `A punch hits every opposing fighter whose centre is within reach of yours for ${PUNCH_DAMAGE} damage, half that if they are guarding, and a fighter who guards a hit has charged punches for two seconds.`,
    `Each team shares ${MAX_HP} health; knocking the other team to zero wins the round.`,
    "Unless you have been given another goal, the fighter you aim at is the nearest opponent: close in, punch when they are in reach, and guard when they punch at you.",
  ].join(" "),
  turn: ({ observation }) => {
    const snapshot = snapshotSchema.parse(observation.snapshot);
    if (snapshot.matchPhase === "lobby" && !snapshot.myAssignment)
      return chooseTeam(snapshot.teams);
    if (snapshot.matchPhase !== "playing" || !snapshot.myAssignment)
      return null;
    const runtime = runtimeSchema.parse(observation.runtime);
    const current = fightOf(observation.controllerId ?? null, runtime);
    if (!current) return null;
    const mine = current.me.team;
    return fight(
      current,
      {
        mine: runtime.hp[mine],
        theirs: runtime.hp[mine === "team1" ? "team2" : "team1"],
      },
      runtime.punchReach,
    );
  },
} satisfies AirJamPlayerContract;

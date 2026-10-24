import type {
  AirJamDecisionQuestion,
  AirJamPlayerContract,
} from "@air-jam/devtools/testing";
import { getTaskDurationMs } from "../game/content/players";
import { STAT_CONSTANTS } from "../game/domain/task-manager";
import { ALL_LOCATIONS, routeTo, type Route } from "./navigation";
import {
  runtimeSchema,
  selfOf,
  snapshotSchema,
  type Self,
} from "./observation";

/** Breaks a coworker can take, and what each restores. */
export const BREAKS = {
  coffee: {
    locationId: "coffee-machine",
    effect: `+${STAT_CONSTANTS.COFFEE_ENERGY_RESTORE} energy`,
  },
  lunch: {
    locationId: "lunch-spot",
    effect: `+${STAT_CONSTANTS.LUNCH_ENERGY_RESTORE} energy`,
  },
  fifa: {
    locationId: "fifa-table",
    effect: `+${STAT_CONSTANTS.FIFA_BOREDOM_RESTORE} fun`,
  },
} as const;
/** Where a choice leads: a task's location, a break spot, or nowhere. */
function destinationOf(choice: string) {
  if (choice.startsWith("do-")) return choice.slice(3);
  return Object.hasOwn(BREAKS, choice)
    ? BREAKS[choice as keyof typeof BREAKS].locationId
    : null;
}

/** Open tasks offered per turn, nearest first. */
const OFFERED_TASKS = 6;

const label = (locationId: string) =>
  ALL_LOCATIONS.find((location) => location.id === locationId)?.label ??
  locationId;

/**
 * Walk towards a location, or press the action button once there. A press is
 * a fresh press only after the button was released, so a held button lets go.
 */
export function goControl(self: Self, route: Route) {
  if (!route.arrived)
    return {
      kind: "input" as const,
      input: {
        move: { x: route.movementX, y: route.movementY },
        action: false,
      },
    };
  return {
    kind: "input" as const,
    input: { move: { x: 0, y: 0 }, action: !self.holdingAction },
  };
}

function shift(
  self: Self,
  runtime: ReturnType<typeof runtimeSchema.parse>,
  earned: number,
): AirJamDecisionQuestion | null {
  const tasks = runtime.tasks
    .map((task) => ({ task, route: routeTo(self, task.locationId) }))
    .filter(
      (entry): entry is typeof entry & { route: Route } => entry.route !== null,
    )
    .sort((left, right) => left.route.seconds - right.route.seconds)
    .slice(0, OFFERED_TASKS);
  const breaks = Object.entries(BREAKS).flatMap(([id, item]) => {
    const route = routeTo(self, item.locationId);
    return route ? [{ id, item, route }] : [];
  });
  const options: AirJamDecisionQuestion["options"] = {};
  for (const { task, route } of tasks)
    options[`do-${task.locationId}`] = {
      when: `I am aiming to do "${task.name}" at ${label(task.locationId)} next.`,
      control: goControl(self, route),
    };
  for (const { id, item, route } of breaks)
    options[id] = {
      when: `I am aiming to take a ${id === "fifa" ? "FIFA" : id} break next (${item.effect}).`,
      control: goControl(self, route),
    };
  options.wait = {
    when: "Nothing is worth doing right now.",
    control: { kind: "release" },
  };
  return {
    state: [
      `About ${Math.round(runtime.timeLeftMs / 1000)} seconds of the workday are left and the team has earned ${earned}.`,
      `I am ${self.name} at x=${self.x}, y=${self.y}, with ${Math.round(self.energy)} energy and ${Math.round(self.boredom)} fun out of 100.`,
      ...(tasks.length
        ? tasks.map(
            ({ task, route }) =>
              `Task "${task.name}" at ${label(task.locationId)} pays ${task.reward}, expires in ${Math.round(task.expiresInMs / 1000)} s, takes me ${Math.round(getTaskDurationMs(task.taskId, self.coworkerId) / 1000)} s and is ${route.arrived ? "right here" : `${Math.round(route.seconds)} s away`}.`,
          )
        : ["There are no open tasks right now."]),
      ...breaks.map(
        ({ id, item, route }) =>
          `${id === "fifa" ? "The FIFA table" : id === "coffee" ? "The coffee machine" : "The lunch spot"} (${item.effect}) is ${route.arrived ? "right here" : `${Math.round(route.seconds)} s away`}.`,
      ),
    ],
    question: "What should I do next?",
    options,
  };
}

/** The Office as a person would be told it, for a decision model playing one coworker. */
export const officePlayer = {
  brief: [
    "This is The Office, a co-op workday seen from above. Every coworker walks around the office and does tasks for money before the day ends.",
    `Tasks appear at desks and rooms and pay when finished; a task left open for ${STAT_CONSTANTS.TASK_EXPIRY_MS / 1000} seconds expires and costs the team 100.`,
    `Each coworker loses ${STAT_CONSTANTS.ENERGY_DECAY_PER_SECOND} energy a second and fun in random drops; if either reaches zero they are out for the rest of the day.`,
    "Coffee and lunch restore energy and FIFA restores fun; each break takes a few seconds.",
    "Coworkers are faster at some tasks than others, so a task's time depends on who does it.",
    "Unless you have been given another goal, aim to keep energy and fun above 25 with breaks, and otherwise do the open task you can reach and finish soonest before it expires, preferring higher pay.",
  ].join(" "),
  turn: ({ observation }) => {
    const snapshot = snapshotSchema.parse(observation.snapshot);
    if (snapshot.phase !== "playing") return null;
    const runtime = runtimeSchema.parse(observation.runtime);
    const self = selfOf(observation.controllerId ?? null, snapshot, runtime);
    if (!self || !self.alive || self.doingTask || self.onBreakAt) return null;
    return shift(self, runtime, snapshot.scoreboard.finalTotalMoney);
  },
  act: {
    // The model chooses where to go; walking re-routes at every step, so a
    // direction is never held longer than the run's step interval.
    rethinkMs: 3000,
    create: () => ({
      control: ({ observation, choice }) => {
        const snapshot = snapshotSchema.parse(observation.snapshot);
        const runtime = runtimeSchema.parse(observation.runtime);
        const self = selfOf(
          observation.controllerId ?? null,
          snapshot,
          runtime,
        );
        const destination = destinationOf(choice);
        if (!self || !destination) return null;
        const route = routeTo(self, destination);
        return route ? goControl(self, route) : null;
      },
    }),
  },
} satisfies AirJamPlayerContract;

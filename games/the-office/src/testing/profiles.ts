import {
  createAirJamPlayerPolicy,
  defineAirJamTestProfiles,
  type AirJamTestPolicy,
} from "@air-jam/devtools/testing";
import { getTaskDurationMs } from "../game/content/players";
import { routeTo } from "./navigation";
import { runtimeSchema, selfOf, snapshotSchema } from "./observation";
import { BREAKS, goControl, officePlayer } from "./player";

const LOW_STAT = 25;
/** Game time each shift test covers; contained hosts may run slower than real time. */
const SHIFT_SPAN_MS = 120_000;

/** Breaks when a stat runs low, else the reachable task that finishes soonest. */
const workdayPolicy: AirJamTestPolicy = {
  label: "Breaks when low, else the soonest task",
  create: () => ({
    decide: ({ observation }) => {
      const snapshot = snapshotSchema.parse(observation.snapshot);
      if (snapshot.phase !== "playing") return { control: { kind: "release" } };
      const runtime = runtimeSchema.parse(observation.runtime);
      const self = selfOf(observation.controllerId ?? null, snapshot, runtime);
      if (!self || !self.alive || self.doingTask || self.onBreakAt)
        return { control: { kind: "release" } };
      const destination =
        self.energy < LOW_STAT
          ? BREAKS.coffee.locationId
          : self.boredom < LOW_STAT
            ? BREAKS.fifa.locationId
            : runtime.tasks
                .map((task) => ({
                  task,
                  route: routeTo(self, task.locationId),
                }))
                .filter(
                  ({ task, route }) =>
                    route && route.seconds * 1000 < task.expiresInMs,
                )
                .sort(
                  (left, right) =>
                    left.route!.seconds * 1000 +
                    getTaskDurationMs(left.task.taskId, self.coworkerId) -
                    (right.route!.seconds * 1000 +
                      getTaskDurationMs(right.task.taskId, self.coworkerId)),
                )[0]?.task.locationId;
      const route = destination ? routeTo(self, destination) : null;
      return { control: route ? goControl(self, route) : { kind: "release" } };
    },
  }),
};

export const testProfiles = defineAirJamTestProfiles({
  shift: {
    label: "Work the first two minutes of a shift alone",
    targets: ["owned"],
    seats: [{ id: "player", label: "Špela" }],
    setup: [
      {
        lane: "participant",
        seatId: "player",
        actionId: "select_character",
        input: "spela",
      },
      { lane: "participant", seatId: "player", actionId: "start_match" },
    ],
    actions: [],
    scope: "player",
    includeImage: false,
    timing: { intervalMs: 200, decisionMs: 1500, inputTtlMs: 2000 },
    metrics: [
      { id: "earned", label: "Money earned" },
      { id: "penalties", label: "Expired-task penalties" },
      { id: "final", label: "Final total" },
      { id: "survived", label: "Lasted the whole day (1 = yes)" },
    ],
    policies: {
      code: workdayPolicy,
      model: createAirJamPlayerPolicy(officePlayer),
    },
    evaluator: {
      create: () => {
        let startLeftMs: number | undefined;
        return {
          evaluate: ({ observation, seats }) => {
            const snapshot = snapshotSchema.parse(observation.snapshot);
            const { timeLeftMs } = runtimeSchema.parse(observation.runtime);
            if (snapshot.phase === "playing") startLeftMs ??= timeLeftMs;
            const me = snapshot.lobby.availablePlayers.find(
              (player) =>
                player.selectedByControllerId === seats[0]?.controllerId,
            );
            const metrics = {
              earned: snapshot.scoreboard.totalMoney,
              penalties: snapshot.scoreboard.totalMoneyPenalty,
              final: snapshot.scoreboard.finalTotalMoney,
              survived: me?.stats?.alive ? 1 : 0,
            };
            const worked =
              startLeftMs !== undefined &&
              startLeftMs - timeLeftMs >= SHIFT_SPAN_MS;
            return snapshot.phase === "ended" || worked
              ? {
                  status: "passed",
                  message: `${worked ? "Two minutes of the shift" : "The workday"} ended with ${metrics.final} (earned ${metrics.earned}, penalties ${metrics.penalties}).`,
                  metrics,
                }
              : { status: "pending", metrics };
          },
        };
      },
    },
  },
});

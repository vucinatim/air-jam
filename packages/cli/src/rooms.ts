import {
  ROOMS_CHECK_SCENARIOS,
  runRoomsCheck,
  type RoomsCheckScenarioResult,
} from "@air-jam/devtools/rooms-check";
import type { Command } from "commander";
import kleur from "kleur";
import { z } from "zod";

const positive = z.coerce.number().int().positive();
const optionsSchema = z.object({
  scenario: z.array(z.enum(ROOMS_CHECK_SCENARIOS)).optional(),
  json: z.boolean(),
  briefFreezeMs: positive.optional(),
  idleMs: positive.optional(),
  crowdDurationMs: positive.optional(),
  loadRooms: positive.optional(),
  loadPhones: z.coerce.number().int().min(1).max(16).optional(),
  loadDurationMs: positive.optional(),
  loadWorkers: positive.optional(),
});

const describeResult = (result: RoomsCheckScenarioResult): string =>
  `${result.passed ? kleur.green("pass") : kleur.red("FAIL")} ${result.scenario} (${result.durationMs} ms)${
    result.failure ? `: ${result.failure}` : ""
  }${result.passed ? `\n  ${JSON.stringify(result.measurements)}` : ""}`;

export function registerRoomsCommand(program: Command) {
  program
    .command("rooms")
    .description("Check room servers")
    .command("check <url>")
    .description(
      "Run the room acceptance scenarios against a rooms origin, with the host and each phone as separate processes that are frozen, killed and replaced. Every scenario but load runs by default; load opens 100 rooms and 400 phones from this machine, so the target must allow that many connections from one address.",
    )
    .option(
      "--scenario <name>",
      `Scenario to run; repeat for more (${ROOMS_CHECK_SCENARIOS.join(", ")})`,
      (value: string, previous: string[] = []) => [...previous, value],
    )
    .option("--json", "Print one machine-readable JSON document", false)
    .option(
      "--brief-freeze-ms <ms>",
      "A phone lock shorter than the server's liveness window (default 5000)",
    )
    .option(
      "--idle-ms <ms>",
      "How long the background-host room idles (default 60000)",
    )
    .option(
      "--crowd-duration-ms <ms>",
      "How long sixteen phones play (default 10000)",
    )
    .option(
      "--load-rooms <count>",
      "Rooms the load scenario opens (default 100)",
    )
    .option("--load-phones <count>", "Phones per load room (default 4)")
    .option(
      "--load-duration-ms <ms>",
      "How long the load scenario measures (default 60000)",
    )
    .option("--load-workers <count>", "Processes the load rooms run in")
    .action(async (url: string, raw: Record<string, unknown>) => {
      const parsed = optionsSchema.safeParse(raw);
      if (!parsed.success) throw new Error(z.prettifyError(parsed.error));
      const options = parsed.data;
      const report = await runRoomsCheck({
        url,
        scenarios: options.scenario,
        briefFreezeMs: options.briefFreezeMs,
        idleMs: options.idleMs,
        crowdDurationMs: options.crowdDurationMs,
        load: {
          rooms: options.loadRooms,
          phonesPerRoom: options.loadPhones,
          durationMs: options.loadDurationMs,
          workers: options.loadWorkers,
        },
        onResult: options.json
          ? undefined
          : (result) => console.log(describeResult(result)),
      });
      if (options.json) process.stdout.write(`${JSON.stringify(report)}\n`);
      if (!report.passed) process.exitCode = 1;
    });
}

import { buildLaunchLoadArgs, buildPerfSanityArgs } from "../lib/perf-plan.mjs";
import { runCommand } from "../lib/shell.mjs";

export const registerPerfCommands = (program) => {
  const perfCommand = program
    .command("perf")
    .description("Workspace performance checks");

  perfCommand
    .command("sanity")
    .description("Run the server performance sanity check")
    .option("--profile <profile>", "Named confidence profile: ci or release")
    .option("--controllers <count>", "Controller count")
    .option("--hz <count>", "Target events per second per controller")
    .option("--durationMs <ms>", "Measurement duration in milliseconds")
    .option("--warmupMs <ms>", "Warmup duration in milliseconds")
    .option(
      "--reconnectControllers <count>",
      "Reconnect churn controller count",
    )
    .option("--reconnectCycles <count>", "Reconnect churn cycle count")
    .option("--reconnectPauseMs <ms>", "Pause between disconnect and reconnect")
    .option("--strict", "Fail on threshold violations")
    .action((options) => {
      runCommand("pnpm", buildPerfSanityArgs(options));
    });

  perfCommand
    .command("launch-load")
    .description(
      "Rehearse launch load against an isolated local runtime and database",
    )
    .option(
      "--profile <profile>",
      "Rehearsal profile: smoke or release",
      "smoke",
    )
    .option(
      "--output <path>",
      "Evidence output path (default: new .airjam/launch-load run directory)",
    )
    .option(
      "--json",
      "Print only the final machine-readable document to stdout",
    )
    .addHelpText(
      "after",
      "\nCreates and disposes a new loopback database from AIR_JAM_TEST_DATABASE_URL. Never uses a production target.",
    )
    .action((options) => {
      runCommand("pnpm", buildLaunchLoadArgs(options));
    });

  return perfCommand;
};

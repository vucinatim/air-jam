import { runCommand } from "../lib/shell.mjs";
import { buildPerfSanityArgs } from "../lib/perf-plan.mjs";

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

  return perfCommand;
};

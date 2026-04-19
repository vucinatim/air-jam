import { runCommand } from "../lib/shell.mjs";

export const registerPerfCommands = (program) => {
  const perfCommand = program
    .command("perf")
    .description("Workspace performance checks");

  perfCommand
    .command("sanity")
    .description("Run the server performance sanity check")
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
      const args = ["--filter", "server", "perf:sanity"];
      const forwarded = [];
      const forwardedFlags = [
        "controllers",
        "hz",
        "durationMs",
        "warmupMs",
        "reconnectControllers",
        "reconnectCycles",
        "reconnectPauseMs",
      ];
      for (const flag of forwardedFlags) {
        const value = options[flag];
        if (value !== undefined) {
          forwarded.push(`--${flag}=${value}`);
        }
      }
      if (options.strict) {
        forwarded.push("--strict");
      }
      if (forwarded.length > 0) {
        args.push("--", ...forwarded);
      }
      runCommand("pnpm", args);
    });

  return perfCommand;
};

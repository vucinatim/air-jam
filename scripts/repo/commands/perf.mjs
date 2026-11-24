import { buildPerfSanityArgs } from "../lib/perf-plan.mjs";
import { runCommand } from "../lib/shell.mjs";

export const registerPerfCommands = (program) => {
  const perfCommand = program
    .command("perf")
    .description("Workspace performance checks");

  perfCommand
    .command("sanity")
    .description(
      "Run the room acceptance load scenario against a local Node room server",
    )
    .option("--profile <profile>", "Named size: ci or release")
    .option("--rooms <count>", "Rooms to open")
    .option("--phones <count>", "Phones in each room")
    .option("--durationMs <ms>", "How long the rooms play")
    .option("--workers <count>", "Processes the phones run in")
    .action((options) => {
      runCommand("pnpm", buildPerfSanityArgs(options));
    });

  return perfCommand;
};

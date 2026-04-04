import { runCommand } from "../lib/shell.mjs";

export const registerPerfCommands = (program) => {
  const perfCommand = program
    .command("perf")
    .description("Workspace performance checks");

  perfCommand
    .command("sanity")
    .description("Run the server performance sanity check")
    .argument("[passthrough...]", "Additional perf:sanity flags")
    .action((passthrough = []) => {
      const args = ["--filter", "server", "perf:sanity"];
      if (passthrough.length > 0) {
        args.push("--", ...passthrough);
      }
      runCommand("pnpm", args);
    });

  return perfCommand;
};

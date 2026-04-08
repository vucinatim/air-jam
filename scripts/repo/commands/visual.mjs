import { runCommand } from "../lib/shell.mjs";

export const registerVisualCommands = (program) => {
  const visualCommand = program
    .command("visual")
    .description("Repo visual review helpers");

  visualCommand
    .command("capture")
    .description("Capture deterministic host/controller screenshots for one repo game")
    .requiredOption("--game <id>", "Repo game to capture")
    .option(
      "--scenario <id>",
      "Capture only one named scenario from the game-owned scenario pack",
    )
    .option(
      "--mode <mode>",
      "Visual harness runtime mode",
      "standalone-dev",
    )
    .option(
      "--secure",
      "Run the visual harness over trusted local HTTPS",
      false,
    )
    .action((options) => {
      const args = [
        "exec",
        "tsx",
        "./scripts/repo/visual/run.ts",
        "--game",
        options.game,
        "--mode",
        options.mode,
      ];

      if (options.scenario) {
        args.push("--scenario", options.scenario);
      }
      if (options.secure) {
        args.push("--secure");
      }

      runCommand("pnpm", args);
    });

  return visualCommand;
};

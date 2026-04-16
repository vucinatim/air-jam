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

  visualCommand
    .command("prefab-capture")
    .description("Capture one isolated prefab surface for a repo game")
    .requiredOption("--game <id>", "Repo game to capture")
    .requiredOption("--prefab <id>", "Prefab capture id or prefab id")
    .option(
      "--variant <key=value>",
      "Prefab variant parameter; repeat for multiple values",
      (value, previous = []) => {
        previous.push(value);
        return previous;
      },
      [],
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
        "./scripts/repo/visual/prefab-run.ts",
        "--game",
        options.game,
        "--prefab",
        options.prefab,
        "--mode",
        options.mode,
      ];

      for (const variant of options.variant) {
        args.push("--variant", variant);
      }

      if (options.secure) {
        args.push("--secure");
      }

      runCommand("pnpm", args);
    });

  return visualCommand;
};

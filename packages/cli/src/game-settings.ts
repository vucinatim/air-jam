import { keepGameSettings } from "@air-jam/devtools/game-settings";
import { inspectGame } from "@air-jam/devtools/games";
import type { Command } from "commander";

export function registerGameSettingsCommand(game: Command) {
  game
    .command("settings")
    .description("Keep local game settings in source")
    .command("keep")
    .description("Rewrite declared default literals with chosen values")
    .requiredOption(
      "--set <name=value>",
      "Setting to keep; repeat for multiple settings",
      (value: string, previous: string[] = []) => [...previous, value],
    )
    .option("--dir <path>", "Game project directory", process.cwd())
    .option("--json", "Print one machine-readable JSON document", false)
    .action(async (input: { set: string[]; dir: string; json: boolean }) => {
      const { declaration } = await inspectGame({ cwd: input.dir });
      const values: Record<string, number | boolean | string> = {};
      for (const assignment of input.set) {
        const split = assignment.indexOf("=");
        if (split < 1)
          throw new Error("AJ_SETTING_INVALID: Use --set name=value.");
        const key = assignment.slice(0, split);
        const raw = assignment.slice(split + 1);
        if (Object.hasOwn(values, key))
          throw new Error(
            `AJ_SETTING_INVALID: ${key} was provided more than once.`,
          );
        const setting =
          declaration.settings && Object.hasOwn(declaration.settings, key)
            ? declaration.settings[key]
            : undefined;
        if (!setting)
          throw new Error(
            `AJ_SETTING_UNKNOWN: ${key} is not declared by this game.`,
          );
        values[key] =
          setting.kind === "number" && raw.trim() !== ""
            ? Number(raw)
            : setting.kind === "boolean" && ["true", "false"].includes(raw)
              ? raw === "true"
              : raw;
      }
      const result = await keepGameSettings({ cwd: input.dir, values });
      if (input.json) process.stdout.write(`${JSON.stringify(result)}\n`);
      else
        for (const entry of result.kept)
          console.log(
            `${entry.key}: ${entry.from} -> ${entry.to}${entry.from === entry.to ? " (unchanged)" : ""} (${result.file})`,
          );
    });
}

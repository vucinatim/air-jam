#!/usr/bin/env node

import { Command, type OptionValues } from "commander";
import kleur from "kleur";
import {
  runScaffoldCommand,
  type ScaffoldCommandOptions,
} from "./scaffold-command";

const resolveActionOptions = <T extends OptionValues>(value: unknown): T => {
  if (
    value &&
    typeof value === "object" &&
    "opts" in value &&
    typeof (value as { opts?: unknown }).opts === "function"
  ) {
    return (value as { opts: () => T }).opts();
  }
  return value as T;
};

export const createScaffoldProgram = (): Command => {
  const program = new Command();

  program
    .name("create-airjam")
    .description("Create a new Air Jam game project")
    .argument("[project-name]", "Name of the project directory")
    .option("-t, --template <template>", "Template to use")
    .option("--skip-install", "Skip dependency installation", false)
    .option(
      "--dep-spec <name=spec>",
      "Override a scaffold dependency spec (advanced/internal)",
      (value, previous: string[] = []) => [...previous, value],
      [],
    )
    .option(
      "--override-spec <name=spec>",
      "Add a pnpm override to the scaffolded project (advanced/internal)",
      (value, previous: string[] = []) => [...previous, value],
      [],
    )
    .action(async (projectName: string | undefined, options: unknown) => {
      await runScaffoldCommand(
        projectName,
        resolveActionOptions<ScaffoldCommandOptions>(options),
      );
    });

  return program;
};

const main = async (): Promise<void> => {
  await createScaffoldProgram().parseAsync(process.argv);
};

main().catch((error) => {
  console.error(kleur.red("Error:"), error);
  process.exitCode = 1;
});

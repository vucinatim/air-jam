import { runRepoLegacyValidateTarballCommand } from "./legacy-validate-tarball.mjs";

export const registerLegacyCommands = (program) => {
  const legacyCommand = program
    .command("legacy")
    .description("Legacy game validation helpers");

  legacyCommand
    .command("validate-tarball")
    .description("Validate legacy ZeroDays games against local SDK/server tarballs")
    .option(
      "--root <path>",
      "Root directory containing the external legacy game checkouts",
    )
    .action((options) => {
      runRepoLegacyValidateTarballCommand({ root: options.root });
    });

  return legacyCommand;
};

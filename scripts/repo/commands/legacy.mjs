import { runRepoLegacyValidateTarballCommand } from "./legacy-validate-tarball.mjs";

export const registerLegacyCommands = (program) => {
  const legacyCommand = program
    .command("legacy")
    .description("Legacy game validation helpers");

  legacyCommand
    .command("validate-tarball")
    .description("Validate legacy ZeroDays games against local SDK/server tarballs")
    .action(() => {
      runRepoLegacyValidateTarballCommand();
    });

  return legacyCommand;
};
